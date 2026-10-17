import type { EventSummary } from "../types/event";

export type RallyPeriod = "before" | "active" | "expired";

/** 開催日は日本時間。端末のタイムゾーンに依存させない。 */
export function rallyWindow(event: Pick<EventSummary, "date" | "startTime">) {
  const start = Date.parse(`${event.date}T${event.startTime}:00+09:00`);
  const midnight = Date.parse(`${event.date}T00:00:00+09:00`);
  return { start, end: midnight + 2 * 24 * 60 * 60 * 1000 };
}

export function rallyPeriod(event: Pick<EventSummary, "date" | "startTime">, now = Date.now()): RallyPeriod {
  const { start, end } = rallyWindow(event);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "expired";
  return now < start ? "before" : now < end ? "active" : "expired";
}

export type RallyMission = {
  id: string;
  text: string;
  description: string;
  keyword: string;
};

/** 今回は全イベント共通・編集不可。キーワードは歌詞ではなく、この体験の合言葉。 */
export const rallyMissions: readonly RallyMission[] = [
  { id: "cutter", text: "カッター体験", description: "仲間と息を合わせて、カッターを漕いでみよう。", keyword: "挑戦" },
  { id: "net", text: "地引網体験", description: "力を合わせて網を引き、渋川の海を感じよう。", keyword: "協力" },
  { id: "song", text: "海事研修の歌に関する体験", description: "覚えているメロディーや、歌にまつわる思い出を話そう。", keyword: "歌声" },
  { id: "photo", text: "仲間との集合写真", description: "今日の仲間と、思い出に残る一枚を撮ろう。", keyword: "仲間" },
  { id: "memories", text: "当時の思い出を語り合う", description: "渋川で過ごしたあの日のエピソードを語り合おう。", keyword: "思い出" },
];
