// deno test supabase/functions
import { strict as assert } from "node:assert";
import type { EmailMessage, InviteEvent, Recipient } from "../_shared/templates.ts";
import { type InviteDb, runAllInvites } from "./run.ts";

const event = (id: number): InviteEvent => ({
  event_id: id,
  title: `イベント${id}`,
  description: "説明",
  event_date: "2026-10-31",
  start_time: "15:30",
  end_time: "19:30",
  place: "岡山県渋川青年の家",
  deadline: "2026-10-30T14:59:00Z",
  invite_token: `token${id}`,
});

const people = (n: number, prefix = "u"): Recipient[] =>
  Array.from({ length: n }, (_, i) => ({ user_id: `${prefix}${i}`, email: `${prefix}${i}@example.com`, name: `会員${i}` }));

// 本物の DB と同じ振る舞いをする偽物（配信記録で二重送信を防ぐ）
function fakeDb(events: InviteEvent[], members: Record<number, Recipient[]>) {
  const deliveries = new Map<string, "sending" | "sent" | "failed">();
  const completed: Record<number, boolean> = {};
  const db: InviteDb = {
    claimDueEvents: () => Promise.resolve(events),
    recipients: (id) =>
      Promise.resolve(members[id].filter((r) => {
        const s = deliveries.get(`${id}:${r.user_id}`);
        return s === undefined || s === "failed";
      })),
    reserve: (id, ids) =>
      Promise.resolve(ids.filter((u) => {
        const key = `${id}:${u}`;
        const s = deliveries.get(key);
        if (s === undefined || s === "failed") {
          deliveries.set(key, "sending");
          return true;
        }
        return false;
      })),
    finish: (id, ids, status) => {
      ids.forEach((u) => deliveries.set(`${id}:${u}`, status));
      return Promise.resolve();
    },
    complete: (id, done) => {
      completed[id] = done;
      return Promise.resolve();
    },
  };
  return { db, deliveries, completed };
}

const makeMessage = (e: InviteEvent, r: Recipient): Promise<EmailMessage> =>
  Promise.resolve({ from: "x", to: [r.email], subject: e.title, html: "", text: "", headers: {} });

Deno.test("全員に送り終えたら完了になる（100通ずつに分けて送る）", async () => {
  const { db, completed } = fakeDb([event(1)], { 1: people(150) });
  const batches: number[] = [];
  const result = await runAllInvites(db, (m) => {
    batches.push(m.length);
    return Promise.resolve();
  }, { maxEmails: 1000, makeMessage });

  assert.deepEqual(batches, [100, 50]);
  assert.equal(result.sent, 150);
  assert.equal(completed[1], true);
});

Deno.test("1日の上限を超える分は翌日に回り、同じ人には二度送らない", async () => {
  const { db, completed } = fakeDb([event(1)], { 1: people(130) });
  const sentTo: string[] = [];
  const send = (m: EmailMessage[]) => {
    m.forEach((x) => sentTo.push(x.to[0]));
    return Promise.resolve();
  };

  const day1 = await runAllInvites(db, send, { maxEmails: 100, makeMessage });
  assert.equal(day1.sent, 100);
  assert.equal(completed[1], false); // 残り30人 → 翌日へ

  const day2 = await runAllInvites(db, send, { maxEmails: 100, makeMessage });
  assert.equal(day2.sent, 30);
  assert.equal(completed[1], true);
  assert.equal(new Set(sentTo).size, 130); // 重複なし
  assert.equal(sentTo.length, 130);
});

Deno.test("上限は複数のイベントで共有する", async () => {
  const { db, completed } = fakeDb([event(1), event(2)], { 1: people(80, "a"), 2: people(50, "b") });
  const result = await runAllInvites(db, () => Promise.resolve(), { maxEmails: 100, makeMessage });
  assert.equal(result.events[0].sent, 80);
  assert.equal(result.events[1].sent, 20);
  assert.equal(completed[1], true);
  assert.equal(completed[2], false);
});

Deno.test("送信に失敗したらその回は止め、失敗した人は次回もう一度送る", async () => {
  const { db, deliveries, completed } = fakeDb([event(1)], { 1: people(150) });
  let calls = 0;
  const failing = () => {
    calls++;
    return calls === 2 ? Promise.reject(new Error("Resend 429")) : Promise.resolve();
  };

  const first = await runAllInvites(db, failing, { maxEmails: 1000, makeMessage });
  assert.equal(first.sent, 100);
  assert.equal(first.failed, 50);
  assert.equal(first.stoppedBySendError, true);
  assert.equal(completed[1], false);
  assert.equal([...deliveries.values()].filter((s) => s === "failed").length, 50);

  const retry = await runAllInvites(db, () => Promise.resolve(), { maxEmails: 1000, makeMessage });
  assert.equal(retry.sent, 50); // 失敗した50人だけ
  assert.equal(completed[1], true);
});

Deno.test("dryRun では送らずに宛先だけ返し、印を外す", async () => {
  const { db, completed, deliveries } = fakeDb([event(1)], { 1: people(3) });
  let called = false;
  const result = await runAllInvites(db, () => {
    called = true;
    return Promise.resolve();
  }, { maxEmails: 100, dryRun: true, makeMessage });

  assert.equal(called, false);
  assert.deepEqual(result.events[0].preview, ["u0@example.com", "u1@example.com", "u2@example.com"]);
  assert.equal(completed[1], false);
  assert.equal(deliveries.size, 0);
});

Deno.test("対象者が0人なら、そのまま完了", async () => {
  const { db, completed } = fakeDb([event(1)], { 1: [] });
  await runAllInvites(db, () => Promise.resolve(), { maxEmails: 100, makeMessage });
  assert.equal(completed[1], true);
});
