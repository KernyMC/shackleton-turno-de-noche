-- Respaldo de los JSON de public/data (fuente principal: el archivo estático del repo).
-- Lo lee la Vercel Function /api/gamedata solo si el navegador no pudo cargar el JSON.
-- Solo lectura pública: nadie escribe desde el navegador (el script de subida usa la clave secreta).

create table if not exists public.game_data (
  name text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_data enable row level security;

drop policy if exists "game_data lectura publica" on public.game_data;
create policy "game_data lectura publica"
  on public.game_data for select
  to anon, authenticated
  using (true);

comment on table public.game_data is
  'Shackleton: copia de respaldo de public/data/*.json. Fuente principal = JSON del repo.';
