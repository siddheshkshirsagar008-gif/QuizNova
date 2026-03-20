import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function checkConnection() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("Supabase environment variables are missing.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) {
      console.log("Database connection failed:", error.message);
    } else {
      console.log("Database is connected successfully.");
    }
  } catch (err: any) {
    console.log("Database connection error:", err.message);
  }
}

checkConnection();
