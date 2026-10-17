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
  /** 以下はバックエンド（src/lib/api.ts）から入る */
  isOrganizer?: boolean;
  isRegistered?: boolean;
  /** チェック済みの当日TODOのID */
  checkedTodoIds?: string[];
  /** 参加登録を受け付けているか(公開中・締切前・残席あり) */
  accepting?: boolean;
  status?: EventStatus;
  rainPolicy?: RainPolicy;
  tags?: string[];
};

export type EventStatus = "draft" | "published" | "canceled";

/** イベント作成フォーム(EventForm)の入力 */
export type NewEventInput = {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  place: string;
  placeDetail: string;
  capacity: number;
  scope: EventScope;
  rainPolicy: RainPolicy;
  tags: string[];
  draft?: boolean;
};

/** 招待の状況(O-03 招待画面) */
export type InviteStatus = {
  scope: EventScope;
  /** 全体招待メールの送信予定日(開催14日前, YYYY-MM-DD) */
  allInviteOn: string;
  allInviteSentAt: string | null;
  emailsSent: number;
  emailsFailed: number;
  registeredCount: number;
  linkOpenCount: number;
};

export type TodoItem = {
  id: string;
  text: string;
};
