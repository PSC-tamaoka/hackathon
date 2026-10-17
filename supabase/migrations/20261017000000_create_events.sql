-- ホーム(カレンダー)用のイベント一覧。他テーブルは別マイグレーションで追加する。
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references auth.users(id),
  title text not null,
  description text,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  reception_note text,
  place text not null,
  place_short text,
  address text,
  capacity int not null default 0,
  remaining int not null default 0,
  scope text not null default 'open' check (scope in ('open', 'closed')),
  tag_label text,
  tag_tone text check (tag_tone in ('tertiary', 'secondary')),
  cover_url text,
  status text not null default 'published' check (status in ('draft', 'published', 'closed', 'canceled')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events_select_published" on public.events
  for select using (status = 'published' and not is_hidden);
