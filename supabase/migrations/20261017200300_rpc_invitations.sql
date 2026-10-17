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
create function public.create_invite_link(p_event_id bigint, p_regenerate boolean default false)
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
create function public.get_invite(p_token text)
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
create function public.get_invite_status(p_event_id bigint)
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
create function public.claim_due_all_invites(p_lead_days int default 14)
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
create function public.all_invite_recipients(p_event_id bigint)
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
create function public.reserve_invite_deliveries(p_event_id bigint, p_user_ids uuid[])
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
create function public.finish_invite_deliveries(
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
create function public.complete_all_invite(p_event_id bigint, p_done boolean)
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
