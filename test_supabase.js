import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://iqmmznvsvabmrzaupgjf.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ejPrPSTFInDCOCvobcRsrw_SJNss7bD";

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Anon Key length:", supabaseAnonKey ? supabaseAnonKey.length : 0);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username')
      .limit(5);

    if (error) {
      console.error("Supabase query error:", error);
    } else {
      console.log("Successfully connected! Data sample:", data);
    }
  } catch (err) {
    console.error("Caught exception:", err);
  }
}

run();
