import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { errorMessage, getEvent } from "@/src/lib/api";
import type { EventSummary } from "@/src/types/event";

/** イベント1件(詳細・残席・自分の出欠・TODOのチェック)。画面に戻るたびに読み直す */
export function useEvent(id: string | undefined, inviteToken?: string) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestId.current;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getEvent(id, inviteToken);
      if (request !== requestId.current) return;
      setEvent(result);
      setError(null);
    } catch (e) {
      if (request === requestId.current) setError(errorMessage(e));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [id, inviteToken]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => { requestId.current++; };
    }, [reload]),
  );

  return { event, setEvent, loading, error, reload };
}
