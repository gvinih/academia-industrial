-- Academia Industrial: view de consulta do ranking.
-- A aplicação continua usando public.get_leaderboard() via RPC.
-- Esta view existe para inspeção no Supabase (Database > Views).
--
-- SECURITY INVOKER faz a view respeitar as permissões e políticas RLS
-- do usuário que a consulta. Não recria a antiga view SECURITY DEFINER.

begin;

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
left join scores as s on s.user_id = p.id;

revoke all on public.leaderboard from public;
revoke all on public.leaderboard from anon;
grant select on public.leaderboard to authenticated;

commit;

-- A função RPC permanece intacta e continua sendo a consulta do aplicativo:
-- supabase.rpc('get_leaderboard')
