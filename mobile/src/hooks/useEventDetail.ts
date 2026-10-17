import { useEffect, useRef, useState } from "react";
import { eventDetailRepository as repository } from "../repositories/eventDetail";
import type { Participation } from "../repositories/eventDetailRepository";
import type { EventSummary } from "../types/event";

export function useEventDetail(id: string) {
  const [event, setEvent] = useState<EventSummary>();
  const [participation, setParticipation] = useState<Participation>({ registered: false, completed: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const found = await repository.getEvent(id);
        const saved = found ? await repository.getParticipation(found) : undefined;
        if (!current) return;
        setEvent(found);
        if (saved) setParticipation(saved);
      } catch {
        if (current) setLoadError(true);
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; };
  }, [id, revision]);

  const save = async (operation: () => Promise<Participation>) => {
    if (locked.current || loading || loadError || !event) throw new Error("現在は操作できません。");
    locked.current = true;
    setSaving(true);
    try {
      const saved = await operation();
      if (mounted.current) setParticipation(saved);
      return saved;
    } finally {
      locked.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return {
    event, participation, loading, loadError, saving,
    retry: () => setRevision((value) => value + 1),
    complete: (missionId: string) => save(() => repository.completeMission(event!, missionId)),
    setRegistered: (registered: boolean) => save(() => repository.setRegistered(event!, registered)),
  };
}
