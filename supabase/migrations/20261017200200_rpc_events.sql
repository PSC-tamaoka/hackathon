-- =====================================================================
-- Re:海学：イベント・出欠・TODO の RPC
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
create function public.list_events(p_from date, p_to date)
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
create function public.get_event(p_event_id bigint, p_invite_token text default null)
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
create function public.apply_event(
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
create function public.cancel_registration(p_event_id bigint)
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
create function public.check_todo(p_event_id bigint, p_todo_id text, p_checked boolean)
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
