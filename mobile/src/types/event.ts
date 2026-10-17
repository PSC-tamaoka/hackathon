export type EventScope = "open" | "closed";

export type RainPolicy = "showers_ok" | "severe_cancel" | "indoor_shift";

export type EventTag = {
  label: string;
  tone: "tertiary" | "secondary";
};

export type EventSummary = {
  id: string;
  title: string;
  description: string;
  /** 開催日(YYYY-MM-DD) */
  date: string;
  startTime: string;
  endTime: string;
  /** 受付開始時刻の補足(任意) */
  receptionNote?: string;
  place: string;
  placeShort: string;
  address: string;
  capacity: number;
  remaining: number;
  scope: EventScope;
  tag: EventTag;
  cover: string;
};

export type TodoItem = {
  id: string;
  text: string;
};
