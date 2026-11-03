-- Academia Industrial: administradores não participam do ranking.
-- Execute uma vez no SQL Editor do Supabase de produção.
-- Mantém a RPC usada pelo aplicativo e a view usada para inspeção no painel.

begin;

create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  total_points integer,
  completed_subjects integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado para consultar o ranking.'
      using errcode = '42501';
  end if;

  return query
  with first_attempt as (
    select distinct on (a.user_id, a.subject_id, a.quiz_key)
      a.user_id,
      a.subject_id,
      a.quiz_key,
      a.points
    from public.quiz_attempts as a
    order by
      a.user_id,
      a.subject_id,
      a.quiz_key,
      a.submitted_at,
      a.id
  ),
  scores as (
    select
      f.user_id,
      coalesce(sum(f.points), 0)::integer as total_points,
      count(distinct row(f.subject_id, f.quiz_key))::integer as completed_subjects
    from first_attempt as f
    group by f.user_id
  )
  select
    p.id as user_id,
    p.display_name,
    coalesce(s.total_points, 0)::integer as total_points,
    coalesce(s.completed_subjects, 0)::integer as completed_subjects
  from public.profiles as p
  left join scores as s on s.user_id = p.id
  where p.role = 'student';
end;
$$;

revoke all on function public.get_leaderboard() from public;
revoke all on function public.get_leaderboard() from anon;
grant execute on function public.get_leaderboard() to authenticated;

create or replace view public.leaderboard
with (security_invoker = true)
as
with first_attempt as (
  select distinct on (a.user_id, a.subject_id, a.quiz_key)
    a.user_id,
    a.subject_id,
    a.quiz_key,
    a.points
  from public.quiz_attempts as a
  order by
    a.user_id,
    a.subject_id,
    a.quiz_key,
    a.submitted_at,
    a.id
),
scores as (
  select
    f.user_id,
    coalesce(sum(f.points), 0)::integer as total_points,
    count(distinct row(f.subject_id, f.quiz_key))::integer as completed_subjects
  from first_attempt as f
  group by f.user_id
)
select
  p.id as user_id,
  p.display_name,
  coalesce(s.total_points, 0)::integer as total_points,
  coalesce(s.completed_subjects, 0)::integer as completed_subjects
from public.profiles as p
left join scores as s on s.user_id = p.id
where p.role = 'student';

revoke all on public.leaderboard from public;
revoke all on public.leaderboard from anon;
grant select on public.leaderboard to authenticated;

commit;
