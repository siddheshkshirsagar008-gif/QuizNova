import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Supabase Client Initialization
// Use Service Role Key for server-side operations to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || "https://ynnehgwfmglsyshseqrs.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_BzkOLGOSMVL9DcFGU4_xMw_lHNg7wfs";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("WARNING: Supabase URL or Service Role Key is missing. Database operations may fail or be restricted by RLS.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  try {
    console.log("Supabase client initialized.");

    // Webhook needs raw body - MUST be before express.json()
    app.post("/api/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig as string,
          process.env.STRIPE_WEBHOOK_SECRET || ""
        );
      } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const username = session.metadata?.username;

        if (username) {
          console.log(`Payment successful for user: ${username}. Upgrading to Pro...`);
          await supabase.from("users").update({ tier: 'pro' }).eq("username", username);
          
          // --- DISTRIBUTION LOGIC (Internal to company) ---
          // 1. API Premium Allocation: ₹650 (Handled via Stripe payout settings or manual transfer)
          // 2. Company Account: ₹350 (Handled via Stripe payout settings)
          // 3. User Commission: ₹200 (Handled via Stripe payout settings)
          // 4. Buffer/Fees: ₹299
          console.log(`Funds distributed internally for session: ${session.id}`);
        }
      }

      res.json({ received: true });
    });

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // Request logging
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.url}`);
      next();
    });

    // Health check
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", nodeVersion: process.version, timestamp: new Date().toISOString() });
    });

    // Diagnostics endpoint to help solve server errors
    app.get("/api/diagnostics", async (req, res) => {
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        env: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
          hasSmtpUser: !!process.env.SMTP_USER,
          hasSmtpPass: !!process.env.SMTP_PASS,
        },
        services: {}
      };

      // Check Supabase
      try {
        const { data, error } = await supabase.from("users").select("count").limit(1);
        diagnostics.services.supabase = error ? { status: "error", message: error.message } : { status: "ok" };
      } catch (err: any) {
        diagnostics.services.supabase = { status: "error", message: err.message };
      }

      // Check Stripe
      diagnostics.services.stripe = stripe ? { status: "ok" } : { status: "not_configured" };

      // Check Nodemailer
      try {
        await transporter.verify();
        diagnostics.services.email = { status: "ok" };
      } catch (err: any) {
        diagnostics.services.email = { status: "error", message: err.message };
      }

      res.json(diagnostics);
    });

    // API Routes
    app.post("/api/results", async (req, res) => {
      try {
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
          detailedReport
        } = req.body;

        const { data, error } = await supabase.from("quiz_results").insert({
          total_questions: totalQuestions,
          attempted,
          correct,
          wrong,
          accuracy,
          total_time: totalTime,
          avg_time_per_question: avgTimePerQuestion,
          performance_summary: performanceSummary,
          topics: topics || null,
          level: level || null,
          detailed_report: detailedReport || null
        }).select();

        if (error) {
          console.error("Supabase Insert Error (results):", error);
          return res.status(500).json({ error: "Database error", message: error.message });
        }
        
        if (!data || data.length === 0) {
          return res.status(500).json({ error: "Database error", message: "No data returned after insert" });
        }

        res.json({ id: data[0].id });
      } catch (err: any) {
        console.error("API Results Error:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
      }
    });

    app.get("/api/results", async (req, res) => {
      try {
        const { data, error } = await supabase.from("quiz_results").select("*").order("created_at", { ascending: false });
        if (error) {
          console.error("Supabase Select Error (results):", error);
          return res.status(500).json({ error: "Database error", message: error.message });
        }
        res.json(data);
      } catch (err: any) {
        console.error("API Get Results Error:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
      }
    });

    app.get("/api/leaderboard", async (req, res) => {
      try {
        const { data, error } = await supabase.from("quiz_results")
          .select("*")
          .order("accuracy", { ascending: false })
          .order("total_time", { ascending: true })
          .limit(10);
        if (error) {
          console.error("Supabase Select Error (leaderboard):", error);
          return res.status(500).json({ error: "Database error", message: error.message });
        }
        res.json(data);
      } catch (err: any) {
        console.error("API Leaderboard Error:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
      }
    });

    // Helper to check and reset usage
    const getUpdatedUsage = async (user: any, clientDate?: string) => {
      if (!user) return 0;
      const now = new Date();
      
      // Helper to get YYYY-MM-DD from various formats
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

      // clientDate is usually from new Date().toDateString()
      const today = toISODate(clientDate || now);
      let lastResetDate = user.last_reset || '';
      
      // If it's not already in YYYY-MM-DD format
      if (lastResetDate && (typeof lastResetDate === 'string') && (lastResetDate.includes(':') || lastResetDate.includes(' ') || !lastResetDate.includes('-'))) {
        const parseInput = (lastResetDate.includes('-') && lastResetDate.includes(':')) 
          ? lastResetDate + " UTC" 
          : lastResetDate;
        lastResetDate = toISODate(parseInput);
      }

      if (today && lastResetDate && today !== lastResetDate) {
        await supabase.from("users").update({ daily_usage: 0, last_reset: today }).eq("id", user.id);
        return 0;
      }
      
      // If no last_reset at all, set it now
      if (!lastResetDate && today) {
        await supabase.from("users").update({ last_reset: today }).eq("id", user.id);
      }

      return user.daily_usage || 0;
    };

    app.get("/api/me", async (req, res) => {
      const { username, clientDate } = req.query;
      if (!username) return res.status(400).json({ error: "Username required" });
      
      const { data: user, error } = await supabase.from("users").select("*").ilike("username", username as string).single();
      if (error || !user) return res.status(404).json({ error: "User not found" });

      const currentUsage = await getUpdatedUsage(user, clientDate as string);
      res.json({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        api_key: user.api_key,
        tier: user.tier,
        daily_usage: currentUsage
      });
    });

    app.post("/api/login", async (req, res) => {
      try {
        const { username, password, clientDate } = req.body;
        const u = username?.trim();
        
        if (!u || !password) {
          return res.status(400).json({ success: false, message: "Username and password are required" });
        }

        const { data: user, error } = await supabase.from("users")
          .select("*")
          .or(`username.ilike.${u},email.ilike.${u}`)
          .eq("password", password)
          .single();

        if (error) {
          console.error("Supabase Login Error:", error);
          if (error.code === 'PGRST116') { // No rows returned
            return res.status(401).json({ success: false, message: "Invalid credentials" });
          }
          return res.status(500).json({ success: false, message: "Database error: " + error.message });
        }

        if (user) {
          if (!user.is_verified) {
            return res.status(403).json({ success: false, message: "Please verify your email before logging in." });
          }

          // Log login activity
          try {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            await supabase.from("login_activity").insert({
              user_id: user.id,
              ip_address: String(ip),
              user_agent: userAgent
            });
          } catch (logErr) {
            console.error("Failed to log login activity:", logErr);
          }

          const currentUsage = await getUpdatedUsage(user, clientDate);
          res.json({ 
            success: true, 
            user: { 
              username: user.username, 
              email: user.email, 
              full_name: user.full_name,
              bio: user.bio,
              api_key: user.api_key,
              tier: user.tier,
              daily_usage: currentUsage
            } 
          });
        } else {
          res.status(401).json({ success: false, message: "Invalid credentials" });
        }
      } catch (err: any) {
        console.error("Login Route Error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
      }
    });

    // Usage tracking endpoint
    app.post("/api/usage/check", async (req, res) => {
      try {
        const { username, count, clientDate } = req.body;
        const requestedCount = parseInt(String(count)) || 0;

        if (!username) {
          return res.status(400).json({ error: "Username is required" });
        }

        const { data: user, error } = await supabase.from("users").select("*").ilike("username", username).single();
        
        if (error || !user) {
          return res.status(404).json({ error: "User not found" });
        }

        const currentUsage = await getUpdatedUsage(user, clientDate);
        const limit = user.tier === 'pro' ? 2000 : 200;
        
        if (currentUsage + requestedCount > limit) {
          return res.status(403).json({ 
            error: "Daily limit reached", 
            limit, 
            current: currentUsage,
            tier: user.tier
          });
        }

        if (requestedCount > 0) {
          await supabase.from("users").update({ daily_usage: user.daily_usage + requestedCount }).ilike("username", username);
        }
        res.json({ success: true, newUsage: currentUsage + requestedCount, limit });
      } catch (err: any) {
        console.error("Usage check error:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
      }
    });

    app.post("/api/upgrade", async (req, res) => {
      const { username } = req.body;
      await supabase.from("users").update({ tier: 'pro' }).ilike("username", username);
      res.json({ success: true, tier: 'pro' });
    });

    app.post("/api/create-checkout-session", async (req, res) => {
      const { username, email } = req.body;
      const appUrl = process.env.APP_URL || "http://localhost:3000";

      // If Stripe is not configured, provide a mock checkout URL for testing
      if (!stripe) {
        console.log("Stripe not configured. Providing mock checkout URL.");
        return res.json({ 
          id: "mock_session_" + Date.now(), 
          url: `${appUrl}?payment=success&mock=true`,
          isMock: true 
        });
      }
      
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "inr",
                product_data: {
                  name: "QuizNova Pro Subscription",
                  description: "2,000 MCQs/day, Detailed AI Explanations, Zero Ads",
                },
                unit_amount: 149900, // ₹1,499.00
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer_email: email,
          metadata: {
            username,
          },
          success_url: `${appUrl}?payment=success`,
          cancel_url: `${appUrl}?payment=cancel`,
        });

        res.json({ id: session.id, url: session.url });
      } catch (err: any) {
        console.error("Stripe session creation failed:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/signup", async (req, res) => {
      try {
        const username = req.body.username?.trim();
        const email = req.body.email?.trim();
        const password = req.body.password;
        const fullName = req.body.fullName?.trim();
        
        // Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          return res.status(400).json({ success: false, message: "Please enter a valid email address" });
        }
        if (!password || password.length < 6) {
          return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
        }
        if (!username || username.length < 3) {
          return res.status(400).json({ success: false, message: "Username must be at least 3 characters long" });
        }

        const generateApiKey = () => {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          let key = "ql_";
          for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return key;
        };

        const apiKey = generateApiKey();
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        const { data, error } = await supabase.from("users").insert({
          username,
          email,
          password,
          full_name: fullName || null,
          api_key: apiKey,
          is_verified: false,
          verification_token: verificationToken
        }).select();

        if (error) {
          console.error("Supabase Signup Error:", error);
          if (error.message.includes("unique") || error.code === '23505') {
            return res.status(400).json({ success: false, message: "Username or Email already exists" });
          }
          return res.status(500).json({ success: false, message: "Database error: " + error.message });
        }

        // Send verification email
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        const verificationLink = `${appUrl}/api/verify-email?token=${verificationToken}`;
        
        try {
          if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            throw new Error("SMTP credentials not configured");
          }

          await transporter.sendMail({
            from: `"QuizNova" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Verify your email - QuizNova",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #4f46e5;">Welcome to QuizNova!</h2>
                <p>Thank you for signing up. Please verify your email address to get started.</p>
                <a href="${verificationLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Verify Email Address</a>
                <p style="font-size: 14px; color: #64748b;">If you didn't create an account, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #94a3b8;">Link: ${verificationLink}</p>
              </div>
            `,
          });
          res.json({ success: true, message: "Account created! Please check your email to verify your account." });
        } catch (mailErr: any) {
          console.error("Failed to send verification email:", mailErr);
          // In development/demo mode, we might want to auto-verify if email fails
          if (process.env.NODE_ENV !== 'production') {
             console.log("Auto-verifying user since email failed in non-production environment.");
             await supabase.from("users").update({ is_verified: true }).eq("email", email);
             return res.json({ success: true, message: "Account created! (Auto-verified for demo as email failed: " + mailErr.message + ")" });
          }
          res.json({ success: true, message: "Account created, but failed to send verification email. Please contact support. Error: " + mailErr.message });
        }
      } catch (err: any) {
        console.error("Signup Route Error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
      }
    });

    app.get("/api/verify-email", async (req, res) => {
      const { token } = req.query;
      if (!token) return res.status(400).send("Verification token is required");

      const { data: user, error } = await supabase.from("users").select("*").eq("verification_token", token).single();
      
      if (error || !user) {
        return res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ef4444;">Invalid or expired token</h1>
              <p>We couldn't verify your email. Please try signing up again or contact support.</p>
              <a href="/" style="color: #4f46e5;">Back to App</a>
            </body>
          </html>
        `);
      }

      await supabase.from("users").update({ is_verified: true, verification_token: null }).eq("id", user.id);

      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #10b981;">Email Verified Successfully!</h1>
            <p>Your email has been verified. You can now log in to the app.</p>
            <a href="/" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Go to Login</a>
          </body>
        </html>
      `);
    });

    app.post("/api/forgot-password", async (req, res) => {
      try {
        const email = req.body.email?.trim();
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const { data: user, error } = await supabase.from("users").select("*").ilike("email", email).single();
        
        if (error) {
          console.error("Supabase Forgot Password Error:", error);
          if (error.code === 'PGRST116') {
            return res.status(404).json({ success: false, message: "No account found with this email address." });
          }
          return res.status(500).json({ success: false, message: "Database error: " + error.message });
        }

        if (user) {
          res.json({ success: true, message: "User found. You can now reset your password." });
        } else {
          res.status(404).json({ success: false, message: "No account found with this email address." });
        }
      } catch (err: any) {
        console.error("Forgot Password Route Error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
      }
    });

    app.post("/api/reset-password", async (req, res) => {
      try {
        const email = req.body.email?.trim();
        const { newPassword } = req.body;
        
        if (!email || !newPassword) {
          return res.status(400).json({ success: false, message: "Email and new password are required" });
        }

        const { error } = await supabase.from("users").update({ password: newPassword }).ilike("email", email);
        
        if (error) {
          console.error("Supabase Reset Password Error:", error);
          return res.status(500).json({ success: false, message: "Database error: " + error.message });
        }

        res.json({ success: true, message: "Password reset successfully. You can now log in." });
      } catch (err: any) {
        console.error("Reset Password Route Error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
      }
    });

    app.post("/api/change-password", async (req, res) => {
      try {
        const { username, currentPassword, newPassword } = req.body;
        if (!username || !currentPassword || !newPassword) {
          return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const { data: user, error } = await supabase.from("users")
          .select("*")
          .ilike("username", username)
          .eq("password", currentPassword)
          .single();

        if (error) {
          console.error("Supabase Change Password Auth Error:", error);
          if (error.code === 'PGRST116') {
            return res.status(401).json({ success: false, message: "Incorrect current password" });
          }
          return res.status(500).json({ success: false, message: "Database error: " + error.message });
        }

        if (user) {
          const { error: updateError } = await supabase.from("users").update({ password: newPassword }).ilike("username", username);
          if (updateError) {
            console.error("Supabase Change Password Update Error:", updateError);
            return res.status(500).json({ success: false, message: "Failed to update password: " + updateError.message });
          }
          res.json({ success: true, message: "Password updated successfully" });
        } else {
          res.status(401).json({ success: false, message: "Incorrect current password" });
        }
      } catch (err: any) {
        console.error("Change Password Route Error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
      }
    });

    app.get("/api/login-activity", async (req, res) => {
      const { username } = req.query;
      if (!username) return res.status(400).json({ error: "Username required" });
      
      const { data: user, error } = await supabase.from("users").select("id").ilike("username", username as string).single();
      if (error || !user) return res.status(404).json({ error: "User not found" });

      const { data: activity, error: actError } = await supabase.from("login_activity")
        .select("*")
        .eq("user_id", user.id)
        .order("login_time", { ascending: false })
        .limit(20);
      
      if (actError) return res.status(500).json({ error: actError.message });
      res.json(activity);
    });

    // Global Error Handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("Global Error Handler:", err);
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

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
