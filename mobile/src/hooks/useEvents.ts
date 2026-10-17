import { useCallback, useEffect, useState } from "react";
import { mockEvents } from "@/src/constants/mockEvents";
import { supabase } from "@/src/lib/supabase";
import type { EventSummary } from "@/src/types/event";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  reception_note: string | null;
  place: string;
  place_short: string | null;
  address: string | null;
  capacity: number;
  remaining: number;
  scope: "open" | "closed";
  tag_label: string | null;
  tag_tone: "tertiary" | "secondary" | null;
  cover_url: string | null;
};

function toEvent(r: EventRow): EventSummary {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    date: r.event_date,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    receptionNote: r.reception_note ?? undefined,
    place: r.place,
    placeShort: r.place_short ?? r.place,
    address: r.address ?? "",
    capacity: r.capacity,
    remaining: r.remaining,
    scope: r.scope,
    tag: { label: r.tag_label ?? "", tone: r.tag_tone ?? "secondary" },
    cover: r.cover_url ?? "",
  };
}

/** 公開中のイベント一覧(ホームのカレンダー用)。Supabase 未設定なら仮データを返す。 */
export function useEvents() {
  const [events, setEvents] = useState<EventSummary[]>(supabase ? [] : mockEvents);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .eq("is_hidden", false)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) setError("イベントを取得できませんでした");
    else {
      setError(null);
      setEvents((data as EventRow[]).map(toEvent));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { events, loading, error, reload };
}
