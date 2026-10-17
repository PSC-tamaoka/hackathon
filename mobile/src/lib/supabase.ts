import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase の接続先が未設定（.env が空）のときは、仮データ（mockEvents）で動かす */
export const isMock = !url || !anonKey;

/** Supabase クライアント（ここ以外で作らない）。仮データで動かすときは null */
export const supabase: SupabaseClient | null = isMock
  ? null
  : createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

// アプリが前面にあるときだけログインの更新を続ける（Supabase 公式の推奨）
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
