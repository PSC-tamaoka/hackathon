// 招待メールの配信停止
//   GET  : メール本文のリンクから開いたとき
//   POST : メールアプリの「配信停止」ボタン（List-Unsubscribe のワンクリック停止）
// Edge Functions は HTML を返せない（text/plain に書き換えられる）ので、結果は文字だけで返す
import { createServiceClient } from "../_shared/supabase.ts";
import { verifyUnsubscribe } from "../_shared/unsubscribe.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return text("Method Not Allowed", 405);

  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const signature = url.searchParams.get("s") ?? "";
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") ?? "";

  if (!secret || !UUID.test(userId) || !(await verifyUnsubscribe(secret, userId, signature))) {
    return text("配信停止のリンクが正しくありません。", 400);
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("users").update({ notify_email: false }).eq("id", userId);
  if (error) {
    console.error(error);
    return text("配信停止に失敗しました。時間をおいてもう一度お試しください。", 500);
  }

  return text(
    "渋川つながりからの招待メールの配信を停止しました。\nアプリのマイページ（通知設定）から、いつでも再開できます。",
  );
});
