// 配信停止リンクの署名（HMAC-SHA256）
// リンクの user_id を他人のものに書き換えても、署名が合わないので停止できない

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function signUnsubscribe(secret: string, userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`unsubscribe:${userId}`));
  return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyUnsubscribe(
  secret: string,
  userId: string,
  signature: string,
): Promise<boolean> {
  return timingSafeEqual(await signUnsubscribe(secret, userId), signature);
}

export async function buildUnsubscribeUrl(
  supabaseUrl: string,
  secret: string,
  userId: string,
): Promise<string> {
  const signature = await signUnsubscribe(secret, userId);
  return `${supabaseUrl}/functions/v1/unsubscribe?u=${encodeURIComponent(userId)}&s=${signature}`;
}
