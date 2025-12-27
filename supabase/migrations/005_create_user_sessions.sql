create table if not exists public.user_sessions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  device_info text,
  ip_address text,
  last_active timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.user_sessions enable row level security;

create policy "Users can view own sessions"
  on public.user_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.user_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.user_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.user_sessions for delete
  using (auth.uid() = user_id);
