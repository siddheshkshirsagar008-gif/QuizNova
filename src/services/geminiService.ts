import { GoogleGenAI, Type } from "@google/genai";

export interface MCQ {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  shortExplanation: string;
  detailedExplanation: string;
}

const getApiKey = () => {
  const userKey = localStorage.getItem("user_gemini_api_key");
  if (userKey && userKey.trim() !== "") return userKey;
  return process.env.GEMINI_API_KEY || "";
};

export async function generateMCQsFromText(
  text: string, 
  startNumber: number = 1, 
  batchSize: number = 25,
  initialStartNumber: number = 1
): Promise<MCQ[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No API Key found. Please add your Gemini API Key in Settings.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const isContinuation = startNumber > initialStartNumber;
  const questionsToSkip = startNumber - initialStartNumber;

  const prompt = `
    Analyze the following text and generate high-quality multiple-choice questions (MCQs).
    
    CRITICAL RULES:
    1. Generate exactly ${batchSize} questions.
    2. Start numbering from ${startNumber}.
    3. SEARCH the document for Question Number ${startNumber} (e.g., "Q${startNumber}", "${startNumber}.", "Question ${startNumber}").
    4. ${isContinuation ? `This is a CONTINUATION batch. You have already generated ${questionsToSkip} questions starting from the beginning of this text (which was Question ${initialStartNumber}). You MUST skip the content already covered and generate the NEXT ${batchSize} questions sequentially.` : `Extract exactly ${batchSize} questions starting from that specific question number.`}
    5. DO NOT skip any questions in the sequence. Maintain the EXACT original order as they appear in the PDF.
    6. If the document does not have explicit question numbers, you must logically continue from where the previous ${questionsToSkip} questions would have ended in the text flow.
    7. IMPORTANT: For any question that is NOT directly extracted from the PDF (i.e., it is AI-generated), you MUST append " (AI Generated)" to the end of the question text.
    8. Maintain the EXACT sequence order of questions or concepts as they appear in the document.
    9. Ensure these questions are SEQUENTIAL to any previous questions (this is batch starting at ${startNumber}).
    10. Each MCQ must have:
       - A clear question (prefixed with its number, e.g., "${startNumber}. What is...").
       - Exactly 4 options.
       - The index of the correct answer (0-3).
       - A short, punchy explanation for the correct answer.
       - A detailed, educational explanation that provides context and depth.
    11. Ensure the output is valid JSON.
    12. DO NOT repeat any questions or concepts that would have been covered in the first ${questionsToSkip} questions.

    Text to process:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                  },
                  correctAnswerIndex: { type: Type.NUMBER },
                  shortExplanation: { type: Type.STRING },
                  detailedExplanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswerIndex", "shortExplanation", "detailedExplanation"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    let jsonText = response.text || "{}";
    
    // Clean JSON text in case model wraps it in markdown blocks
    jsonText = jsonText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const result = JSON.parse(jsonText);
      return result.questions || [];
    } catch (parseError: any) {
      console.error("Initial JSON parse failed, attempting recovery...", parseError.message || parseError);
      // If it's a truncation error (unterminated string), try to close the JSON
      // This is a basic attempt to fix truncated JSON
      if (jsonText.lastIndexOf('"') > jsonText.lastIndexOf(':')) {
        // Likely truncated inside a string
        jsonText += '"}'; 
      }
      
      // Try to find the last complete question object
      const lastCompleteIndex = jsonText.lastIndexOf('},');
      if (lastCompleteIndex !== -1) {
        const partialJson = jsonText.substring(0, lastCompleteIndex) + '}]}';
        try {
          const result = JSON.parse(partialJson);
          return result.questions || [];
        } catch (e) {
          throw parseError; // Re-throw original error if recovery fails
        }
      }
      throw parseError;
    }
  } catch (error: any) {
    console.error("Failed to generate MCQs:", error.message || error);
    
    // Check for specific API key error from Google
    if (error.message && (error.message.includes("API key not valid") || error.message.includes("INVALID_ARGUMENT"))) {
      throw new Error("Invalid Gemini API Key. Please check your API key in Settings > AI Engine. If you haven't set one, ensure the project's default key is valid.");
    }
    
    throw new Error(error.message || "Failed to generate valid MCQs from the document.");
  }
}

export interface ParsingOptions {
  mode: 'start' | 'question' | 'page';
  value?: string;
  startIndex?: number;
}

export async function generateMCQsFromConceptText(
  text: string | string[],
  batchSize: number = 25,
  parsingOptions: ParsingOptions = { mode: 'start' }
): Promise<{ questions: MCQ[], analysis: { topics: string[], level: string } }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No API Key found. Please add your Gemini API Key in Settings.");
  }

  let processedText = "";
  let specificInstruction = "";
  const startNum = parsingOptions.startIndex || 1;

  if (Array.isArray(text)) {
    if (parsingOptions.mode === 'page') {
      const pageNum = parseInt(parsingOptions.value || "1");
      if (isNaN(pageNum) || pageNum < 1 || pageNum > text.length) {
        throw new Error("invalid inputs");
      }
      // Combine text from the specified page onwards
      processedText = text.slice(pageNum - 1).join("\n");
      specificInstruction = `START parsing and generating questions EXACTLY from Page ${pageNum} of the document.`;
    } else {
      processedText = text.join("\n");
    }
  } else {
    processedText = text;
  }

  if (parsingOptions.mode === 'question') {
    const qNum = parsingOptions.value || "1";
    specificInstruction = `START parsing and generating questions EXACTLY from Question Number ${qNum} (e.g., "Q${qNum}", "${qNum}.", "Question ${qNum}"). If you cannot find this question number, return an error in the JSON response or throw an error.`;
  } else if (parsingOptions.mode === 'start') {
    specificInstruction = `START parsing from the very beginning of the document (1st page, 1st question).`;
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    Analyze the following text and perform two tasks:
    1. Identify the main topics, key concepts, and the educational level (e.g., School Level, College Level, Competitive Exam Level, Professional Level).
    2. Generate exactly ${batchSize} high-quality multiple-choice questions (MCQs).
    
    CRITICAL RULES:
    1. ${specificInstruction}
    2. Start numbering from ${startNum}.
    3. Extract exactly ${batchSize} questions starting from that specified point.
    4. IGNORE any introductory text or table of contents before the starting point.
    5. DO NOT skip any questions. Maintain the EXACT original order as they appear in the PDF.
    6. If the text does not contain enough existing MCQs, generate new ones based on the concepts, strictly following the document's sequential flow starting from the specified point.
    7. IMPORTANT: For any question that is NOT directly extracted from the PDF (i.e., it is AI-generated), you MUST append " (AI Generated)" to the end of the question text.
    8. Maintain the EXACT sequence order of questions or concepts as they appear in the document.
    9. Each MCQ must have exactly 4 options, a correct answer index (0-3), a short explanation, and a detailed explanation.
    10. Ensure the output is valid JSON.
    11. If you cannot find the specified starting point (Question ${parsingOptions.mode === 'question' ? parsingOptions.value : 'N/A'}), you MUST return a JSON object with an "error" field set to "invalid inputs".
    
    Text to process:
    ${processedText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: {
              type: Type.OBJECT,
              properties: {
                topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                level: { type: Type.STRING }
              },
              required: ["topics", "level"]
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                  },
                  correctAnswerIndex: { type: Type.NUMBER },
                  shortExplanation: { type: Type.STRING },
                  detailedExplanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswerIndex", "shortExplanation", "detailedExplanation"]
              }
            }
          },
          required: ["analysis", "questions"]
        }
      }
    });

    let jsonText = response.text || "{}";
    
    // Clean JSON text
    jsonText = jsonText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const result = JSON.parse(jsonText);
      if (result.error === "invalid inputs") {
        throw new Error("invalid inputs");
      }
      return {
        questions: result.questions || [],
        analysis: result.analysis || { topics: [], level: "Unknown" }
      };
    } catch (parseError: any) {
      console.error("Initial JSON parse failed in concept generation, attempting recovery...", parseError.message || parseError);
      
      // Try to find the last complete question object
      const lastCompleteIndex = jsonText.lastIndexOf('},');
      if (lastCompleteIndex !== -1) {
        const partialJson = jsonText.substring(0, lastCompleteIndex) + '}]}';
        try {
          const result = JSON.parse(partialJson);
          return {
            questions: result.questions || [],
            analysis: result.analysis || { topics: [], level: "Unknown" }
          };
        } catch (e) {
          throw parseError;
        }
      }
      throw parseError;
    }
  } catch (error: any) {
    console.error("Failed to analyze and generate MCQs:", error.message || error);
    
    // Check for specific API key error from Google
    if (error.message && (error.message.includes("API key not valid") || error.message.includes("INVALID_ARGUMENT"))) {
      throw new Error("Invalid Gemini API Key. Please check your API key in Settings > AI Engine. If you haven't set one, ensure the project's default key is valid.");
    }
    
    throw new Error(error.message || "Failed to process the document text.");
  }
}
