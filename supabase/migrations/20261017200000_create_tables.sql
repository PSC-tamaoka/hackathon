-- =====================================================================
-- Re:海学：テーブル
-- フロントエンド（デザイン案）に合わせた形。仕様書からの主な変更点
--   ・公開形式 scope：open（全員に公開＋開催14日前に全員へ招待メール）
--                     closed（招待制。招待リンク・QRを受け取った人だけ）
--   ・スタンプラリー → 当日のTODOリスト（全イベント共通の5項目）
-- =====================================================================
-- ※ users・登録トリガー・shibukawa_experiences・is_admin() は
--   `20261017190000_create_users.sql` で作成済み。ここでは作り直さない


-- ---------------------------------------------------------------------
-- イベント（作った人が主催者。organizer_id が空なら運営のイベント）
-- ---------------------------------------------------------------------
create table public.events (
  id             bigint generated always as identity primary key,
  organizer_id   uuid default auth.uid() references public.users (id) on delete set null,
  title          text not null check (char_length(title) between 1 and 40),
  description    text not null default '',
  event_date     date not null,
  start_time     time not null,
  end_time       time not null,
  reception_note text,                                   -- 例: 受付開始 15:00
  place          text not null default '岡山県渋川青年の家',
  place_detail   text,                                   -- 集合詳細・目印
  address        text not null default '玉野市渋川',
  capacity       int  not null check (capacity between 1 and 200),
  scope          text not null default 'open' check (scope in ('open', 'closed')),
  rain_policy    text not null default 'showers_ok'
                 check (rain_policy in ('showers_ok', 'severe_cancel', 'indoor_shift')),
  tags           text[] not null default '{}',           -- 体験メニュー・特色タグ
  cover_url      text,
  status         text not null default 'published' check (status in ('draft', 'published', 'canceled')),
  deadline       timestamptz,                            -- 申込締切（空なら開始時刻まで）
  is_hidden      boolean not null default false,         -- 管理者による非表示
  -- 全体招待メール（scope = open）の進み具合
  all_invite_claimed_at timestamptz,
  all_invite_sent_at    timestamptz,
  all_invite_sent_count int not null default 0,
  created_at     timestamptz not null default now(),
  check (end_time > start_time)
);
create index events_event_date_idx on public.events (event_date);


-- ---------------------------------------------------------------------
-- 当日のTODOリスト（全イベント共通。アプリの commonTodos と同じ内容・同じID）
-- ---------------------------------------------------------------------
create table public.todo_items (
  id         text primary key,
  sort_order int  not null,
  text       text not null
);

insert into public.todo_items (id, sort_order, text) values
  ('t1', 1, '受付にてチェックイン（名札と思い出シールの受け取り）'),
  ('t2', 2, '渋川海岸へ移動・当時の櫂（かい）とカッターボートの見学'),
  ('t3', 3, '「語らいのタネ」カードを引いて、初対面の同窓生・OBOGと会話する'),
  ('t4', 4, '砂浜でみんなで夕陽を眺めながら思い出トーク（自由歓談）'),
  ('t5', 5, '記念写真の撮影＆アンケート回答');


-- ---------------------------------------------------------------------
-- 参加申込（出欠）
-- ---------------------------------------------------------------------
create table public.registrations (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events (id) on delete cascade,
  user_id    uuid   not null references public.users (id) on delete cascade,
  party_size int    not null default 1 check (party_size between 1 and 10),
  status     text   not null default 'applied' check (status in ('applied', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);


-- TODOのチェック（申込1件 × TODO 1項目につき1行）
create table public.todo_checks (
  registration_id bigint not null references public.registrations (id) on delete cascade,
  todo_item_id    text   not null references public.todo_items (id),
  checked_at      timestamptz not null default now(),
  primary key (registration_id, todo_item_id)
);


-- ---------------------------------------------------------------------
-- 招待リンク（招待制の個別招待・全体招待メールのリンクで共通）
-- 1イベントにつき有効なリンクは1本。漏れたら作り直せる
-- ---------------------------------------------------------------------
create table public.invite_links (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events (id) on delete cascade,
  token      text   not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid   references public.users (id) on delete set null,
  open_count int    not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index invite_links_one_active_per_event
  on public.invite_links (event_id)
  where revoked_at is null;


-- 全体招待メールの配信記録（同じ人に二度送らない）
create table public.invitation_deliveries (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events (id) on delete cascade,
  user_id    uuid   not null references public.users (id) on delete cascade,
  channel    text   not null default 'email' check (channel in ('email', 'push')),
  status     text   not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id, channel)
);


-- Expo のプッシュトークン（端末ごと）
create table public.push_tokens (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references public.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform        text not null check (platform in ('ios', 'android', 'web')),
  updated_at      timestamptz not null default now()
);
