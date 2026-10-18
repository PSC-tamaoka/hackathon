// バックエンド(Supabase)との通信をここにまとめる。画面はこのファイルの関数だけを呼ぶ。
// Supabase の接続先が未設定のときは、仮データ(mockEvents)で同じように動く。
// RPC の一覧と中身は docs/api.md と supabase/migrations/ を参照
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { images } from "@/src/constants/images";
import { mockEvents } from "@/src/constants/mockEvents";
import type {
  EventScope,
  EventStatus,
  EventSummary,
  InviteStatus,
  NewEventInput,
  RainPolicy,
} from "@/src/types/event";
import { isMock, supabase } from "./supabase";
import { rallyMissions, rallyPeriod } from "./eventRally";

export { isMock };

// ---------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------

/** RPC が返すイベント1件の形(supabase/migrations/..._rpc_events.sql の event_cards) */
type EventRow = {
  id: number;
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  reception_note: string | null;
  place: string;
  place_detail: string | null;
  address: string;
  capacity: number;
  remaining: number;
  scope: EventScope;
  rain_policy: RainPolicy;
  tags: string[];
  cover_url: string | null;
  status: EventStatus;
  is_organizer: boolean;
  is_registered: boolean;
  checked_todo_ids: string[];
  accepting: boolean;
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "通信に失敗しました。もう一度お試しください。";
}

function client() {
  if (!supabase) throw new Error("Supabase が未設定です");
  return supabase;
}

/** RPC を呼ぶ。データベース側の日本語のエラー文をそのまま Error にする */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function coverFor(tags: string[]): string {
  if (tags.some((t) => t.includes("地引網"))) return images.jibikiCover;
  if (tags.some((t) => t.includes("カッター"))) return images.cutterCover;
  if (tags.some((t) => t.includes("座談会"))) return images.beachTalkCover;
  return images.cutterCover;
}

function toSummary(r: EventRow): EventSummary {
  const place = r.place_detail ? `${r.place} ${r.place_detail}` : r.place;
  return {
    id: String(r.id),
    title: r.title,
    description: r.description,
    date: r.event_date,
    startTime: r.start_time,
    endTime: r.end_time,
    receptionNote: r.reception_note ?? undefined,
    place,
    placeShort: place,
    address: r.address,
    capacity: r.capacity,
    remaining: r.remaining,
    scope: r.scope,
    tag: {
      label: r.tags[0] ?? (r.scope === "open" ? "全員参加OK" : "招待制"),
      tone: r.scope === "open" ? "tertiary" : "secondary",
    },
    cover: r.cover_url ?? coverFor(r.tags),
    isOrganizer: r.is_organizer,
    isRegistered: r.is_registered,
    checkedTodoIds: r.checked_todo_ids,
    accepting: r.accepting,
    status: r.status,
    rainPolicy: r.rain_policy,
    tags: r.tags,
  };
}

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}

/** 招待ページの URL。EXPO_PUBLIC_INVITE_BASE_URL があればそれを、なければアプリのリンクを使う */
export function inviteUrl(token: string): string {
  const base = process.env.EXPO_PUBLIC_INVITE_BASE_URL;
  return base ? `${base.replace(/\/+$/, "")}/invite/${token}` : Linking.createURL(`/invite/${token}`);
}

// ---------------------------------------------------------------------
// 仮データ(Supabase 未設定のとき)
// ---------------------------------------------------------------------
const mock = {
  events: mockEvents.map<EventSummary>((e) => ({
    ...e,
    isOrganizer: false,
    isRegistered: true,
    checkedTodoIds: ["t1", "t2"],
    accepting: true,
    status: "published",
  })),
  seq: 0,
  rallyProgress: new Map<string, string[]>(),
};

function mockFind(id: string): EventSummary {
  const e = mock.events.find((x) => x.id === id);
  if (!e) throw new Error("イベントが見つかりません");
  return e;
}

// ---------------------------------------------------------------------
// ログイン(P-01)。メールアドレス＋パスワード
// Supabase の Authentication > Sign In / Providers で「Confirm email」をオフにしておく
// ---------------------------------------------------------------------
export type SignUpInput = {
  email: string;
  password: string;
  name: string;
  ageGroup: string;
  city: string;
  experienceYear: number;
  schoolName: string;
};

function authMessage(message: string): string {
  if (/Invalid login credentials/i.test(message)) return "メールアドレスかパスワードが違います。";
  if (/already registered|already been registered/i.test(message))
    return "このメールアドレスは登録済みです。「ログイン」からお入りください。";
  if (/Password should be at least|weak password/i.test(message)) return "パスワードは6文字以上にしてください。";
  if (/Email not confirmed/i.test(message))
    return "メールアドレスの確認が済んでいません。Supabase の設定で Confirm email をオフにしてください。";
  if (/rate limit/i.test(message)) return "短時間に操作が続いたため、少し時間をおいてお試しください。";
  return message;
}

export async function signUp(input: SignUpInput): Promise<void> {
  if (isMock) return;
  const { data, error } = await client().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // データベースのトリガーがこの値から users / shibukawa_experiences を作る
      data: {
        name: input.name,
        nickname: input.name,
        age_group: input.ageGroup,
        city: input.city,
        experience_year: input.experienceYear,
        school_name: input.schoolName,
      },
    },
  });
  if (error) throw new Error(authMessage(error.message));
  if (!data.session) {
    throw new Error("登録しました。メールの確認が必要な設定です（Supabase で Confirm email をオフにしてください）。");
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (isMock) return;
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw new Error(authMessage(error.message));
}

export async function signOut(): Promise<void> {
  if (isMock) return;
  const auth = client().auth;
  const { error } = await auth.signOut({ scope: "local" });
  if (!error) return;
  // 通信エラーでも Supabase が端末のセッションを破棄する場合がある。
  // 破棄済みなら完了とし、ログイン画面へ戻れるようにする。
  const { data, error: sessionError } = await auth.getSession();
  if (sessionError || data.session) throw new Error(authMessage(error.message));
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ---------------------------------------------------------------------
// イベント
// ---------------------------------------------------------------------

/** カレンダー用：その月のイベント(month は 0 始まり) */
export async function listEvents(year: number, month: number): Promise<EventSummary[]> {
  const { from, to } = monthRange(year, month);
  if (isMock) return mock.events.filter((e) => e.date >= from && e.date <= to).map((e) => ({ ...e }));
  const rows = await rpc<EventRow[]>("list_events", { p_from: from, p_to: to });
  return rows.map(toSummary);
}

/** イベント詳細。招待制は招待リンクのトークンを付けると申込前でも見られる */
export async function getEvent(id: string, inviteToken?: string): Promise<EventSummary | null> {
  if (isMock) {
    const e = mock.events.find((x) => x.id === id);
    return e ? { ...e } : null; // 画面が変化に気づけるよう、毎回コピーを返す
  }
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) return null;
  const rows = await rpc<EventRow[]>("get_event", { p_event_id: eventId, p_invite_token: inviteToken ?? null });
  return rows[0] ? toSummary(rows[0]) : null;
}

/** イベントを作る(O-02)。作った人が主催者になる。作ったイベントの ID を返す */
export async function createEvent(input: NewEventInput): Promise<string> {
  if (isMock) {
    const id = `local-${++mock.seq}`;
    mock.events.push({
      id,
      title: input.title,
      description: "",
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      place: input.placeDetail ? `${input.place} ${input.placeDetail}` : input.place,
      placeShort: input.place,
      address: "玉野市渋川",
      capacity: input.capacity,
      remaining: input.capacity,
      scope: input.scope,
      tag: { label: input.tags[0] ?? "全員参加OK", tone: input.scope === "open" ? "tertiary" : "secondary" },
      cover: coverFor(input.tags),
      isOrganizer: true,
      isRegistered: false,
      checkedTodoIds: [],
      accepting: true,
      status: input.draft ? "draft" : "published",
      tags: input.tags,
    });
    return id;
  }
  const { data, error } = await client()
    .from("events")
    .insert({
      title: input.title,
      event_date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      place: input.place,
      place_detail: input.placeDetail || null,
      capacity: input.capacity,
      scope: input.scope,
      rain_policy: input.rainPolicy,
      tags: input.tags,
      status: input.draft ? "draft" : "published",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String((data as { id: number }).id);
}

// ---------------------------------------------------------------------
// 出欠・当日のTODO
// ---------------------------------------------------------------------

/** 参加する。招待制は招待リンクのトークンが必要 */
export async function applyEvent(id: string, inviteToken?: string): Promise<void> {
  if (isMock) {
    const e = mockFind(id);
    if (e.isRegistered) throw new Error("すでに参加登録済みです");
    if (e.remaining <= 0) throw new Error("定員に達しました（残り0名）");
    e.isRegistered = true;
    e.remaining -= 1;
    return;
  }
  await rpc("apply_event", { p_event_id: Number(id), p_invite_token: inviteToken ?? null });
}

/** 参加をとりやめる */
export async function cancelRegistration(id: string): Promise<void> {
  if (isMock) {
    const e = mockFind(id);
    if (!e.isRegistered) throw new Error("参加登録がありません");
    e.isRegistered = false;
    e.remaining += 1;
    return;
  }
  await rpc("cancel_registration", { p_event_id: Number(id) });
}

/** 当日のTODOをチェックする・外す。チェック済みのIDの一覧を返す(イベント当日だけ) */
export async function checkTodo(id: string, todoId: string, checked: boolean): Promise<string[]> {
  if (isMock) {
    const e = mockFind(id);
    const set = new Set(e.checkedTodoIds ?? []);
    if (checked) set.add(todoId);
    else set.delete(todoId);
    e.checkedTodoIds = [...set].sort();
    return e.checkedTodoIds;
  }
  return rpc<string[]>("check_todo", { p_event_id: Number(id), p_todo_id: todoId, p_checked: checked });
}

/** 本人のラリー進捗。旧TODOのチェックとは別の記録を返す。 */
export async function getRallyProgress(id: string): Promise<string[]> {
  if (isMock) {
    const event = mockFind(id);
    return [...(mock.rallyProgress.get(`${event.id}:${event.date}`) ?? [])];
  }
  return rpc<string[]>("get_rally_progress", { p_event_id: Number(id) });
}

/** ミッション達成。本人の参加資格・期間をDBで確認し、保存済みのID一覧を返す。 */
export async function completeRallyMission(id: string, missionId: string): Promise<string[]> {
  if (!rallyMissions.some((mission) => mission.id === missionId)) throw new Error("ミッションが見つかりません");
  if (isMock) {
    const event = mockFind(id);
    if (!event.isRegistered) throw new Error("参加登録が必要です");
    if (event.status !== "published") throw new Error("このイベントではミッションを達成できません");
    if (rallyPeriod(event) !== "active") throw new Error("ミッションの利用時間外です");
    const key = `${event.id}:${event.date}`;
    const completed = [...new Set([...(mock.rallyProgress.get(key) ?? []), missionId])].sort();
    mock.rallyProgress.set(key, completed);
    return [...completed];
  }
  return rpc<string[]>("complete_rally_mission", { p_event_id: Number(id), p_mission_id: missionId });
}

// ---------------------------------------------------------------------
// 招待
// ---------------------------------------------------------------------

/** 招待リンクの URL(共有・コピー・QRコード用)。regenerate は主催者だけ */
export async function getInviteUrl(id: string, regenerate = false): Promise<string> {
  // 作り直したリンクは末尾に「~番号」を付ける(イベントID「local-1」の「-1」と区別するため)
  if (isMock) return inviteUrl(`mock-${id}${regenerate ? `~${++mock.seq}` : ""}`);
  const token = await rpc<string>("create_invite_link", { p_event_id: Number(id), p_regenerate: regenerate });
  return inviteUrl(token);
}

/** 招待ページ。ログイン前でも呼べる。無効なリンクなら null */
export async function getInvite(token: string): Promise<EventSummary | null> {
  if (isMock) {
    const id = token.replace(/^mock-/, "").replace(/~\d+$/, "");
    const e = mock.events.find((x) => x.id === id);
    return e ? { ...e } : null;
  }
  const rows = await rpc<EventRow[]>("get_invite", { p_token: token });
  return rows[0] ? toSummary(rows[0]) : null;
}

/** 招待の状況(主催者用) */
export async function getInviteStatus(id: string): Promise<InviteStatus | null> {
  if (isMock) {
    const e = mockFind(id);
    const d = new Date(`${e.date}T00:00:00`);
    d.setDate(d.getDate() - 14);
    const on = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      scope: e.scope,
      allInviteOn: on,
      allInviteSentAt: null,
      emailsSent: 0,
      emailsFailed: 0,
      registeredCount: e.capacity - e.remaining,
      linkOpenCount: 0,
    };
  }
  const rows = await rpc<
    {
      scope: EventScope;
      all_invite_on: string;
      all_invite_sent_at: string | null;
      emails_sent: number;
      emails_failed: number;
      link_open_count: number | null;
      registered_count: number;
    }[]
  >("get_invite_status", { p_event_id: Number(id) });
  const r = rows[0];
  if (!r) return null;
  return {
    scope: r.scope,
    allInviteOn: r.all_invite_on,
    allInviteSentAt: r.all_invite_sent_at,
    emailsSent: r.emails_sent,
    emailsFailed: r.emails_failed,
    registeredCount: r.registered_count,
    linkOpenCount: r.link_open_count ?? 0,
  };
}
