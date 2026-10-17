-- 認証まわりのDB: users / shibukawa_experiences / 登録トリガー / is_admin()
-- Supabase CLI 未導入のため、SQL Editor に貼って実行する

create table public.users (
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

create table public.shibukawa_experiences (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  year int not null,
  school_name text not null,
  grade text,
  role_then text,
  programs text[],
  created_at timestamptz not null default now()
);

create index shibukawa_experiences_user_id_idx on public.shibukawa_experiences (user_id);

-- Supabase は新規テーブルに anon / authenticated へ全権限を既定で付ける。
-- users はトリガー以外の insert と、is_admin など機微な列の update を禁じる
revoke insert, update, delete on public.users from anon, authenticated;
grant update (name, nickname, city, age_group, notify_email, notify_push) on public.users to authenticated;

alter table public.users enable row level security;
alter table public.shibukawa_experiences enable row level security;

create policy users_select_own on public.users for select using (auth.uid() = id);
create policy users_update_own on public.users for update using (auth.uid() = id);

create policy shibukawa_experiences_select_own on public.shibukawa_experiences
  for select using (user_id = auth.uid());
create policy shibukawa_experiences_insert_own on public.shibukawa_experiences
  for insert with check (user_id = auth.uid());
create policy shibukawa_experiences_update_own on public.shibukawa_experiences
  for update using (user_id = auth.uid());
create policy shibukawa_experiences_delete_own on public.shibukawa_experiences
  for delete using (user_id = auth.uid());

-- 管理者判定。events などの RLS からも使う(例: with check (public.is_admin()))
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false)
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- 新規登録(auth.users への insert)でプロフィールと最初の渋川経験を自動作成する
create function public.handle_new_user() returns trigger
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
