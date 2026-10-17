// サーバー側（Edge Function）用の Supabase クライアント
// service_role 相当のキーを使うので RLS を通らない。アプリには絶対に入れない
import { createClient } from "npm:@supabase/supabase-js@2";

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}

// 旧形式 SUPABASE_SERVICE_ROLE_KEY と新形式 SUPABASE_SECRET_KEYS の両方に対応
function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      const value = parsed.default ?? Object.values(parsed)[0];
      if (typeof value === "string") return value;
    } catch {
      return keys;
    }
  }
  throw new Error("service_role のキーが見つかりません");
}

export function createServiceClient() {
  return createClient(requireEnv("SUPABASE_URL"), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
