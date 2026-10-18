-- ローカルの検証用DBで、全マイグレーション適用後に実行。データは最後に戻す。
begin;

create temporary table rally_test_ids (name text primary key, id text not null);
grant select on rally_test_ids to authenticated, anon;

create function pg_temp.test_id(p_name text) returns bigint language sql as $$
  select id::bigint from pg_temp.rally_test_ids where name = p_name
$$;
create function pg_temp.test_user(p_name text) returns uuid language sql as $$
  select id::uuid from pg_temp.rally_test_ids where name = p_name
$$;
create function pg_temp.assert_true(p_value boolean, p_message text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'FAIL: %', p_message; end if;
end;
$$;
create function pg_temp.expect_error(p_sql text, p_message text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_message in sqlerrm) = 0 then
      raise exception 'Expected "%", got "%"', p_message, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected error: %', p_message;
end;
$$;

do $$
declare
  v_name text;
  v_id uuid;
  v_event bigint;
  v_day date := (now() at time zone 'Asia/Tokyo')::date;
begin
  foreach v_name in array array['alice', 'bob', 'organizer'] loop
    v_id := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_id, v_id::text || '@example.invalid', jsonb_build_object('name', v_name));
    insert into rally_test_ids values (v_name, v_id::text);
  end loop;
  update public.users set is_admin = true where id = pg_temp.test_user('organizer');

  foreach v_name in array array['active', 'other', 'yesterday', 'future', 'expired', 'canceled', 'hidden', 'draft', 'closed'] loop
    insert into public.events (organizer_id, title, event_date, start_time, end_time, capacity, status, is_hidden, scope, deadline)
    values (
      pg_temp.test_user('organizer'), 'rally test ' || v_name,
      v_day + case v_name when 'yesterday' then -1 when 'future' then 1 when 'expired' then -2 else 0 end,
      '00:00', '23:59', 10,
      case v_name when 'canceled' then 'canceled' when 'draft' then 'draft' else 'published' end,
      v_name = 'hidden', case v_name when 'closed' then 'closed' else 'open' end,
      (v_day + 3)::timestamp at time zone 'Asia/Tokyo'
    ) returning id into v_event;
    insert into rally_test_ids values (v_name, v_event::text);
    if v_name not in ('other', 'closed') then
      insert into public.registrations (event_id, user_id) values (v_event, pg_temp.test_user('alice'));
    end if;
  end loop;

  -- 旧TODOは別の内容。ラリー達成として扱わない。
  insert into public.todo_checks (registration_id, todo_item_id)
  select id, 't1' from public.registrations
  where event_id = pg_temp.test_id('active') and user_id = pg_temp.test_user('alice');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.test_user('alice')::text, true);
select pg_temp.assert_true(public.get_rally_progress(pg_temp.test_id('active')) = '{}', '旧TODOをラリーへ流用しない');
select pg_temp.assert_true(public.complete_rally_mission(pg_temp.test_id('active'), 'cutter') = array['cutter'], '本人が達成できる');
select public.complete_rally_mission(pg_temp.test_id('active'), 'cutter');
select pg_temp.assert_true((select count(*) from public.rally_checks) = 1, '二重送信でも1件');
select pg_temp.assert_true(public.get_rally_progress(pg_temp.test_id('other')) = '{}', '別イベントには混ざらない');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('active'), 'unknown')$q$, 'ミッションが見つかりません');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('active'), null)$q$, 'ミッションが見つかりません');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('future'), 'cutter')$q$, '利用時間外');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('expired'), 'cutter')$q$, '利用時間外');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('canceled'), 'cutter')$q$, '達成できません');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('hidden'), 'cutter')$q$, '達成できません');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('draft'), 'cutter')$q$, '達成できません');
select pg_temp.assert_true(public.complete_rally_mission(pg_temp.test_id('yesterday'), 'cutter') = array['cutter'], '翌日いっぱいまで利用できる');
select public.complete_rally_mission(pg_temp.test_id('active'), 'net');
select public.complete_rally_mission(pg_temp.test_id('active'), 'song');
select public.complete_rally_mission(pg_temp.test_id('active'), 'photo');
select pg_temp.assert_true(
  public.complete_rally_mission(pg_temp.test_id('active'), 'memories') = array['cutter', 'memories', 'net', 'photo', 'song'],
  '5つの固定ミッションの達成を復元できる'
);
select pg_temp.assert_true(
  (select checked_todo_ids = array['t1'] and is_registered from public.get_event(pg_temp.test_id('active'))),
  '既存の詳細RPC・出欠・旧TODOを維持する'
);
select pg_temp.expect_error($q$insert into public.rally_checks (registration_id, mission_id)
  select id, 'net' from public.registrations where event_id = pg_temp.test_id('yesterday')$q$, 'permission denied');
select pg_temp.expect_error($q$update public.users set is_admin = true where id = auth.uid()$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.events (title, event_date, start_time, end_time, capacity)
  values ('non-admin event', current_date, '10:00', '12:00', 5)$q$, 'row-level security');

select set_config('request.jwt.claim.sub', pg_temp.test_user('bob')::text, true);
select pg_temp.assert_true(public.get_rally_progress(pg_temp.test_id('active')) = '{}', '別ユーザーの進捗を返さない');
select pg_temp.assert_true((select count(*) from public.rally_checks) = 0, '直接SELECTでも他人の進捗を見られない');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('active'), 'cutter')$q$, '参加登録が必要');
select public.apply_event(pg_temp.test_id('active'));
select pg_temp.assert_true(public.complete_rally_mission(pg_temp.test_id('active'), 'cutter') = array['cutter'], '既存の参加RPCと連動する');
select public.cancel_registration(pg_temp.test_id('active'));
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('active'), 'net')$q$, '参加登録が必要');
select pg_temp.assert_true(public.get_rally_progress(pg_temp.test_id('active')) = array['cutter'], '取消しても本人の履歴は保持する');
select public.apply_event(pg_temp.test_id('active'));
select pg_temp.assert_true(public.get_rally_progress(pg_temp.test_id('active')) = array['cutter'], '再申込時に履歴が復元される');
select pg_temp.expect_error($q$select public.apply_event(pg_temp.test_id('closed'))$q$, '招待制');

select set_config('request.jwt.claim.sub', pg_temp.test_user('organizer')::text, true);
select pg_temp.assert_true((select count(*) from public.rally_checks) = 7, '主催者は自分のイベントの達成記録だけを見られる');
select pg_temp.assert_true(public.get_rally_progress(pg_temp.test_id('active')) = '{}', '主催者でも進捗RPCは本人分だけ');
insert into public.events (title, event_date, start_time, end_time, capacity)
values ('admin event', current_date, '10:00', '12:00', 5);
select set_config('test.rally_token', public.create_invite_link(pg_temp.test_id('closed')), true);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.get_rally_progress(pg_temp.test_id('active'))$q$, 'permission denied');
select pg_temp.expect_error($q$select public.complete_rally_mission(pg_temp.test_id('active'), 'cutter')$q$, 'permission denied');
select pg_temp.assert_true(
  (select count(*) from public.get_invite(current_setting('test.rally_token'))) = 1,
  '匿名の招待ページを維持する'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.test_user('bob')::text, true);
select pg_temp.assert_true((select count(*) from public.get_event(pg_temp.test_id('closed'))) = 0, '招待制の詳細はトークンなしでは見られない');
select pg_temp.assert_true(
  (select count(*) from public.get_event(pg_temp.test_id('closed'), current_setting('test.rally_token'))) = 1,
  '招待トークン付きの詳細取得を維持する'
);
select public.apply_event(pg_temp.test_id('closed'), 1, current_setting('test.rally_token'));
select pg_temp.assert_true(public.complete_rally_mission(pg_temp.test_id('closed'), 'song') = array['song'], '招待経由の参加者も達成できる');

reset role;
rollback;
