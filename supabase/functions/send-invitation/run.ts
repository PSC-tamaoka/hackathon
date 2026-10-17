// 全体招待メールの送信処理（本体）
// データベースとメール送信を外から渡す形にして、テストで差し替えられるようにしている
import type { EmailMessage, InviteEvent, Recipient } from "../_shared/templates.ts";
import { RESEND_BATCH_LIMIT, type SendBatch } from "../_shared/resend.ts";

export interface InviteDb {
  claimDueEvents(): Promise<InviteEvent[]>;
  recipients(eventId: number): Promise<Recipient[]>;
  reserve(eventId: number, userIds: string[]): Promise<string[]>;
  finish(eventId: number, userIds: string[], status: "sent" | "failed", error?: string): Promise<void>;
  complete(eventId: number, done: boolean): Promise<void>;
}

export type RunOptions = {
  maxEmails: number; // 1回の実行で送る上限（Resend 無料プランは1日100通）
  batchSize?: number; // 1リクエストの通数（最大100）
  dryRun?: boolean; // true なら送らずに宛先だけ返す
  makeMessage: (event: InviteEvent, recipient: Recipient) => Promise<EmailMessage>;
};

export type EventResult = {
  event_id: number;
  title: string;
  recipients: number; // まだ送っていない対象者の数
  sent: number;
  failed: number;
  done: boolean; // 全員に送り終えたか（false なら翌日の実行で続き）
  preview?: string[]; // dryRun のときの宛先
  error?: string;
};

export type RunResult = {
  dryRun: boolean;
  sent: number;
  failed: number;
  stoppedBySendError: boolean;
  events: EventResult[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function runAllInvites(
  db: InviteDb,
  sendBatch: SendBatch,
  options: RunOptions,
): Promise<RunResult> {
  const batchSize = Math.min(options.batchSize ?? RESEND_BATCH_LIMIT, RESEND_BATCH_LIMIT);
  const result: RunResult = {
    dryRun: options.dryRun === true,
    sent: 0,
    failed: 0,
    stoppedBySendError: false,
    events: [],
  };
  let budget = Math.max(0, options.maxEmails);

  const events = await db.claimDueEvents();

  for (const event of events) {
    const er: EventResult = {
      event_id: event.event_id,
      title: event.title,
      recipients: 0,
      sent: 0,
      failed: 0,
      done: false,
    };
    result.events.push(er);

    try {
      const recipients = await db.recipients(event.event_id);
      er.recipients = recipients.length;

      if (result.dryRun) {
        er.preview = recipients.map((r) => r.email);
        await db.complete(event.event_id, false); // 印を外すだけ
        continue;
      }

      // 送信エラーが出た後や上限に達した後は送らない（印を外して翌日に回す）
      const targets = result.stoppedBySendError ? [] : recipients.slice(0, budget);

      for (const group of chunk(targets, batchSize)) {
        // 送る直前に「送信中」として記録できた人だけに送る（二重送信防止）
        const reserved = new Set(await db.reserve(event.event_id, group.map((r) => r.user_id)));
        const toSend = group.filter((r) => reserved.has(r.user_id));
        if (toSend.length === 0) continue;

        const ids = toSend.map((r) => r.user_id);
        const messages = await Promise.all(toSend.map((r) => options.makeMessage(event, r)));
        budget -= toSend.length;

        try {
          await sendBatch(messages);
          await db.finish(event.event_id, ids, "sent");
          er.sent += toSend.length;
        } catch (err) {
          await db.finish(event.event_id, ids, "failed", String(err));
          er.failed += toSend.length;
          result.stoppedBySendError = true; // 上限超えなどの可能性があるので、この実行は止める
          break;
        }
      }

      er.done = !result.stoppedBySendError && targets.length === recipients.length;
      await db.complete(event.event_id, er.done);
    } catch (err) {
      er.error = String(err);
      await db.complete(event.event_id, false).catch(() => {});
    }

    result.sent += er.sent;
    result.failed += er.failed;
  }

  return result;
}
