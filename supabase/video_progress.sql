-- Acompanhamento individual de reprodução dos vídeos.
-- Execute no SQL Editor do Supabase. A tabela registra progresso por aluno e vídeo.
create table if not exists public.video_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  last_position numeric(10,2) not null default 0 check (last_position >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table public.video_progress enable row level security;
drop policy if exists "users read own video progress" on public.video_progress;
create policy "users read own video progress" on public.video_progress for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "users insert own video progress" on public.video_progress;
create policy "users insert own video progress" on public.video_progress for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own video progress" on public.video_progress;
create policy "users update own video progress" on public.video_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.video_progress to authenticated;
