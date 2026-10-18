// 全体招待メールを送る Edge Function（公開形式がオープンのイベント）
// pg_cron から毎日1回呼ばれる（supabase/cron.sql）。手動で試すときは supabase/README.md を参照
//
// 必要なシークレット（supabase secrets set で登録）
//   CRON_SECRET          pg_cron から呼ばれたことの確認用（Vault の cron_secret と同じ値）
//   RESEND_API_KEY       Resend の API キー
//   MAIL_FROM            送信元。例: Re:海学 <invite@your-domain.jp>（Resend で認証済みのドメイン）
//   INVITE_BASE_URL      招待ページの URL の頭。例: https://shibukawa.example.com
//   UNSUBSCRIBE_SECRET   配信停止リンクの署名用（長いランダム文字列）
//   MAIL_SENDER_INFO     メール末尾の運営者表記（任意）
//   MAX_EMAILS_PER_RUN   1回に送る上限（任意。既定 100）
import { createServiceClient, requireEnv } from "../_shared/supabase.ts";
import { buildInviteEmail, type InviteEvent, type Recipient } from "../_shared/templates.ts";
import { createResendBatchSender } from "../_shared/resend.ts";
import { buildUnsubscribeUrl } from "../_shared/unsubscribe.ts";
import { type InviteDb, runAllInvites } from "./run.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    // pg_cron からの呼び出しか確認（この関数は verify_jwt = false にしている）
    const secret = req.headers.get("x-cron-secret") ?? "";
    if (!timingSafeEqual(secret, requireEnv("CRON_SECRET"))) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabase = createServiceClient();

    const db: InviteDb = {
      async claimDueEvents() {
        const { data, error } = await supabase.rpc("claim_due_all_invites", { p_lead_days: 14 });
        if (error) throw error;
        return (data ?? []) as InviteEvent[];
      },
      async recipients(eventId) {
        const { data, error } = await supabase.rpc("all_invite_recipients", { p_event_id: eventId });
        if (error) throw error;
        return (data ?? []) as Recipient[];
      },
      async reserve(eventId, userIds) {
        const { data, error } = await supabase.rpc("reserve_invite_deliveries", {
          p_event_id: eventId,
          p_user_ids: userIds,
        });
        if (error) throw error;
        return (data ?? []) as string[];
      },
      async finish(eventId, userIds, status, errorText) {
        const { error } = await supabase.rpc("finish_invite_deliveries", {
          p_event_id: eventId,
          p_user_ids: userIds,
          p_status: status,
          p_error: errorText ?? null,
        });
        if (error) throw error;
      },
      async complete(eventId, done) {
        const { error } = await supabase.rpc("complete_all_invite", { p_event_id: eventId, p_done: done });
        if (error) throw error;
      },
    };

    const unsubscribeSecret = requireEnv("UNSUBSCRIBE_SECRET");
    const settings = {
      from: requireEnv("MAIL_FROM"),
      inviteBaseUrl: requireEnv("INVITE_BASE_URL"),
      senderInfo: Deno.env.get("MAIL_SENDER_INFO") ?? "Re:海学運営チーム",
    };

    const result = await runAllInvites(db, createResendBatchSender(requireEnv("RESEND_API_KEY")), {
      maxEmails: Number(Deno.env.get("MAX_EMAILS_PER_RUN") ?? 100),
      dryRun: body?.dryRun === true,
      makeMessage: async (event, recipient) =>
        buildInviteEmail(
          event,
          recipient,
          await buildUnsubscribeUrl(supabaseUrl, unsubscribeSecret, recipient.user_id),
          settings,
        ),
    });

    console.log(JSON.stringify({ sent: result.sent, failed: result.failed, events: result.events.length }));
    return json(result);
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
