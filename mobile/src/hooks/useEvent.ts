import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { errorMessage, getEvent } from "@/src/lib/api";
import type { EventSummary } from "@/src/types/event";

/** イベント1件(詳細・残席・自分の出欠・TODOのチェック)。画面に戻るたびに読み直す */
export function useEvent(id: string | undefined, inviteToken?: string) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEvent(await getEvent(id, inviteToken));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, inviteToken]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { event, setEvent, loading, error, reload };
}
