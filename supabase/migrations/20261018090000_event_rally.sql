-- ミッションの内容・キーワード・曲はアプリ内固定。
-- 旧TODO(t1..t5)とは内容が違うため、達成記録を混ぜずに保存する。
create table public.rally_checks (
  registration_id bigint not null references public.registrations(id) on delete cascade,
  mission_id text not null check (mission_id in ('cutter', 'net', 'song', 'photo', 'memories')),
  checked_at timestamptz not null default now(),
  primary key (registration_id, mission_id)
);

alter table public.rally_checks enable row level security;
revoke all on public.rally_checks from anon, authenticated;
grant select on public.rally_checks to authenticated;
grant all on public.rally_checks to service_role;

create policy "本人と主催者はラリー進捗を見られる" on public.rally_checks
  for select to authenticated
  using (exists (
    select 1 from public.registrations r
    where r.id = rally_checks.registration_id
      and (r.user_id = (select auth.uid()) or private.is_organizer(r.event_id, (select auth.uid())))
  ));

-- キャンセルしても履歴は残す。再申込時にも同じ記録を使う。
create function public.get_rally_progress(p_event_id bigint)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(c.mission_id order by c.mission_id), '{}'::text[])
  from public.rally_checks c
  join public.registrations r on r.id = c.registration_id
  where r.event_id = p_event_id and r.user_id = auth.uid();
$$;

-- 開始時刻から開催日の翌日いっぱい(日本時間)まで。達成取消は提供しない。
create function public.complete_rally_mission(p_event_id bigint, p_mission_id text)
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
