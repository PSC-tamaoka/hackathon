// メールの文面（全体招待メール）
// タイトルや説明文は主催者（＝誰でも）が入力するので、HTML に入れる前に必ずエスケープする

export type InviteEvent = {
  event_id: number;
  title: string;
  description: string;
  event_date: string; // "2026-10-31"
  start_time: string; // "15:30"
  end_time: string; // "19:30"
  place: string;
  deadline: string; // timestamptz（ISO文字列）
  invite_token: string;
};

export type Recipient = {
  user_id: string;
  email: string;
  name: string;
};

export type EmailMessage = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

export type EmailSettings = {
  from: string; // 例: "渋川つながり <invite@example.com>"（Resend で認証済みのドメイン）
  inviteBaseUrl: string; // 例: "https://shibukawa.example.com" → /invite/<token>
  senderInfo: string; // 例: "渋川つながり運営チーム（info@example.com）"
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// "2026-10-31" → "2026年10月31日（土）"
export function formatEventDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
}

// timestamptz → 日本時間 "10月30日 23:59"
export function formatDeadline(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoTimestamp));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
}

export function inviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/invite/${token}`;
}

export function buildInviteEmail(
  event: InviteEvent,
  recipient: Recipient,
  unsubscribeUrl: string,
  settings: EmailSettings,
): EmailMessage {
  const url = inviteUrl(settings.inviteBaseUrl, event.invite_token);
  const date = `${formatEventDate(event.event_date)} ${event.start_time}〜${event.end_time}`;
  const deadline = formatDeadline(event.deadline);
  const [, month, day] = event.event_date.split("-").map(Number);

  const subject = `【ご招待】${event.title}（${month}月${day}日開催）`;

  const text = [
    `${recipient.name} さん`,
    "",
    "渋川つながりから、イベントのご案内です。",
    "海の学校で過ごした渋川の海で、もう一度集まりませんか。",
    "",
    `■ ${event.title}`,
    `日時：${date}`,
    `場所：${event.place}`,
    `申込締切：${deadline}`,
    "",
    event.description,
    "",
    "▼ 詳細・お申し込みはこちら",
    url,
    "",
    "――――――――――",
    "このメールは、渋川つながりで招待メールの受け取りを許可している方にお送りしています。",
    `配信停止：${unsubscribeUrl}`,
    settings.senderInfo,
  ].join("\n");

  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="ja">
<body style="margin:0;padding:24px;background:#f4f7f9;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;color:#1f2d3d;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    <p style="margin:0 0 16px;">${e(recipient.name)} さん</p>
    <p style="margin:0 0 20px;line-height:1.7;">渋川つながりから、イベントのご案内です。<br>海の学校で過ごした渋川の海で、もう一度集まりませんか。</p>
    <h1 style="font-size:20px;margin:0 0 12px;">${e(event.title)}</h1>
    <table style="border-collapse:collapse;margin:0 0 16px;font-size:15px;">
      <tr><td style="padding:4px 12px 4px 0;color:#5b6b7b;">日時</td><td style="padding:4px 0;">${e(date)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#5b6b7b;">場所</td><td style="padding:4px 0;">${e(event.place)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#5b6b7b;">申込締切</td><td style="padding:4px 0;">${e(deadline)}</td></tr>
    </table>
    <p style="margin:0 0 24px;line-height:1.7;">${e(event.description).replaceAll("\n", "<br>")}</p>
    <p style="margin:0 0 28px;">
      <a href="${e(url)}" style="display:inline-block;background:#0b6e8a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">詳細・お申し込み</a>
    </p>
    <hr style="border:none;border-top:1px solid #e3e8ec;margin:0 0 16px;">
    <p style="margin:0;font-size:12px;line-height:1.7;color:#5b6b7b;">
      このメールは、渋川つながりで招待メールの受け取りを許可している方にお送りしています。<br>
      今後の招待メールが不要な方は<a href="${e(unsubscribeUrl)}" style="color:#5b6b7b;">こちらから配信を停止</a>できます。<br>
      ${e(settings.senderInfo)}
    </p>
  </div>
</body>
</html>`;

  return {
    from: settings.from,
    to: [recipient.email],
    subject,
    html,
    text,
    headers: {
      // メールアプリの「配信停止」ボタン用（ワンクリック停止は POST で届く）
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
