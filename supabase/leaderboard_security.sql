-- Academia Industrial: substituir a view SECURITY DEFINER por RPC de ranking agregado.
-- Execute uma única vez no SQL Editor do Supabase de produção.
-- A função retorna somente nome, pontos agregados e quantidade de quizzes;
-- não expõe respostas, notas individuais ou histórico de tentativas.

begin;

drop view if exists public.leaderboard;

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
  left join scores as s on s.user_id = p.id;
end;
$$;

revoke all on function public.get_leaderboard() from public;
revoke all on function public.get_leaderboard() from anon;
grant execute on function public.get_leaderboard() to authenticated;

commit;
