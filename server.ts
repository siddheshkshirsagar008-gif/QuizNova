import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import Stripe from "stripe";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  try {
    console.log("Initializing database...");
    const db = new Database("quiz_learner.db");

    db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_questions INTEGER,
        attempted INTEGER,
        correct INTEGER,
        wrong INTEGER,
        accuracy REAL,
        total_time INTEGER,
        avg_time_per_question REAL,
        performance_summary TEXT,
        topics TEXT,
        level TEXT,
        detailed_report TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        bio TEXT,
        api_key TEXT UNIQUE,
        tier TEXT DEFAULT 'free',
        daily_usage INTEGER DEFAULT 0,
        last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS login_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Add columns if they don't exist (migrations)
    try { db.exec("ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free'"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN daily_usage INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN full_name TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN bio TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (e) {}
    try { 
      db.exec("ALTER TABLE users ADD COLUMN last_reset DATETIME"); 
      db.prepare("UPDATE users SET last_reset = CURRENT_TIMESTAMP WHERE last_reset IS NULL").run();
    } catch (e) {}
    try { db.exec("ALTER TABLE quiz_results ADD COLUMN topics TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE quiz_results ADD COLUMN level TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE quiz_results ADD COLUMN detailed_report TEXT"); } catch (e) {}

    // Function to generate a random API key
    const generateApiKey = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let key = "smk_";
      for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return key;
    };

    // Insert the testing user if not exists
    const checkUser = db.prepare("SELECT * FROM users WHERE username = ?").get("SMKTech") as any;
    if (!checkUser) {
      db.prepare("INSERT INTO users (username, email, password, api_key) VALUES (?, ?, ?, ?)").run(
        "SMKTech", 
        "milindkshirsagar.mk@gmail.com", 
        "9850",
        generateApiKey()
      );
    } else if (!checkUser.api_key) {
      db.prepare("UPDATE users SET api_key = ? WHERE username = ?").run(generateApiKey(), "SMKTech");
    }
    console.log("Database initialized successfully.");

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
          db.prepare("UPDATE users SET tier = 'pro' WHERE username = ?").run(username);
          
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
      res.json({ status: "ok", nodeVersion: process.version });
    });

    // API Routes
    app.post("/api/results", (req, res) => {
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

      const stmt = db.prepare(`
        INSERT INTO quiz_results (
          total_questions, attempted, correct, wrong, accuracy, total_time, avg_time_per_question, performance_summary, topics, level, detailed_report
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        totalQuestions,
        attempted,
        correct,
        wrong,
        accuracy,
        totalTime,
        avgTimePerQuestion,
        performanceSummary,
        topics ? JSON.stringify(topics) : null,
        level || null,
        detailedReport ? JSON.stringify(detailedReport) : null
      );

      res.json({ id: result.lastInsertRowid });
    });

    app.get("/api/results", (req, res) => {
      const results = db.prepare("SELECT * FROM quiz_results ORDER BY created_at DESC").all();
      res.json(results);
    });

    app.get("/api/leaderboard", (req, res) => {
      const leaderboard = db.prepare(`
        SELECT * FROM quiz_results 
        ORDER BY accuracy DESC, total_time ASC 
        LIMIT 10
      `).all();
      res.json(leaderboard);
    });

    // Helper to check and reset usage
    const getUpdatedUsage = (user: any, clientDate?: string) => {
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
        db.prepare("UPDATE users SET daily_usage = 0, last_reset = ? WHERE id = ?").run(today, user.id);
        return 0;
      }
      
      // If no last_reset at all, set it now
      if (!lastResetDate && today) {
        db.prepare("UPDATE users SET last_reset = ? WHERE id = ?").run(today, user.id);
      }

      return user.daily_usage || 0;
    };

    app.get("/api/me", (req, res) => {
      const { username, clientDate } = req.query;
      if (!username) return res.status(400).json({ error: "Username required" });
      
      const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username as string) as any;
      if (!user) return res.status(404).json({ error: "User not found" });

      const currentUsage = getUpdatedUsage(user, clientDate as string);
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

    app.post("/api/login", (req, res) => {
      const { username, password, clientDate } = req.body;
      const u = username?.trim();
      const user = db.prepare("SELECT * FROM users WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) AND password = ?").get(u, u, password) as any;
      if (user) {
        // Log login activity
        try {
          const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
          const userAgent = req.headers['user-agent'];
          db.prepare("INSERT INTO login_activity (user_id, ip_address, user_agent) VALUES (?, ?, ?)").run(user.id, String(ip), userAgent);
        } catch (logErr) {
          console.error("Failed to log login activity:", logErr);
        }

        const currentUsage = getUpdatedUsage(user, clientDate);
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
    });

    // Usage tracking endpoint
    app.post("/api/usage/check", (req, res) => {
      try {
        const { username, count, clientDate } = req.body;
        const requestedCount = parseInt(String(count)) || 0;

        if (!username) {
          return res.status(400).json({ error: "Username is required" });
        }

        const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as any;
        
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const currentUsage = getUpdatedUsage(user, clientDate);
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
          db.prepare("UPDATE users SET daily_usage = daily_usage + ? WHERE username = ? COLLATE NOCASE").run(requestedCount, username);
        }
        res.json({ success: true, newUsage: currentUsage + requestedCount, limit });
      } catch (err: any) {
        console.error("Usage check error:", err);
        res.status(500).json({ error: "Internal server error", message: err.message });
      }
    });

    app.post("/api/upgrade", (req, res) => {
      const { username } = req.body;
      db.prepare("UPDATE users SET tier = 'pro' WHERE username = ?").run(username);
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
                  name: "SMKTech Pro Subscription",
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

    app.post("/api/signup", (req, res) => {
      const username = req.body.username?.trim();
      const email = req.body.email?.trim();
      const password = req.body.password;
      const fullName = req.body.fullName?.trim();
      try {
        const apiKey = generateApiKey();
        const stmt = db.prepare("INSERT INTO users (username, email, password, full_name, api_key) VALUES (?, ?, ?, ?, ?)");
        stmt.run(username, email, password, fullName || null, apiKey);
        res.json({ success: true, message: "Account created successfully", api_key: apiKey });
      } catch (err: any) {
        if (err.message.includes("UNIQUE constraint failed")) {
          res.status(400).json({ success: false, message: "Username or Email already exists" });
        } else {
          res.status(500).json({ success: false, message: "Server error" });
        }
      }
    });

    app.post("/api/forgot-password", (req, res) => {
      const email = req.body.email?.trim();
      console.log(`Forgot password request for email: [${email}]`);
      const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as any;
      if (user) {
        console.log(`User found for reset: ${user.username}`);
        res.json({ success: true, message: "User found. You can now reset your password." });
      } else {
        console.log(`No user found for email: [${email}]`);
        res.status(404).json({ success: false, message: "No account found with this email address." });
      }
    });

    app.post("/api/reset-password", (req, res) => {
      const email = req.body.email?.trim();
      const { newPassword } = req.body;
      console.log(`Resetting password for email: [${email}]`);
      const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as any;
      if (user) {
        db.prepare("UPDATE users SET password = ? WHERE email = ? COLLATE NOCASE").run(newPassword, email);
        console.log(`Password reset success for: ${user.username}`);
        res.json({ success: true, message: "Password reset successfully. You can now log in." });
      } else {
        console.log(`Reset failed: No user found for email: [${email}]`);
        res.status(404).json({ success: false, message: "User not found." });
      }
    });

    app.post("/api/change-password", (req, res) => {
      const { username, currentPassword, newPassword } = req.body;
      console.log(`Password change request for user: ${username}`);
      
      const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE AND password = ?").get(username, currentPassword) as any;
      if (user) {
        console.log(`User found, updating password for: ${username}`);
        db.prepare("UPDATE users SET password = ? WHERE username = ? COLLATE NOCASE").run(newPassword, username);
        res.json({ success: true, message: "Password updated successfully" });
      } else {
        console.log(`Password change failed: User not found or incorrect password for ${username}`);
        res.status(401).json({ success: false, message: "Incorrect current password" });
      }
    });

    app.get("/api/login-activity", (req, res) => {
      const { username } = req.query;
      if (!username) return res.status(400).json({ error: "Username required" });
      
      const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username as string) as any;
      if (!user) return res.status(404).json({ error: "User not found" });

      const activity = db.prepare(`
        SELECT * FROM login_activity 
        WHERE user_id = ? 
        ORDER BY login_time DESC 
        LIMIT 20
      `).all(user.id);
      
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
