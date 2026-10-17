const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function toDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayLabel(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/** 例: 2025年10月12日 (日) */
export function formatJaDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${weekdayLabel(d)})`;
}

/** 例: 10/12 */
export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
