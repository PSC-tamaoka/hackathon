import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { completeRallyMission, errorMessage, getRallyProgress } from "@/src/lib/api";

/** 呼び出し元をユーザー・イベントごとにkeyで分け、別の人の進捗を表示しない。 */
export function useRallyProgress(eventId: string) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestId.current++; };
  }, []);

  const reload = useCallback(async () => {
    if (locked.current) return;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const result = await getRallyProgress(eventId);
      if (!mounted.current || request !== requestId.current) return;
      setCompleted(result);
      setError(null);
    } catch (cause) {
      if (mounted.current && request === requestId.current) setError(errorMessage(cause));
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => {
    void reload();
    return () => { requestId.current++; };
  }, [reload]));

  const complete = async (missionId: string) => {
    if (locked.current || loading || error) throw new Error("進捗を読み込んでからお試しください。");
    locked.current = true;
    setSaving(true);
    try {
      const result = await completeRallyMission(eventId, missionId);
      if (mounted.current) setCompleted(result);
      return result;
    } finally {
      locked.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return { completed, loading, error, saving, reload, complete };
}
