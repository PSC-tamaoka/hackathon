// Resend のバッチ送信（1回のリクエストで最大100通）
import type { EmailMessage } from "./templates.ts";

export const RESEND_BATCH_LIMIT = 100;

export type SendBatch = (messages: EmailMessage[]) => Promise<void>;

export function createResendBatchSender(apiKey: string, fetchFn: typeof fetch = fetch): SendBatch {
  return async (messages) => {
    if (messages.length === 0) return;
    if (messages.length > RESEND_BATCH_LIMIT) {
      throw new Error(`1回に送れるのは${RESEND_BATCH_LIMIT}通までです（${messages.length}通）`);
    }
    const res = await fetchFn("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      // 429 = 送信の上限（1秒あたりのリクエスト数、または1日の通数）
      throw new Error(`Resend ${res.status}: ${await res.text()}`);
    }
  };
}
