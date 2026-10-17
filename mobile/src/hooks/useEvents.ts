import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { errorMessage, listEvents } from "@/src/lib/api";
import type { EventSummary } from "@/src/types/event";

/** カレンダー用：その月のイベント(month は 0 始まり)。画面に戻るたびに読み直す */
export function useEvents(year: number, month: number) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current; // 月を素早く切り替えたとき、古い結果で上書きしない
    setLoading(true);
    try {
      const result = await listEvents(year, month);
      if (id !== requestId.current) return;
      setEvents(result);
      setError(null);
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [year, month]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { events, loading, error, reload };
}
