import type { EventSummary } from "../types/event";
import { rallyMissions, rallyPeriod } from "../lib/eventRally";

export type Participation = { registered: boolean; completed: string[] };
export type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
};

/** Supabase接続時はこの契約の実装を置換する。本人・参加資格・期限はサーバーでも検証すること。 */
export interface EventDetailRepository {
  getEvent(id: string): Promise<EventSummary | undefined>;
  getParticipation(event: EventSummary): Promise<Participation>;
  setRegistered(event: EventSummary, registered: boolean): Promise<Participation>;
  completeMission(event: EventSummary, missionId: string): Promise<Participation>;
}

export function createMockEventDetailRepository(
  storage: Storage,
  events: readonly EventSummary[],
  participantId: string,
  now: () => number = Date.now,
): EventDetailRepository {
  // イベントID・開催日・モック参加者を分離。別イベント／別開催回の進捗は混ぜない。
  const key = (event: EventSummary) => `event-detail:v1:${participantId}:${event.id}:${event.date}`;
  const load = async (event: EventSummary): Promise<Participation> => {
    const raw = await storage.getItem(key(event));
    if (raw === null) return { registered: true, completed: [] };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || !("registered" in data) || typeof data.registered !== "boolean"
      || !("completed" in data) || !Array.isArray(data.completed)
      || !data.completed.every((id: unknown) => typeof id === "string")) {
      throw new Error("保存済みの参加情報を読み込めませんでした。");
    }
    return { registered: data.registered, completed: [...new Set(data.completed as string[])].filter((id) => rallyMissions.some((m) => m.id === id)) };
  };
  // 連打や複数の更新で、読み取り→保存が競合しないように直列化する。
  let pending: Promise<unknown> = Promise.resolve();
  const update = (event: EventSummary, change: (current: Participation) => Participation): Promise<Participation> => {
    const operation = pending.then(async () => {
      const next = change(await load(event));
      await storage.setItem(key(event), JSON.stringify(next));
      return next;
    });
    pending = operation.catch(() => undefined);
    return operation;
  };
  return {
    getEvent: async (id) => events.find((event) => event.id === id),
    getParticipation: load,
    setRegistered: (event, registered) => update(event, (current) => ({ ...current, registered })),
    completeMission: (event, missionId) => update(event, (current) => {
      if (rallyPeriod(event, now()) !== "active") throw new Error("ミッションの利用時間外です。");
      if (!current.registered) throw new Error("参加登録が必要です。");
      if (!rallyMissions.some((mission) => mission.id === missionId)) throw new Error("ミッションが見つかりません。");
      // 二重送信をしても1件にする。取消のAPIは提供しない。
      return { ...current, completed: [...new Set([...current.completed, missionId])] };
    }),
  };
}
