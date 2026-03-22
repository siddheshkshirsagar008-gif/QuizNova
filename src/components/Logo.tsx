import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
}

const QUOTES = [
  "Believe you can and you're halfway there.",
  "The only way to do great work is to love what you do.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Don't watch the clock; do what it does. Keep going.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "It always seems impossible until it's done.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it."
];

export const Logo: React.FC<LogoProps> = ({ 
  className, 
  imageClassName,
  showText = false,
  textClassName
}) => {
  const [quote, setQuote] = useState<string | null>(null);

  const handleDoubleClick = () => {
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setQuote(randomQuote);
  };

  useEffect(() => {
    if (quote) {
      const timer = setTimeout(() => setQuote(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [quote]);

  return (
    <div 
      className={cn("flex items-center gap-3 cursor-pointer relative", className)}
      onDoubleClick={handleDoubleClick}
    >
      <div className={cn("relative flex items-center justify-center overflow-hidden", imageClassName)}>
        <img 
          src="/logo.png" 
          alt="QuizNova Logo" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback to a placeholder if logo.png is missing
            const target = e.target as HTMLImageElement;
            target.src = "https://picsum.photos/seed/quiz/200/200";
          }}
        />
      </div>
      {showText && (
        <span className={cn("text-xl font-bold tracking-tight", textClassName)}>
          QuizNova
        </span>
      )}

      <AnimatePresence>
        {quote && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.8 }}
            className="absolute left-full ml-4 whitespace-nowrap bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg z-50 pointer-events-none top-1/2 -translate-y-1/2"
          >
            {quote}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
