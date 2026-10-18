// deno test supabase/functions
import { strict as assert } from "node:assert";
import { buildInviteEmail, formatDeadline, formatEventDate } from "./templates.ts";
import { createResendBatchSender } from "./resend.ts";
import { buildUnsubscribeUrl, signUnsubscribe, verifyUnsubscribe } from "./unsubscribe.ts";

const settings = {
  from: "Re:海学 <invite@example.jp>",
  inviteBaseUrl: "https://shibukawa.example.com/",
  senderInfo: "Re:海学運営チーム",
};

const event = {
  event_id: 1,
  title: '<script>alert("x")</script>同窓会',
  description: "カッター\n地引網",
  event_date: "2026-10-31",
  start_time: "15:30",
  end_time: "19:30",
  place: "岡山県渋川青年の家",
  deadline: "2026-10-30T14:59:00Z",
  invite_token: "abc123",
};

Deno.test("日付は日本語・日本時間で表示する", () => {
  assert.equal(formatEventDate("2026-10-31"), "2026年10月31日（土）");
  assert.equal(formatDeadline("2026-10-30T14:59:00Z"), "10月30日 23:59");
});

Deno.test("招待メール：リンク・件名・配信停止ヘッダー", () => {
  const mail = buildInviteEmail(event, { user_id: "u1", email: "a@example.com", name: "花子" }, "https://x/unsub", settings);
  assert.deepEqual(mail.to, ["a@example.com"]);
  assert.ok(mail.subject.startsWith("【ご招待】"));
  assert.ok(mail.subject.endsWith("（10月31日開催）"));
  assert.ok(mail.text.includes("https://shibukawa.example.com/invite/abc123"));
  assert.ok(mail.text.includes("日時：2026年10月31日（土） 15:30〜19:30"));
  assert.ok(mail.html.includes('href="https://shibukawa.example.com/invite/abc123"'));
  assert.equal(mail.headers["List-Unsubscribe"], "<https://x/unsub>");
});

Deno.test("主催者が入力した文字は HTML としてエスケープされる", () => {
  const mail = buildInviteEmail(event, { user_id: "u1", email: "a@example.com", name: "<b>花子</b>" }, "https://x/unsub", settings);
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.ok(!mail.html.includes("<b>花子</b>"));
  assert.ok(mail.html.includes("カッター<br>地引網"));
});

Deno.test("配信停止リンクの署名：本人のものだけ通る", async () => {
  const sig = await signUnsubscribe("secret", "user-a");
  assert.equal(await verifyUnsubscribe("secret", "user-a", sig), true);
  assert.equal(await verifyUnsubscribe("secret", "user-b", sig), false); // 他人の ID に書き換え
  assert.equal(await verifyUnsubscribe("other", "user-a", sig), false); // 別の鍵
  const url = await buildUnsubscribeUrl("https://p.supabase.co", "secret", "user-a");
  assert.equal(url, `https://p.supabase.co/functions/v1/unsubscribe?u=user-a&s=${sig}`);
});

Deno.test("Resend への送信内容と、エラー時の例外", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  const okFetch = ((url: string, init: RequestInit) => {
    captured = { url, init };
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as unknown as typeof fetch;
  const mail = buildInviteEmail(event, { user_id: "u1", email: "a@example.com", name: "花子" }, "https://x/unsub", settings);

  await createResendBatchSender("re_test", okFetch)([mail]);
  assert.equal(captured!.url, "https://api.resend.com/emails/batch");
  assert.equal((captured!.init.headers as Record<string, string>).Authorization, "Bearer re_test");
  const body = JSON.parse(captured!.init.body as string);
  assert.equal(body.length, 1);
  assert.deepEqual(body[0].to, ["a@example.com"]);

  const ngFetch = (() => Promise.resolve(new Response("daily quota", { status: 429 }))) as unknown as typeof fetch;
  await assert.rejects(createResendBatchSender("re_test", ngFetch)([mail]), /Resend 429/);
  await assert.rejects(createResendBatchSender("re_test", okFetch)(Array(101).fill(mail)), /100通まで/);
});
