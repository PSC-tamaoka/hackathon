-- 画面の管理者ゲートだけでなく、直接のAPI呼び出しにも同じ制限を適用する。
drop policy "誰でもイベントを作れる" on public.events;
create policy "管理者だけイベントを作れる" on public.events
  for insert to authenticated
  with check (organizer_id = (select auth.uid()) and (select public.is_admin()));
