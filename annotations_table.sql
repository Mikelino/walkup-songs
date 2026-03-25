-- ============================================================
--  Diamond Pulse — Table annotations
--  À exécuter dans Supabase > SQL Editor
-- ============================================================

create table if not exists public.annotations (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null,
  video_name  text,
  time_sec    float not null,
  note        text,
  strokes     jsonb,
  created_at  timestamptz default now()
);

-- Index pour charger rapidement les annotations d'un joueur
create index if not exists annotations_player_id_idx
  on public.annotations (player_id);

-- RLS : accès public (même politique que la table config)
alter table public.annotations enable row level security;

create policy "Public read annotations"
  on public.annotations for select
  using (true);

create policy "Public insert annotations"
  on public.annotations for insert
  with check (true);

create policy "Public delete annotations"
  on public.annotations for delete
  using (true);
