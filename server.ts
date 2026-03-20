import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import Razorpay from "razorpay";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const razorpay = process.env.RAZORPAY_KEY_ID ? new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
}) : null;

// Supabase Client
let supabaseInstance: any = null;
const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
    return supabaseInstance;
  } catch (err: any) {
    console.error("Failed to create Supabase client:", err.message || err);
    return null;
  }
};

const createNoopProxy = (message: string): any => {
  const fn = (...args: any[]) => {
    // If it's a chainable method like 'from', return the proxy itself
    const chainableMethods = ['from', 'select', 'eq', 'single', 'order', 'limit', 'insert', 'update', 'delete', 'match', 'rpc', 'admin'];
    return createNoopProxy(message);
  };

  // Make it look like a promise for async/await
  (fn as any).then = (onFullfilled: any, onRejected: any) => Promise.reject(new Error(message)).catch(onRejected);
  (fn as any).catch = (onRejected: any) => Promise.reject(new Error(message)).catch(onRejected);
  (fn as any).finally = (onFinally: any) => Promise.reject(new Error(message)).finally(onFinally);

  return new Proxy(fn, {
    get: (target, prop) => {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop];
      }
      return createNoopProxy(message);
    }
  });
};

const supabase: any = new Proxy({}, {
  get: (target, prop) => {
    const instance = getSupabase();
    if (!instance) {
      return createNoopProxy("Supabase not configured");
    }
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  try {
    // Function to generate a random API key
    const generateApiKey = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let key = "smk_";
      for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return key;
    };

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // Request logging
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.url}`);
      next();
    });

    // Health check
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", nodeVersion: process.version });
    });

    // Auth Endpoints
    app.post("/api/auth/signup", async (req, res) => {
      const { username, password, fullName, email } = req.body;
      const supabase = getSupabase();

      if (!supabase) {
        return res.status(500).json({ error: "Database not configured" });
      }

      try {
        // Check if username exists
        const { data: existingUser } = await supabase
          .from("users")
          .select("username")
          .eq("username", username)
          .maybeSingle();

        if (existingUser) {
          return res.status(400).json({ error: "Username already taken" });
        }

        // Check if email exists
        const { data: existingEmail } = await supabase
          .from("users")
          .select("email")
          .eq("email", email)
          .maybeSingle();

        if (existingEmail) {
          return res.status(400).json({ error: "Email address already in use" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data, error } = await supabase
          .from("users")
          .insert([{
            username,
            password: hashedPassword,
            full_name: fullName,
            email,
            tier: 'free',
            daily_usage: 0,
            api_key: ''
          }])
          .select()
          .single();

        if (error) throw error;

        // Remove password from response
        const { password: _, ...userWithoutPassword } = data;
        res.json({ user: userWithoutPassword });
      } catch (error: any) {
        console.error("Signup error details:", JSON.stringify(error, null, 2));
        const errorMessage = error.message || error.details || "An unexpected error occurred during signup";
        res.status(500).json({ error: errorMessage });
      }
    });

    app.post("/api/auth/login", async (req, res) => {
      const { username, password } = req.body;
      const supabase = getSupabase();

      if (!supabase) {
        return res.status(500).json({ error: "Database not configured" });
      }

      try {
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("username", username)
          .maybeSingle();

        if (error || !user) {
          return res.status(401).json({ error: "Invalid username or password" });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ error: "Invalid username or password" });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      } catch (error: any) {
        console.error("Login error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/db-status", async (req, res) => {
      try {
        const isConfigured = !!process.env.VITE_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!isConfigured) {
          return res.json({ success: false, configured: false, message: "Supabase not configured" });
        }
        
        const supabase = getSupabase();
        if (!supabase) {
          return res.json({ success: false, configured: false, message: "Supabase client initialization failed" });
        }

        const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
          return res.json({ success: true, configured: true, connected: false, message: error.message });
        }
        
        res.json({ success: true, configured: true, connected: true });
      } catch (err: any) {
        console.error("DB Status check error:", err.message || err);
        res.json({ success: false, configured: true, connected: false, message: err.message || "DB error" });
      }
    });

    app.get("/api/debug/schema", async (req, res) => {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

      try {
        const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'quiz_history' });
        
        // If RPC fails (likely because it doesn't exist), try querying information_schema
        if (error) {
          const { data: columns, error: infoError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'quiz_history');
          
          if (infoError) throw infoError;
          return res.json({ table: 'quiz_history', columns });
        }
        
        res.json({ table: 'quiz_history', columns: data });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // API Routes
    app.post("/api/results", async (req, res) => {
      console.log("Received quiz result save request:", JSON.stringify(req.body, null, 2));
      const {
        totalQuestions,
        attempted,
        correct,
        wrong,
        accuracy,
        totalTime,
        avgTimePerQuestion,
        performanceSummary,
        topics,
        level,
        detailedReport,
        username
      } = req.body;

      if (!username) {
        console.error("Save result failed: No username provided in request body");
        return res.status(400).json({ error: "Username is required" });
      }

      try {
        console.log(`Looking up profile for username: ${username}`);
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single();

        if (profileError || !profile) {
          console.error(`User profile not found for username: ${username}`, profileError);
          return res.status(404).json({ error: "User profile not found" });
        }

        console.log(`Found profile ID: ${profile.id}. Inserting quiz history...`);
        
        const insertData = {
          user_id: profile.id,
          title: `Quiz on ${topics?.[0] || 'General Topic'}`,
          total_questions: totalQuestions,
          attempted: attempted,
          correct: correct,
          wrong: wrong,
          accuracy: accuracy,
          total_time: totalTime,
          avg_time_per_question: avgTimePerQuestion,
          performance_summary: performanceSummary,
          topics: topics || [],
          level: level || '',
          detailed_report: detailedReport || []
        };

        console.log("Attempting insert with data:", JSON.stringify(insertData, null, 2));

        const { data, error } = await supabase
          .from('quiz_history')
          .insert([insertData])
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }

        console.log("Successfully saved quiz result with ID:", data.id);
        res.json({ id: data.id });
      } catch (err: any) {
        console.error("Error saving result exception:", err.message || err);
        res.status(500).json({ error: "Failed to save result", details: err.message });
      }
    });

    app.get("/api/results", async (req, res) => {
      const { username } = req.query;
      console.log(`Fetching quiz results for username: ${username || 'all'}`);
      
      if (!getSupabase()) {
        console.warn("Supabase not configured, returning empty history");
        return res.json([]);
      }
      
      try {
        let query = supabase
          .from('quiz_history')
          .select('*, users!inner(username)');

        if (username) {
          query = query.eq('users.username', username);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error("Supabase fetch history error:", error);
          // Fallback: try fetching without the join if it fails (maybe relationship not set)
          if (username) {
             console.log("Attempting fallback fetch by looking up user ID first...");
             const { data: user } = await supabase.from('users').select('id').eq('username', username).single();
             if (user) {
               const { data: fallbackData, error: fallbackError } = await supabase
                 .from('quiz_history')
                 .select('*')
                 .eq('user_id', user.id)
                 .order('created_at', { ascending: false });
               
               if (!fallbackError) {
                 const formatted = fallbackData.map((r: any) => ({
                   ...r,
                   username: username,
                   totalQuestions: r.total_questions,
                   totalTime: r.total_time,
                   avgTimePerQuestion: r.avg_time_per_question,
                   performanceSummary: r.performance_summary,
                   detailedReport: r.detailed_report
                 }));
                 return res.json(formatted);
               }
             }
          }
          throw error;
        }

        console.log(`Successfully fetched ${data?.length || 0} history records`);
        const formattedData = data.map((r: any) => ({
          ...r,
          username: r.users.username,
          totalQuestions: r.total_questions,
          totalTime: r.total_time,
          avgTimePerQuestion: r.avg_time_per_question,
          performanceSummary: r.performance_summary,
          detailedReport: r.detailed_report
        }));

        res.json(formattedData);
      } catch (err: any) {
        console.error("Error fetching results exception:", err.message || err);
        res.status(500).json({ error: "Failed to fetch results", details: err.message });
      }
    });

    // Helper to check and reset usage for Supabase
    const getUpdatedUsageSupabase = async (profile: any, clientDate?: string) => {
      if (!profile) return 0;
      const now = new Date();
      
      const toISODate = (d: any) => {
        try {
          if (!d) return '';
          const date = new Date(d);
          if (isNaN(date.getTime())) return '';
          return date.toISOString().split('T')[0];
        } catch (e) {
          return '';
        }
      };

      const today = toISODate(clientDate || now);
      let lastResetDate = profile.last_reset_date || '';
      
      console.log(`Usage update for ${profile.username}: today=${today}, lastReset=${lastResetDate}, currentUsage=${profile.daily_usage}`);

      if (lastResetDate && (typeof lastResetDate === 'string') && (lastResetDate.includes(':') || lastResetDate.includes(' ') || !lastResetDate.includes('-'))) {
        const parseInput = (lastResetDate.includes('-') && lastResetDate.includes(':')) 
          ? lastResetDate + " UTC" 
          : lastResetDate;
        lastResetDate = toISODate(parseInput);
      }

      if (today && lastResetDate && today !== lastResetDate) {
        console.log(`Resetting usage for ${profile.username} (new day: ${today} vs ${lastResetDate})`);
        await supabase
          .from('users')
          .update({ daily_usage: 0, last_reset_date: today })
          .eq('id', profile.id);
        return 0;
      }
      
      if (!lastResetDate && today) {
        console.log(`Initializing reset date for ${profile.username} to ${today}`);
        await supabase
          .from('users')
          .update({ daily_usage: 0, last_reset_date: today })
          .eq('id', profile.id);
        return 0;
      }

      return profile.daily_usage || 0;
    };

    app.get("/api/me", async (req, res) => {
      const { username, clientDate } = req.query;
      if (!username) return res.status(400).json({ error: "Username required" });
      
      const isGuest = username === 'guest';

      if (!getSupabase() || isGuest) {
        return res.json({
          username: username as string,
          email: "",
          full_name: isGuest ? "Guest User" : username as string,
          bio: "",
          api_key: "",
          tier: "free",
          daily_usage: 0,
          id: isGuest ? "guest-id" : ""
        });
      }

      try {
        const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username as string)
        .single();

        if (error || !profile) {
          // Fallback for missing profile if it's not guest but still needs to work
          return res.json({
            username: username as string,
            email: "",
            full_name: username as string,
            bio: "",
            api_key: "",
            tier: "free",
            daily_usage: 0,
            id: ""
          });
        }

        const currentUsage = await getUpdatedUsageSupabase(profile, clientDate as string);
        res.json({
          username: profile.username,
          full_name: profile.full_name,
          bio: profile.bio,
          api_key: profile.api_key,
          tier: profile.tier,
          daily_usage: currentUsage,
          id: profile.id
        });
      } catch (err: any) {
        const errorMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.error("Error in /api/me:", errorMsg);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Usage tracking endpoint
    app.post("/api/usage/check", async (req, res) => {
      try {
        const { username, count } = req.body;
        const requestedCount = parseInt(String(count)) || 0;

        if (!username) {
          return res.status(400).json({ error: "Username is required" });
        }

        // Fetch profile to check usage and tier
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();
        
        if (error || !profile) {
          // If user doesn't exist, allow initial usage but don't track
          return res.json({ success: true, allowedCount: requestedCount, newUsage: requestedCount, limit: 50 });
        }

        const limit = profile.tier === 'pro' ? 500 : 50;
        const currentUsage = profile.daily_usage || 0;
        const remaining = Math.max(0, limit - currentUsage);

        if (remaining <= 0) {
          return res.json({ 
            success: false, 
            message: `Daily limit reached (${currentUsage}/${limit}). Try again tomorrow or upgrade to Pro!`,
            newUsage: currentUsage,
            limit
          });
        }

        // If requested is more than remaining, allow only the remaining amount
        const allowedCount = Math.min(requestedCount, remaining);
        const newUsage = currentUsage + allowedCount;

        // Update usage
        const { error: updateError } = await supabase
          .from('users')
          .update({ daily_usage: newUsage })
          .eq('id', profile.id);

        if (updateError) throw updateError;

        res.json({ success: true, allowedCount, newUsage, limit });
      } catch (err: any) {
        console.error("Usage check error:", err.message || err);
        // Fallback to success if DB fails, but log it
        res.json({ success: true, allowedCount: count, newUsage: 0, limit: 50, warning: "Database connection issue" });
      }
    });

    app.post("/api/usage/reset", async (req, res) => {
      try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: "Username required" });

        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !profile) return res.status(404).json({ error: "User not found" });

        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localDate = new Date(now.getTime() - (offset * 60 * 1000));
        const today = localDate.toISOString().split('T')[0];

        await supabase
          .from('users')
          .update({ daily_usage: 0, last_reset_date: today })
          .eq('id', profile.id);

        res.json({ success: true, message: "Usage reset successfully", newUsage: 0 });
      } catch (err: any) {
        console.error("Usage reset error:", err.message || err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/api/upgrade", async (req, res) => {
      const { username } = req.body;
      if (username === 'guest') {
        return res.json({ success: true, tier: 'pro' });
      }
      await supabase
        .from('users')
        .update({ tier: 'pro' })
        .eq('username', username);
      res.json({ success: true, tier: 'pro' });
    });

    app.post("/api/create-razorpay-order", async (req, res) => {
      const { amount } = req.body; // amount in INR

      if (!razorpay) {
        console.log("Razorpay not configured. Providing mock order.");
        return res.json({ 
          id: "mock_order_" + Date.now(), 
          amount: (amount || 1499) * 100,
          currency: "INR",
          isMock: true 
        });
      }

      try {
        const options = {
          amount: (amount || 1499) * 100, // amount in the smallest currency unit (paise)
          currency: "INR",
          receipt: "receipt_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
      } catch (error: any) {
        console.error("Razorpay order creation error:", error.message || error);
        res.status(500).json({ error: "Failed to create Razorpay order" });
      }
    });

    app.post("/api/verify-razorpay-payment", async (req, res) => {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        username,
        isMock
      } = req.body;

      if (isMock) {
        console.log(`Mock payment successful for user: ${username}. Upgrading to Pro...`);
        await supabase
          .from('users')
          .update({ tier: 'pro' })
          .eq('username', username);
        return res.json({ success: true });
      }

      if (!razorpay) {
        return res.status(500).json({ error: "Razorpay not configured" });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature === razorpay_signature) {
        console.log(`Razorpay payment verified for user: ${username}. Upgrading to Pro...`);
        await supabase
          .from('users')
          .update({ tier: 'pro' })
          .eq('username', username);
        
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, message: "Invalid signature" });
      }
    });


    // Global Error Handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("Global Error Handler:", err.message || err);
      res.status(500).json({ error: "Internal Server Error", message: err.message });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.join(__dirname, "dist")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "dist", "index.html"));
      });
    }

    console.log("Vite middleware attached.");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      const supabaseConfigured = !!process.env.VITE_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      console.log(`Supabase Status: ${supabaseConfigured ? "CONFIGURED" : "NOT CONFIGURED"}`);
    });
  } catch (err: any) {
    console.error("Failed to start server:", err.message || err);
    process.exit(1);
  }
}

startServer();
