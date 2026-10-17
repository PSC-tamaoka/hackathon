import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** `.env` が未設定なら null(その間は仮データで動く) */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
