-- =====================================================================
-- Re:海学：RLS（行の見え方）と列の権限
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
create policy "見てよいイベントを見る" on public.events
  for select to authenticated
  using (
    organizer_id = (select auth.uid())
    or (
      status <> 'draft' and not is_hidden
      and (scope = 'open' or private.is_registered(id, (select auth.uid())))
    )
  );

create policy "誰でもイベントを作れる" on public.events
  for insert to authenticated
  with check (organizer_id = (select auth.uid()));

create policy "主催者は自分のイベントを更新できる" on public.events
  for update to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

create policy "主催者は下書きだけ削除できる" on public.events
  for delete to authenticated
  using (organizer_id = (select auth.uid()) and status = 'draft');

-- todo_items：全員が読める（書けない）
create policy "TODOは全員が読める" on public.todo_items
  for select to authenticated
  using (true);

-- registrations：本人と主催者が見られる。書き込みは apply_event / cancel_registration だけ
create policy "自分と主催イベントの申込を見る" on public.registrations
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_organizer(event_id, (select auth.uid()))
  );

-- todo_checks：本人と主催者が見られる。書き込みは check_todo だけ
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
create policy "主催者は招待リンクを見る" on public.invite_links
  for select to authenticated
  using (private.is_organizer(event_id, (select auth.uid())));

-- invitation_deliveries：ポリシーなし＝アプリからは読み書きできない

-- push_tokens：自分の端末の分だけ
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
