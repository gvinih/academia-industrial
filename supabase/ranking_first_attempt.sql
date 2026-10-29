-- Academia Industrial: pontuação acumulada por quiz, contando apenas a primeira tentativa.
-- Execute este arquivo no SQL Editor do Supabase de produção.
-- A migração preserva o histórico e identifica quizzes especiais pelos sort_order das perguntas.

alter table public.quiz_attempts
  add column if not exists quiz_key text not null default 'normal';

-- Reclassifica tentativas especiais já existentes (ex.: Seiri 9001–9005; Lubrificação 9101–9105).
update public.quiz_attempts a
set quiz_key = 'special_' || (
  select min(q.sort_order)::text
  from jsonb_array_elements(a.answers) ans
  join public.quiz_questions q on q.id = (ans->>'question_id')::uuid
  where q.subject_id = a.subject_id and q.sort_order >= 9001
)
where a.total_questions = 5
  and exists (
    select 1
    from jsonb_array_elements(a.answers) ans
    join public.quiz_questions q on q.id = (ans->>'question_id')::uuid
    where q.subject_id = a.subject_id and q.sort_order >= 9001
  );

-- O ranking soma a primeira tentativa de cada quiz (matéria + quiz_key).
-- Tentativas posteriores ficam no histórico, mas não aumentam os pontos.
create or replace view public.leaderboard as
select p.id as user_id, p.display_name,
       coalesce((
         select sum(first_attempt.points)::integer
         from (
           select distinct on (a.subject_id, a.quiz_key)
                  a.subject_id, a.quiz_key, a.points
           from public.quiz_attempts a
           where a.user_id = p.id
           order by a.subject_id, a.quiz_key, a.submitted_at asc, a.id asc
         ) first_attempt
       ), 0)::integer as total_points,
       (select count(distinct (a.subject_id, a.quiz_key))::integer
        from public.quiz_attempts a where a.user_id = p.id) as completed_subjects
from public.profiles p;

-- Recria a RPC para identificar o quiz e premiar somente a primeira tentativa.
drop function if exists public.submit_quiz(text, jsonb);

create function public.submit_quiz(p_subject_id text, p_answers jsonb)
returns table(
  score integer,
  total_questions integer,
  points_awarded integer,
  best_score integer,
  is_first_attempt boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_total integer;
  v_score integer;
  v_answers_count integer;
  v_points integer;
  v_awarded integer;
  v_best integer;
  v_saved jsonb;
  v_invalid_count integer;
  v_min_sort integer;
  v_min_group integer;
  v_max_group integer;
  v_quiz_key text;
  v_first_attempt boolean;
begin
  if v_user is null then
    raise exception 'Você precisa entrar para enviar respostas.';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Formato de respostas inválido.';
  end if;

  v_total := jsonb_array_length(p_answers);
  if v_total not in (5, 10) then
    raise exception 'A tentativa deve conter exatamente 5 ou 10 perguntas.';
  end if;

  select count(*) into v_answers_count
  from (
    select distinct a.question_id
    from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  ) submitted
  join public.quiz_questions q on q.id = submitted.question_id
  where q.subject_id = p_subject_id and q.is_active = true;

  if v_answers_count <> v_total then
    raise exception 'As respostas devem corresponder a perguntas ativas, diferentes e da matéria selecionada.';
  end if;

  if v_total = 10 then
    v_quiz_key := 'normal';
    if exists (
      select 1
      from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
      join public.quiz_questions q on q.id = a.question_id
      where q.subject_id = p_subject_id and q.is_active = true
        and q.sort_order >= 9001
    ) then
      raise exception 'O quiz normal só pode conter perguntas do banco geral.';
    end if;
  else
    select min(q.sort_order), min(q.sort_order / 100), max(q.sort_order / 100)
      into v_min_sort, v_min_group, v_max_group
    from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
    join public.quiz_questions q on q.id = a.question_id
    where q.subject_id = p_subject_id and q.is_active = true;

    if v_min_sort is null or v_min_sort < 9001 or v_min_group <> v_max_group then
      raise exception 'O quiz especial deve conter as cinco perguntas do mesmo módulo especial.';
    end if;
    v_quiz_key := 'special_' || v_min_sort::text;
  end if;

  select count(*) into v_invalid_count
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id = a.question_id
  where q.subject_id = p_subject_id and q.is_active = true
    and (a.selected_option is null or a.selected_option < 0
         or a.selected_option >= jsonb_array_length(q.options));

  if v_invalid_count > 0 then
    raise exception 'Uma ou mais alternativas selecionadas são inválidas.';
  end if;

  select count(*) filter (where q.correct_option = a.selected_option)
    into v_score
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id = a.question_id
  where q.subject_id = p_subject_id and q.is_active = true;

  v_points := round((v_score::numeric * 100) / v_total)::integer;

  select jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'selected_option', a.selected_option,
      'correct', q.correct_option = a.selected_option,
      'explanation', q.explanation
    ) order by q.sort_order
  ) into v_saved
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id = a.question_id
  where q.subject_id = p_subject_id and q.is_active = true;

  -- Serializa envios simultâneos do mesmo usuário para o mesmo quiz.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_subject_id || ':' || v_quiz_key, 0));

  select not exists (
    select 1 from public.quiz_attempts a
    where a.user_id = v_user
      and a.subject_id = p_subject_id
      and a.quiz_key = v_quiz_key
  ) into v_first_attempt;

  v_awarded := case when v_first_attempt then v_points else 0 end;

  insert into public.quiz_attempts(
    user_id, subject_id, quiz_key, score, total_questions, points, answers
  )
  values (
    v_user, p_subject_id, v_quiz_key, v_score, v_total, v_awarded, coalesce(v_saved, '[]'::jsonb)
  );

  select coalesce(sum(first_attempt.points), 0)::integer into v_best
  from (
    select distinct on (a.quiz_key) a.quiz_key, a.points
    from public.quiz_attempts a
    where a.user_id = v_user and a.subject_id = p_subject_id
    order by a.quiz_key, a.submitted_at asc, a.id asc
  ) first_attempt;

  return query select v_score, v_total, v_awarded, v_best, v_first_attempt;
end;
$$;

grant execute on function public.submit_quiz(text, jsonb) to authenticated;
grant select on public.leaderboard to authenticated;
