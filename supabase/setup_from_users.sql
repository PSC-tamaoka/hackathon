-- users だけがある Supabase 向けの一括セットアップ
-- SQL Editor の新規クエリに、このファイル全体を貼って実行する。
-- 既存ユーザー・管理者フラグ・追加列・作成済みイベント・達成記録は削除しない。
-- 同じ構成のDBでは再実行可能。失敗した場合は全体をロールバックする。
-- migrations/ の7ファイルを依存順でまとめ、既存 users の列補完と再実行対応を加えたもの。
-- このファイルには seed.sql・cron設定・外部メール送信・管理者への昇格は含まない。
-- 実行後に個別マイグレーションを重ねて貼り付ける必要はない。

begin;


-- ===== 20261017190000_create_users.sql =====

-- 認証まわりのDB: users / shibukawa_experiences / 登録トリガー / is_admin()
-- Supabase CLI 未導入のため、SQL Editor に貼って実行する

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  nickname text not null default '',
  city text,
  age_group text,
  is_admin boolean not null default false,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  created_at timestamptz not null default now()
);

-- 既存 users を保持し、現在のアプリが必要とする列だけ補う。
-- id の型が別設計の場合は、勝手に変換せず全体をロールバックする。
do $setup$
begin
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.users'::regclass and attname = 'id'
      and atttypid = 'uuid'::regtype and not attisdropped
  ) then
    raise exception 'public.users.id は uuid 型が必要です。既存データは変更していません。';
  end if;
end;
$setup$;

alter table public.users
  add column if not exists email text not null default '',
  add column if not exists name text not null default '',
  add column if not exists nickname text not null default '',
  add column if not exists city text,
  add column if not exists age_group text,
  add column if not exists is_admin boolean not null default false,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_push boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

-- 既存行の管理者フラグ・通知設定はそのまま、新規登録用の既定値を揃える。
alter table public.users
  alter column email set default '',
  alter column name set default '',
  alter column nickname set default '',
  alter column is_admin set default false,
  alter column notify_email set default true,
  alter column notify_push set default true,
  alter column created_at set default now();

-- 新しく足した列や空欄だけを認証情報で補い、入力済みのプロフィールは保持する。
update public.users p
set email = coalesce(nullif(p.email, ''), a.email, ''),
    name = coalesce(nullif(p.name, ''), a.raw_user_meta_data->>'name', ''),
    nickname = coalesce(nullif(p.nickname, ''), nullif(p.name, ''),
                        a.raw_user_meta_data->>'nickname', a.raw_user_meta_data->>'name', ''),
    city = coalesce(p.city, a.raw_user_meta_data->>'city'),
    age_group = coalesce(p.age_group, a.raw_user_meta_data->>'age_group')
from auth.users a
where p.id = a.id;


create table if not exists public.shibukawa_experiences (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  year int not null,
  school_name text not null,
  grade text,
  role_then text,
  programs text[],
  created_at timestamptz not null default now()
);

create index if not exists shibukawa_experiences_user_id_idx on public.shibukawa_experiences (user_id);

-- Supabase は新規テーブルに anon / authenticated へ全権限を既定で付ける。
-- users はトリガー以外の insert と、is_admin など機微な列の update を禁じる
revoke insert, update, delete on public.users from anon, authenticated;
grant update (name, nickname, city, age_group, notify_email, notify_push) on public.users to authenticated;

alter table public.users enable row level security;
alter table public.shibukawa_experiences enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select using (auth.uid() = id);
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update using (auth.uid() = id);

drop policy if exists shibukawa_experiences_select_own on public.shibukawa_experiences;
create policy shibukawa_experiences_select_own on public.shibukawa_experiences
  for select using (user_id = auth.uid());
drop policy if exists shibukawa_experiences_insert_own on public.shibukawa_experiences;
create policy shibukawa_experiences_insert_own on public.shibukawa_experiences
  for insert with check (user_id = auth.uid());
drop policy if exists shibukawa_experiences_update_own on public.shibukawa_experiences;
create policy shibukawa_experiences_update_own on public.shibukawa_experiences
  for update using (user_id = auth.uid());
drop policy if exists shibukawa_experiences_delete_own on public.shibukawa_experiences;
create policy shibukawa_experiences_delete_own on public.shibukawa_experiences
  for delete using (user_id = auth.uid());

-- 管理者判定。events などの RLS からも使う(例: with check (public.is_admin()))
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false)
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- 新規登録(auth.users への insert)でプロフィールと最初の渋川経験を自動作成する
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.users (id, email, name, nickname, city, age_group)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(meta->>'name', ''),
    coalesce(meta->>'nickname', coalesce(meta->>'name', '')),
    meta->>'city',
    meta->>'age_group'
  )
  on conflict (id) do nothing;

  -- experience_year が4桁の数字で school_name が空でないときだけ作る。
  -- 不正な値でも登録自体を失敗させない
  if meta->>'experience_year' ~ '^\d{4}$' and coalesce(meta->>'school_name', '') <> '' then
    insert into public.shibukawa_experiences (user_id, year, school_name)
    values (new.id, (meta->>'experience_year')::int, meta->>'school_name');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 既存の auth ユーザーを補完(users と、経験がまだ0件の人の shibukawa_experiences)
insert into public.users (id, email, name, nickname, city, age_group)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'name', ''),
  coalesce(u.raw_user_meta_data->>'nickname', coalesce(u.raw_user_meta_data->>'name', '')),
  u.raw_user_meta_data->>'city',
  u.raw_user_meta_data->>'age_group'
from auth.users u
on conflict (id) do nothing;

insert into public.shibukawa_experiences (user_id, year, school_name)
select
  u.id,
  (u.raw_user_meta_data->>'experience_year')::int,
  u.raw_user_meta_data->>'school_name'
from auth.users u
where u.raw_user_meta_data->>'experience_year' ~ '^\d{4}$'
  and coalesce(u.raw_user_meta_data->>'school_name', '') <> ''
  and not exists (
    select 1 from public.shibukawa_experiences e where e.user_id = u.id
  );

-- 既存 users に別名の許可ポリシーがあっても、他人の行にはアクセスさせない。
drop policy if exists users_setup_select_own on public.users;
create policy users_setup_select_own on public.users as restrictive
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists users_setup_update_own on public.users;
create policy users_setup_update_own on public.users as restrictive
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);


-- ===== 20261017200000_create_tables.sql =====

-- =====================================================================
-- 渋川つながり：テーブル
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
create table if not exists public.events (
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
create index if not exists events_event_date_idx on public.events (event_date);


-- ---------------------------------------------------------------------
-- 当日のTODOリスト（全イベント共通。アプリの commonTodos と同じ内容・同じID）
-- ---------------------------------------------------------------------
create table if not exists public.todo_items (
  id         text primary key,
  sort_order int  not null,
  text       text not null
);

insert into public.todo_items (id, sort_order, text) values
  ('t1', 1, '受付にてチェックイン（名札と思い出シールの受け取り）'),
  ('t2', 2, '渋川海岸へ移動・当時の櫂（かい）とカッターボートの見学'),
  ('t3', 3, '「語らいのタネ」カードを引いて、初対面の同窓生・OBOGと会話する'),
  ('t4', 4, '砂浜でみんなで夕陽を眺めながら思い出トーク（自由歓談）'),
  ('t5', 5, '記念写真の撮影＆アンケート回答')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 参加申込（出欠）
-- ---------------------------------------------------------------------
create table if not exists public.registrations (
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
create table if not exists public.todo_checks (
  registration_id bigint not null references public.registrations (id) on delete cascade,
  todo_item_id    text   not null references public.todo_items (id),
  checked_at      timestamptz not null default now(),
  primary key (registration_id, todo_item_id)
);


-- ---------------------------------------------------------------------
-- 招待リンク（招待制の個別招待・全体招待メールのリンクで共通）
-- 1イベントにつき有効なリンクは1本。漏れたら作り直せる
-- ---------------------------------------------------------------------
create table if not exists public.invite_links (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events (id) on delete cascade,
  token      text   not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid   references public.users (id) on delete set null,
  open_count int    not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists invite_links_one_active_per_event
  on public.invite_links (event_id)
  where revoked_at is null;


-- 全体招待メールの配信記録（同じ人に二度送らない）
create table if not exists public.invitation_deliveries (
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
create table if not exists public.push_tokens (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references public.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform        text not null check (platform in ('ios', 'android', 'web')),
  updated_at      timestamptz not null default now()
);


-- ===== 20261017200100_enable_rls.sql =====

-- =====================================================================
-- 渋川つながり：RLS（行の見え方）と列の権限
--   ・全テーブルで RLS を有効にする（ポリシーが無い操作はすべて拒否）
--   ・申込・TODOチェック・招待はアプリから直接書かせず、RPC 経由だけにする
--   ・RLS は「行」しか守れないので、触らせたくない列は GRANT で守る
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ポリシーから使う関数（API に出さない private スキーマに置く）
--    events と registrations のポリシーが互いを参照すると無限ループになるので、
--    確認は RLS を通らない security definer の関数で行う
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- 主催者か
create or replace function private.is_organizer(p_event_id bigint, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.organizer_id = p_uid
  );
$$;

-- 申込中か（キャンセル済みは含まない）
create or replace function private.is_registered(p_event_id bigint, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registrations r
    where r.event_id = p_event_id and r.user_id = p_uid and r.status = 'applied'
  );
$$;

-- イベントを見てよいか
--   オープン：公開中なら全員 / 招待制：主催者と申込者だけ（それ以外は招待リンクから見る）
create or replace function private.can_view_event(p_event_id bigint, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        e.organizer_id = p_uid
        or (
          e.status <> 'draft' and not e.is_hidden
          and (e.scope = 'open' or private.is_registered(e.id, p_uid))
        )
      )
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2. RLS を有効化
-- ---------------------------------------------------------------------
alter table public.users                 enable row level security;
alter table public.events                enable row level security;
alter table public.todo_items            enable row level security;
alter table public.registrations         enable row level security;
alter table public.todo_checks           enable row level security;
alter table public.invite_links          enable row level security;
alter table public.invitation_deliveries enable row level security;
alter table public.push_tokens           enable row level security;


-- ---------------------------------------------------------------------
-- 3. ポリシー
-- ---------------------------------------------------------------------

-- users のポリシー（自分の行だけ）は 20261017190000_create_users.sql で設定済み


-- events：見てよいものだけ。作成は誰でも（作った人が主催者）
-- （作成直後の行も判定できるよう、関数に行を探させず列で直接判定する）
drop policy if exists "見てよいイベントを見る" on public.events;
create policy "見てよいイベントを見る" on public.events
  for select to authenticated
  using (
    organizer_id = (select auth.uid())
    or (
      status <> 'draft' and not is_hidden
      and (scope = 'open' or private.is_registered(id, (select auth.uid())))
    )
  );

drop policy if exists "誰でもイベントを作れる" on public.events;
create policy "誰でもイベントを作れる" on public.events
  for insert to authenticated
  with check (organizer_id = (select auth.uid()));

drop policy if exists "主催者は自分のイベントを更新できる" on public.events;
create policy "主催者は自分のイベントを更新できる" on public.events
  for update to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

drop policy if exists "主催者は下書きだけ削除できる" on public.events;
create policy "主催者は下書きだけ削除できる" on public.events
  for delete to authenticated
  using (organizer_id = (select auth.uid()) and status = 'draft');

-- todo_items：全員が読める（書けない）
drop policy if exists "TODOは全員が読める" on public.todo_items;
create policy "TODOは全員が読める" on public.todo_items
  for select to authenticated
  using (true);

-- registrations：本人と主催者が見られる。書き込みは apply_event / cancel_registration だけ
drop policy if exists "自分と主催イベントの申込を見る" on public.registrations;
create policy "自分と主催イベントの申込を見る" on public.registrations
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_organizer(event_id, (select auth.uid()))
  );

-- todo_checks：本人と主催者が見られる。書き込みは check_todo だけ
drop policy if exists "自分と主催イベントのTODOチェックを見る" on public.todo_checks;
create policy "自分と主催イベントのTODOチェックを見る" on public.todo_checks
  for select to authenticated
  using (
    exists (
      select 1 from public.registrations r
      where r.id = todo_checks.registration_id
        and (r.user_id = (select auth.uid()) or private.is_organizer(r.event_id, (select auth.uid())))
    )
  );

-- invite_links：主催者が見られる。作成は create_invite_link だけ
drop policy if exists "主催者は招待リンクを見る" on public.invite_links;
create policy "主催者は招待リンクを見る" on public.invite_links
  for select to authenticated
  using (private.is_organizer(event_id, (select auth.uid())));

-- invitation_deliveries：ポリシーなし＝アプリからは読み書きできない

-- push_tokens：自分の端末の分だけ
drop policy if exists "自分のプッシュトークンを管理する" on public.push_tokens;
create policy "自分のプッシュトークンを管理する" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 4. 列の権限
--    Supabase は新しいテーブルの全列を anon / authenticated に許可するので、
--    いったん取り消して必要な分だけ許可し直す
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;

revoke insert, update, delete on
  public.users, public.events, public.todo_items, public.registrations,
  public.todo_checks, public.invite_links, public.invitation_deliveries
from authenticated;
revoke select on public.invitation_deliveries from authenticated;

-- users：is_admin・email は自分で変えられない（列は create_users.sql の設計に合わせる）
grant update (name, nickname, city, age_group, notify_email, notify_push)
  on public.users to authenticated;

-- events：主催者が入力する列だけ（organizer_id・is_hidden・全体招待の進み具合は除く）
grant insert (title, description, event_date, start_time, end_time, reception_note, place,
              place_detail, address, capacity, scope, rain_policy, tags, cover_url, status, deadline)
  on public.events to authenticated;
grant update (title, description, event_date, start_time, end_time, reception_note, place,
              place_detail, address, capacity, scope, rain_policy, tags, cover_url, status, deadline)
  on public.events to authenticated;
grant delete on public.events to authenticated;


-- ===== 20261017200200_rpc_events.sql =====

-- =====================================================================
-- 渋川つながり：イベント・出欠・TODO の RPC
--   アプリから supabase.rpc('関数名', { 引数 }) で呼ぶ。一覧は docs/api.md
--   残席は他人の申込も数える必要があるので、一覧・詳細も RPC で返す
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. 画面に出すイベント1件分の形（内部用）
-- ---------------------------------------------------------------------
create or replace function private.event_cards(p_uid uuid)
returns table (
  id               bigint,
  title            text,
  description      text,
  event_date       date,
  start_time       text,
  end_time         text,
  reception_note   text,
  place            text,
  place_detail     text,
  address          text,
  capacity         int,
  remaining        int,
  scope            text,
  rain_policy      text,
  tags             text[],
  cover_url        text,
  status           text,
  is_organizer     boolean,
  is_registered    boolean,
  checked_todo_ids text[],
  accepting        boolean   -- 参加登録を受け付けているか（公開中・締切前・残席あり）
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, e.title, e.description, e.event_date,
    to_char(e.start_time, 'HH24:MI'), to_char(e.end_time, 'HH24:MI'),
    e.reception_note, e.place, e.place_detail, e.address, e.capacity,
    greatest(e.capacity - coalesce((
      select sum(r.party_size) from public.registrations r
      where r.event_id = e.id and r.status = 'applied'
    ), 0), 0)::int,
    e.scope, e.rain_policy, e.tags, e.cover_url, e.status,
    coalesce(e.organizer_id = p_uid, false),
    mine.id is not null,
    coalesce((
      select array_agg(c.todo_item_id order by c.todo_item_id)
      from public.todo_checks c where c.registration_id = mine.id
    ), '{}'),
    e.status = 'published' and not e.is_hidden
      and now() <= coalesce(e.deadline, (e.event_date + e.start_time) at time zone 'Asia/Tokyo')
      and e.capacity > coalesce((
        select sum(r.party_size) from public.registrations r
        where r.event_id = e.id and r.status = 'applied'
      ), 0)
  from public.events e
  left join public.registrations mine
    on mine.event_id = e.id and mine.user_id = p_uid and mine.status = 'applied';
$$;

revoke execute on function private.event_cards(uuid) from public, anon, authenticated;


-- 招待リンクのトークンが、そのイベントの有効なリンクか（内部用）
create or replace function private.valid_invite(p_event_id bigint, p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_token is not null and exists (
    select 1
    from public.invite_links l
    join public.events e on e.id = l.event_id
    where l.event_id = p_event_id
      and l.token = p_token
      and l.revoked_at is null
      and e.status <> 'draft'
      and not e.is_hidden
  );
$$;

revoke execute on function private.valid_invite(bigint, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 1. カレンダー用の一覧（P-03）
--   supabase.rpc('list_events', { p_from: '2026-10-01', p_to: '2026-10-31' })
-- ---------------------------------------------------------------------
create or replace function public.list_events(p_from date, p_to date)
returns table (
  id bigint, title text, description text, event_date date, start_time text, end_time text,
  reception_note text, place text, place_detail text, address text, capacity int, remaining int,
  scope text, rain_policy text, tags text[], cover_url text, status text,
  is_organizer boolean, is_registered boolean, checked_todo_ids text[], accepting boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from private.event_cards(auth.uid()) c
  where c.event_date between p_from and p_to
    and c.status <> 'canceled'
    and private.can_view_event(c.id, auth.uid())
  order by c.event_date, c.start_time;
$$;


-- ---------------------------------------------------------------------
-- 2. イベント詳細（P-04）
--   supabase.rpc('get_event', { p_event_id: 1 }).maybeSingle()
--   招待制のイベントは、招待リンクのトークンを付けると申込前でも見られる
-- ---------------------------------------------------------------------
create or replace function public.get_event(p_event_id bigint, p_invite_token text default null)
returns table (
  id bigint, title text, description text, event_date date, start_time text, end_time text,
  reception_note text, place text, place_detail text, address text, capacity int, remaining int,
  scope text, rain_policy text, tags text[], cover_url text, status text,
  is_organizer boolean, is_registered boolean, checked_todo_ids text[], accepting boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from private.event_cards(auth.uid()) c
  where c.id = p_event_id
    and (
      private.can_view_event(c.id, auth.uid())
      or private.valid_invite(c.id, p_invite_token)
    );
$$;


-- ---------------------------------------------------------------------
-- 3. 参加する（定員・締切・招待制の確認つき）
--   supabase.rpc('apply_event', { p_event_id: 1 })
--   招待制は招待リンクのトークンが必要: { p_event_id, p_invite_token }
-- ---------------------------------------------------------------------
create or replace function public.apply_event(
  p_event_id     bigint,
  p_party_size   int  default 1,
  p_invite_token text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_event public.events%rowtype;
  v_taken int;
  v_id    bigint;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;
  if p_party_size not between 1 and 10 then
    raise exception '参加人数は1〜10人で指定してください';
  end if;

  -- イベント行をロックしてから数える（同時に申し込まれても定員を超えない）
  select * into v_event from public.events where id = p_event_id for update;

  if not found or v_event.status <> 'published' or v_event.is_hidden then
    raise exception 'このイベントには参加登録できません';
  end if;
  if v_event.scope = 'closed'
     and v_event.organizer_id is distinct from v_uid
     and not private.valid_invite(p_event_id, p_invite_token)
     and not exists (   -- 一度申し込んでキャンセルした人は、もう一度申し込める
       select 1 from public.registrations r where r.event_id = p_event_id and r.user_id = v_uid
     ) then
    raise exception '招待制のイベントです。招待リンクから参加登録してください';
  end if;
  if now() > coalesce(v_event.deadline,
                      (v_event.event_date + v_event.start_time) at time zone 'Asia/Tokyo') then
    raise exception '参加登録の受付は終了しました';
  end if;

  select coalesce(sum(party_size), 0) into v_taken
  from public.registrations
  where event_id = p_event_id and status = 'applied';

  if v_taken + p_party_size > v_event.capacity then
    raise exception '定員に達しました（残り%名）', greatest(v_event.capacity - v_taken, 0);
  end if;

  insert into public.registrations (event_id, user_id, party_size)
  values (p_event_id, v_uid, p_party_size)
  on conflict (event_id, user_id) do update
    set party_size = excluded.party_size, status = 'applied', updated_at = now()
    where public.registrations.status = 'canceled'
  returning id into v_id;

  if v_id is null then
    raise exception 'すでに参加登録済みです';
  end if;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. 参加をとりやめる
--   supabase.rpc('cancel_registration', { p_event_id: 1 })
-- ---------------------------------------------------------------------
create or replace function public.cancel_registration(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.registrations
  set status = 'canceled', updated_at = now()
  where event_id = p_event_id
    and user_id = auth.uid()
    and status = 'applied';

  if not found then
    raise exception '参加登録がありません';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. 当日のTODOをチェックする・外す（参加登録した本人が、イベント当日だけ）
--   supabase.rpc('check_todo', { p_event_id: 1, p_todo_id: 't1', p_checked: true })
--   戻り値はチェック済みのTODOのID一覧
-- ---------------------------------------------------------------------
create or replace function public.check_todo(p_event_id bigint, p_todo_id text, p_checked boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg_id bigint;
  v_event  public.events%rowtype;
begin
  select r.id into v_reg_id
  from public.registrations r
  where r.event_id = p_event_id and r.user_id = auth.uid() and r.status = 'applied';
  if v_reg_id is null then
    raise exception 'このイベントに参加登録していません';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if v_event.status = 'canceled' then
    raise exception '中止になったイベントです';
  end if;
  if (now() at time zone 'Asia/Tokyo')::date <> v_event.event_date then
    raise exception 'TODOはイベント当日にチェックできます';
  end if;
  if not exists (select 1 from public.todo_items where id = p_todo_id) then
    raise exception 'TODOが見つかりません';
  end if;

  if p_checked then
    insert into public.todo_checks (registration_id, todo_item_id)
    values (v_reg_id, p_todo_id)
    on conflict do nothing;
  else
    delete from public.todo_checks
    where registration_id = v_reg_id and todo_item_id = p_todo_id;
  end if;

  return coalesce((
    select array_agg(todo_item_id order by todo_item_id)
    from public.todo_checks where registration_id = v_reg_id
  ), '{}');
end;
$$;


-- ---------------------------------------------------------------------
-- 6. 実行権限（ログイン済みユーザーだけ）
-- ---------------------------------------------------------------------
revoke execute on function
  public.list_events(date, date),
  public.get_event(bigint, text),
  public.apply_event(bigint, int, text),
  public.cancel_registration(bigint),
  public.check_todo(bigint, text, boolean)
from public, anon;

grant execute on function
  public.list_events(date, date),
  public.get_event(bigint, text),
  public.apply_event(bigint, int, text),
  public.cancel_registration(bigint),
  public.check_todo(bigint, text, boolean)
to authenticated;


-- ===== 20261017200300_rpc_invitations.sql =====

-- =====================================================================
-- 渋川つながり：招待の RPC
--
-- 招待の方法は、イベントの公開形式（events.scope）で決まる
--   closed（招待制）: 招待リンクとQRコードを配る。リンクを開くと招待ページ
--   open（オープン） : 開催14日前になったら、会員全員に招待メールを自動送信
--                      （Edge Function send-invitation を pg_cron が毎日呼ぶ）
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 全体招待メールを送り始めたら、公開形式は変えられないようにする
-- ---------------------------------------------------------------------
create or replace function private.lock_scope_after_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope is distinct from old.scope
     and exists (select 1 from public.invitation_deliveries d where d.event_id = old.id) then
    raise exception '招待メールを送信済みのため、公開形式は変更できません';
  end if;
  return new;
end;
$$;

drop trigger if exists events_lock_scope on public.events;
create trigger events_lock_scope
  before update of scope on public.events
  for each row execute function private.lock_scope_after_invite();


-- ---------------------------------------------------------------------
-- 2. 招待リンクを作る（あれば同じトークンを返す）
--   const { data: token } = await supabase.rpc('create_invite_link', { p_event_id })
--   URL = `${招待ページのURLの頭}/invite/${token}` をコピー・QRコードにする
--   作れるのは主催者と、そのイベントを見られる人（オープン・参加登録済み）
--   p_regenerate = true で古いリンクを無効にして作り直す（主催者のみ）
-- ---------------------------------------------------------------------
create or replace function public.create_invite_link(p_event_id bigint, p_regenerate boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_event     public.events%rowtype;
  v_organizer boolean;
  v_token     text;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_uid is null or not found then
    raise exception '招待リンクを作れません';
  end if;
  -- 運営のイベント（主催者が空）でも true / false になるよう coalesce する
  v_organizer := coalesce(v_event.organizer_id = v_uid, false);

  if not (v_organizer or coalesce(private.can_view_event(p_event_id, v_uid), false)) then
    raise exception '招待リンクを作れません';
  end if;
  if v_event.status <> 'published' then
    raise exception '公開中のイベントだけ招待できます';
  end if;

  if p_regenerate then
    if not v_organizer then
      raise exception '招待リンクを作り直せるのは主催者だけです';
    end if;
    update public.invite_links set revoked_at = now()
    where event_id = p_event_id and revoked_at is null;
  end if;

  insert into public.invite_links (event_id, created_by)
  values (p_event_id, v_uid)
  on conflict (event_id) where revoked_at is null do nothing;

  select token into v_token
  from public.invite_links
  where event_id = p_event_id and revoked_at is null;
  return v_token;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. 招待ページ（ログイン前でも呼べる）
--   supabase.rpc('get_invite', { p_token }).maybeSingle()  → 空なら無効なリンク
--   戻り値は get_event と同じ形
-- ---------------------------------------------------------------------
create or replace function public.get_invite(p_token text)
returns table (
  id bigint, title text, description text, event_date date, start_time text, end_time text,
  reception_note text, place text, place_detail text, address text, capacity int, remaining int,
  scope text, rain_policy text, tags text[], cover_url text, status text,
  is_organizer boolean, is_registered boolean, checked_todo_ids text[], accepting boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event_id bigint;
begin
  select l.event_id into v_event_id
  from public.invite_links l
  where l.token = p_token and l.revoked_at is null;

  if v_event_id is null or not private.valid_invite(v_event_id, p_token) then
    return;  -- 無効なリンク
  end if;

  update public.invite_links set open_count = open_count + 1
  where token = p_token;

  return query
  select c.* from private.event_cards(auth.uid()) c where c.id = v_event_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. 招待の状況（主催者の招待画面 O-03 用。主催者以外は0件）
-- ---------------------------------------------------------------------
create or replace function public.get_invite_status(p_event_id bigint)
returns table (
  scope              text,
  all_invite_on      date,          -- 全体招待メールの送信予定日（開催14日前）
  all_invite_sent_at timestamptz,
  emails_sent        int,
  emails_failed      int,
  invite_token       text,
  link_open_count    int,
  registered_count   int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.scope,
    e.event_date - 14,
    e.all_invite_sent_at,
    (select count(*)::int from public.invitation_deliveries d where d.event_id = e.id and d.status = 'sent'),
    (select count(*)::int from public.invitation_deliveries d where d.event_id = e.id and d.status = 'failed'),
    l.token,
    l.open_count,
    (select coalesce(sum(r.party_size), 0)::int from public.registrations r
      where r.event_id = e.id and r.status = 'applied')
  from public.events e
  left join public.invite_links l on l.event_id = e.id and l.revoked_at is null
  where e.id = p_event_id
    and e.organizer_id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 5. 以下は Edge Function（service_role）だけが呼ぶ：全体招待メールの送信
-- ---------------------------------------------------------------------

-- 5-1. 送る時期が来たオープンのイベントを取り出し、「送信中」の印を付ける
--   条件: オープン・公開中・非表示でない・未完了・締切前・開催日が今日〜14日後（日本時間）
--   1時間以上前の印は、途中で止まったとみなして取り直す
create or replace function public.claim_due_all_invites(p_lead_days int default 14)
returns table (
  event_id     bigint,
  title        text,
  description  text,
  event_date   date,
  start_time   text,
  end_time     text,
  place        text,
  deadline     timestamptz,
  invite_token text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  r       record;
begin
  for r in
    select e.id
    from public.events e
    where e.scope = 'open'
      and e.status = 'published'
      and not e.is_hidden
      and e.all_invite_sent_at is null
      and (e.all_invite_claimed_at is null or e.all_invite_claimed_at < now() - interval '1 hour')
      and e.event_date between v_today and v_today + p_lead_days
      and coalesce(e.deadline, (e.event_date + e.start_time) at time zone 'Asia/Tokyo') > now()
    order by e.event_date
    for update skip locked   -- 同時に2回起動しても同じイベントを取り合わない
  loop
    update public.events set all_invite_claimed_at = now() where id = r.id;

    insert into public.invite_links (event_id, created_by)
    select e.id, e.organizer_id from public.events e where e.id = r.id
    on conflict (event_id) where revoked_at is null do nothing;

    return query
    select
      e.id, e.title, e.description, e.event_date,
      to_char(e.start_time, 'HH24:MI'), to_char(e.end_time, 'HH24:MI'),
      case when e.place_detail is null or e.place_detail = '' then e.place
           else e.place || '（' || e.place_detail || '）' end,
      coalesce(e.deadline, (e.event_date + e.start_time) at time zone 'Asia/Tokyo'),
      l.token
    from public.events e
    join public.invite_links l on l.event_id = e.id and l.revoked_at is null
    where e.id = r.id;
  end loop;
end;
$$;

-- 5-2. まだ招待メールを送っていない会員
--   メール受信を許可した会員のうち、主催者・参加登録済み・送信済み（送信中）の人を除く
create or replace function public.all_invite_recipients(p_event_id bigint)
returns table (user_id uuid, email text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email, u.name
  from public.users u
  join public.events e on e.id = p_event_id
  where u.notify_email
    and u.email <> ''
    and u.id is distinct from e.organizer_id
    and not exists (
      select 1 from public.registrations r
      where r.event_id = p_event_id and r.user_id = u.id and r.status = 'applied'
    )
    and not exists (
      select 1 from public.invitation_deliveries d
      where d.event_id = p_event_id and d.user_id = u.id and d.channel = 'email'
        and d.status in ('sending', 'sent')
    )
  order by u.created_at;
$$;

-- 5-3. 送る直前に「送信中」として記録し、記録できた人だけを返す（二重送信防止）
create or replace function public.reserve_invite_deliveries(p_event_id bigint, p_user_ids uuid[])
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.invitation_deliveries (event_id, user_id, channel, status)
  select p_event_id, uid, 'email', 'sending'
  from unnest(p_user_ids) as t(uid)
  on conflict (event_id, user_id, channel) do update
    set status = 'sending', error = null, updated_at = now()
    where public.invitation_deliveries.status = 'failed'   -- 失敗した人だけ再送
  returning user_id;
$$;

-- 5-4. 送信結果を記録する
create or replace function public.finish_invite_deliveries(
  p_event_id bigint, p_user_ids uuid[], p_status text, p_error text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invitation_deliveries
  set status = p_status, error = p_error, updated_at = now()
  where event_id = p_event_id and channel = 'email' and user_id = any (p_user_ids);
$$;

-- 5-5. イベント1件分の処理を終える
--   p_done = true  : 全員に送り終えた → 完了
--   p_done = false : 送信上限などで残りがある → 印を外して翌日の実行で続ける
create or replace function public.complete_all_invite(p_event_id bigint, p_done boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events
  set all_invite_sent_at    = case when p_done then now() end,
      all_invite_claimed_at = case when p_done then all_invite_claimed_at end,
      all_invite_sent_count = (
        select count(*) from public.invitation_deliveries d
        where d.event_id = p_event_id and d.status = 'sent'
      )
  where id = p_event_id;
$$;


-- ---------------------------------------------------------------------
-- 6. 実行権限
-- ---------------------------------------------------------------------
revoke execute on function
  public.create_invite_link(bigint, boolean),
  public.get_invite(text),
  public.get_invite_status(bigint),
  public.claim_due_all_invites(int),
  public.all_invite_recipients(bigint),
  public.reserve_invite_deliveries(bigint, uuid[]),
  public.finish_invite_deliveries(bigint, uuid[], text, text),
  public.complete_all_invite(bigint, boolean),
  private.lock_scope_after_invite()
from public, anon, authenticated;

grant execute on function public.get_invite(text) to anon, authenticated;   -- ログイン前でも開ける
grant execute on function
  public.create_invite_link(bigint, boolean),
  public.get_invite_status(bigint)
to authenticated;
grant execute on function
  public.claim_due_all_invites(int),
  public.all_invite_recipients(bigint),
  public.reserve_invite_deliveries(bigint, uuid[]),
  public.finish_invite_deliveries(bigint, uuid[], text, text),
  public.complete_all_invite(bigint, boolean)
to service_role;


-- ===== 20261018090000_event_rally.sql =====

-- ミッションの内容・キーワード・曲はアプリ内固定。
-- 旧TODO(t1..t5)とは内容が違うため、達成記録を混ぜずに保存する。
create table if not exists public.rally_checks (
  registration_id bigint not null references public.registrations(id) on delete cascade,
  mission_id text not null check (mission_id in ('cutter', 'net', 'song', 'photo', 'memories')),
  checked_at timestamptz not null default now(),
  primary key (registration_id, mission_id)
);

alter table public.rally_checks enable row level security;
revoke all on public.rally_checks from anon, authenticated;
grant select on public.rally_checks to authenticated;
grant all on public.rally_checks to service_role;

drop policy if exists "本人と主催者はラリー進捗を見られる" on public.rally_checks;
create policy "本人と主催者はラリー進捗を見られる" on public.rally_checks
  for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = rally_checks.registration_id
      and (r.user_id = (select auth.uid()) or private.is_organizer(r.event_id, (select auth.uid())))
  ));

-- キャンセルしても履歴は残す。再申込時にも同じ記録を使う。
create or replace function public.get_rally_progress(p_event_id bigint)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(c.mission_id order by c.mission_id), '{}'::text[])
  from public.rally_checks c
  join public.registrations r on r.id = c.registration_id
  where r.event_id = p_event_id and r.user_id = auth.uid();
$$;

-- 開始時刻から開催日の翌日いっぱい(日本時間)まで。達成取消は提供しない。
create or replace function public.complete_rally_mission(p_event_id bigint, p_mission_id text)
returns text[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_reg_id bigint;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;
  if p_mission_id is null or p_mission_id not in ('cutter', 'net', 'song', 'photo', 'memories') then
    raise exception 'ミッションが見つかりません';
  end if;

  -- 申込処理と同じくイベント→申込の順でロックする。
  select * into v_event from public.events where id = p_event_id for share;
  if not found or v_event.status <> 'published' or v_event.is_hidden then
    raise exception 'このイベントではミッションを達成できません';
  end if;

  select id into v_reg_id from public.registrations
  where event_id = p_event_id and user_id = auth.uid() and status = 'applied'
  for update;
  if v_reg_id is null then
    raise exception '参加登録が必要です';
  end if;

  if now() < ((v_event.event_date + v_event.start_time) at time zone 'Asia/Tokyo')
     or now() >= (((v_event.event_date + 2)::timestamp) at time zone 'Asia/Tokyo') then
    raise exception 'ミッションの利用時間外です';
  end if;

  insert into public.rally_checks (registration_id, mission_id)
  values (v_reg_id, p_mission_id)
  on conflict do nothing;

  return public.get_rally_progress(p_event_id);
end;
$$;

revoke execute on function public.get_rally_progress(bigint),
  public.complete_rally_mission(bigint, text) from public, anon;
grant execute on function public.get_rally_progress(bigint),
  public.complete_rally_mission(bigint, text) to authenticated;


-- ===== 20261018090100_restrict_event_creation.sql =====

-- 画面の管理者ゲートだけでなく、直接のAPI呼び出しにも同じ制限を適用する。
drop policy if exists "誰でもイベントを作れる" on public.events;
drop policy if exists "管理者だけイベントを作れる" on public.events;
create policy "管理者だけイベントを作れる" on public.events
  for insert to authenticated
  with check (organizer_id = (select auth.uid()) and (select public.is_admin()));


-- Supabaseプロジェクト側の既定GRANTに依存せず、アプリ用の権限を明示する。
-- users の既存列単位の権限も整理し、is_admin などの自己変更を防ぐ。
do $setup$
declare
  v_columns text;
begin
  select string_agg(format('%I', attname), ', ' order by attnum) into v_columns
  from pg_attribute
  where attrelid = 'public.users'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke all (%s) on public.users from anon, authenticated', v_columns);
end;
$setup$;

grant select on public.users, public.shibukawa_experiences, public.events,
  public.todo_items, public.registrations, public.todo_checks, public.invite_links,
  public.push_tokens, public.rally_checks to authenticated;
grant update (name, nickname, city, age_group, notify_email, notify_push)
  on public.users to authenticated;
grant insert, update, delete on public.shibukawa_experiences, public.push_tokens to authenticated;
grant usage, select on sequence public.shibukawa_experiences_id_seq,
  public.events_id_seq, public.push_tokens_id_seq to authenticated;
grant all on public.users, public.shibukawa_experiences, public.events,
  public.todo_items, public.registrations, public.todo_checks, public.invite_links,
  public.invitation_deliveries, public.push_tokens, public.rally_checks to service_role;

notify pgrst, 'reload schema';
commit;

select 'セットアップ完了' as result,
       (select count(*) from public.users) as preserved_users,
       (select count(*) from public.events) as events;
