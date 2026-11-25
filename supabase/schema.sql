-- Shared demo state for Get your Cl@ve (phone + laptop live sync).
-- Run this once in the Supabase SQL editor (Project → SQL → New query).

create table if not exists public.clave_demo_state (
  id text primary key default 'main',
  shared jsonb not null,
  writer text,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.clave_demo_state enable row level security;

-- Public academic demo: anyone with the anon key can read/write this one row.
-- Do not store real personal data here.
drop policy if exists "clave_demo_select" on public.clave_demo_state;
drop policy if exists "clave_demo_insert" on public.clave_demo_state;
drop policy if exists "clave_demo_update" on public.clave_demo_state;

create policy "clave_demo_select" on public.clave_demo_state
  for select to anon, authenticated using (true);

create policy "clave_demo_insert" on public.clave_demo_state
  for insert to anon, authenticated with check (true);

create policy "clave_demo_update" on public.clave_demo_state
  for update to anon, authenticated using (true) with check (true);

-- Realtime (pick one):
--   Dashboard → Database → Publications → supabase_realtime → enable clave_demo_state
--   or, if not already added:
-- alter publication supabase_realtime add table public.clave_demo_state;
