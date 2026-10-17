import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { EventSummary } from "../types/event";
import { rallyPeriod, rallyWindow } from "../lib/eventRally";

export function useRallyPeriod(event: EventSummary) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const { start, end } = rallyWindow(event);
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const time = Date.now();
      setNow(time);
      clearTimeout(timer);
      const next = time < start ? start : time < end ? end : time + 60_000;
      // 境界時刻で更新。バックグラウンドから復帰した場合も再判定する。
      timer = setTimeout(refresh, Math.max(1, Math.min(60_000, next - time)));
    };
    refresh();
    const subscription = AppState.addEventListener("change", refresh);
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [event]);
  return rallyPeriod(event, now);
}
