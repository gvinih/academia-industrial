-- Academia Industrial: quiz interativo de Lubrificação Básica.
-- Execute este arquivo no SQL Editor do Supabase do projeto em produção.
-- O quiz especial usa sort_order 9101–9105; o quiz padrão ignora perguntas com sort_order >= 9001.

insert into public.quiz_questions
  (id, subject_id, question_text, options, correct_option, explanation, sort_order, is_active)
values
('00000000-0000-4000-8000-000000009101','lubrificacao',
 '1. Qual é a principal função da lubrificação entre duas superfícies em movimento?',
 jsonb_build_array(
   '(A) Aumentar o atrito para impedir que as peças deslizem.',
   '(B) Reduzir o atrito e o desgaste, ajudando também a controlar a temperatura.',
   '(C) Substituir a necessidade de inspeção e manutenção.',
   '(D) Eliminar permanentemente qualquer vibração do equipamento.'
 ),1,
 'O lubrificante forma uma película entre as superfícies, reduzindo o contato direto, o atrito e o desgaste. Dependendo da aplicação, também ajuda a dissipar calor e proteger contra corrosão.',9101,true),
('00000000-0000-4000-8000-000000009102','lubrificacao',
 '2. O que a viscosidade de um óleo lubrificante representa?',
 jsonb_build_array(
   '(A) A resistência do fluido ao escoamento.',
   '(B) A quantidade de aditivos coloridos presentes no óleo.',
   '(C) A capacidade do óleo de se transformar em graxa.',
   '(D) A temperatura exata em que qualquer máquina deve operar.'
 ),0,
 'Viscosidade é a resistência de um fluido ao escoamento. O grau correto deve seguir a especificação do fabricante e as condições de operação do equipamento.',9102,true),
('00000000-0000-4000-8000-000000009103','lubrificacao',
 '3. Qual prática ajuda a evitar a contaminação do lubrificante durante o abastecimento?',
 jsonb_build_array(
   '(A) Deixar recipientes abertos perto da máquina para facilitar o acesso.',
   '(B) Usar o mesmo funil para todos os produtos sem limpeza.',
   '(C) Manter recipientes identificados, fechados e usar ferramentas limpas e adequadas.',
   '(D) Completar o reservatório com qualquer óleo disponível.'
 ),2,
 'Recipientes fechados e identificados, ferramentas limpas e armazenamento correto ajudam a impedir a entrada de poeira, água e outros contaminantes.',9103,true),
('00000000-0000-4000-8000-000000009104','lubrificacao',
 '4. Qual é uma diferença geral entre óleo lubrificante e graxa?',
 jsonb_build_array(
   '(A) A graxa nunca contém óleo em sua composição.',
   '(B) O óleo é sempre indicado para qualquer equipamento, sem exceção.',
   '(C) A graxa elimina a necessidade de respeitar intervalos de relubrificação.',
   '(D) O óleo tende a fluir e circular; a graxa tem consistência que ajuda a permanecer no ponto aplicado.'
 ),3,
 'Óleos normalmente fluem e podem circular por sistemas. Graxas são lubrificantes semissólidos, formulados com óleo-base e espessante, e costumam permanecer melhor em determinados pontos de aplicação.',9104,true),
('00000000-0000-4000-8000-000000009105','lubrificacao',
 '5. Ao perceber vazamento, ruído anormal ou aquecimento após a lubrificação, qual é a atitude correta?',
 jsonb_build_array(
   '(A) Ignorar o sinal se a máquina ainda estiver funcionando.',
   '(B) Comunicar a anomalia e seguir o procedimento de segurança e manutenção aplicável.',
   '(C) Adicionar mais lubrificante imediatamente, sem verificar a causa.',
   '(D) Misturar outro tipo de lubrificante para tentar corrigir o problema.'
 ),1,
 'Vazamentos, ruídos e aquecimento podem indicar falha, excesso ou falta de lubrificante, contaminação ou outro problema. A anomalia deve ser comunicada e tratada conforme o procedimento de segurança, sem improvisos.',9105,true)
on conflict (id) do update set
  subject_id=excluded.subject_id,
  question_text=excluded.question_text,
  options=excluded.options,
  correct_option=excluded.correct_option,
  explanation=excluded.explanation,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active;

-- Compatibilidade com quizzes padrão de 10 questões e quizzes especiais de 5 questões.
-- A pontuação é calculada no servidor, não pelo navegador.
create or replace function public.submit_quiz(p_subject_id text, p_answers jsonb)
returns table(score integer, total_questions integer, points_awarded integer, best_score integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_total integer;
  v_score integer;
  v_answers_count integer;
  v_points integer;
  v_best integer;
  v_saved jsonb;
  v_invalid_count integer;
begin
  if v_user is null then raise exception 'Você precisa entrar para enviar respostas.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'Formato de respostas inválido.'; end if;
  v_total := jsonb_array_length(p_answers);
  if v_total not in (5,10) then raise exception 'A tentativa deve conter exatamente 5 ou 10 perguntas.'; end if;

  select count(*) into v_answers_count
  from (
    select distinct a.question_id
    from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  ) submitted
  join public.quiz_questions q on q.id=submitted.question_id
  where q.subject_id=p_subject_id and q.is_active=true;

  if v_answers_count <> v_total then
    raise exception 'As respostas devem corresponder a 5 ou 10 perguntas ativas e diferentes desta matéria.'; end if;

  select count(*) into v_invalid_count
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id=a.question_id
  where q.subject_id=p_subject_id and q.is_active=true
    and (a.selected_option is null or a.selected_option < 0 or a.selected_option >= jsonb_array_length(q.options));

  if v_invalid_count > 0 then raise exception 'Uma ou mais alternativas selecionadas são inválidas.'; end if;

  select count(*) filter (where q.correct_option=a.selected_option)
    into v_score
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id=a.question_id
  where q.subject_id=p_subject_id and q.is_active=true;

  v_points := round((v_score::numeric * 100) / v_total)::integer;
  select jsonb_agg(jsonb_build_object('question_id',q.id,'selected_option',a.selected_option,'correct',q.correct_option=a.selected_option,'explanation',q.explanation) order by q.sort_order)
    into v_saved
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id=a.question_id
  where q.subject_id=p_subject_id and q.is_active=true;

  insert into public.quiz_attempts(user_id,subject_id,score,total_questions,points,answers)
  values(v_user,p_subject_id,v_score,v_total,v_points,coalesce(v_saved,'[]'::jsonb));

  select max(points) into v_best from public.quiz_attempts
  where user_id=v_user and subject_id=p_subject_id;

  return query select v_score,v_total,v_points,v_best;
end;
$$;

grant execute on function public.submit_quiz(text,jsonb) to authenticated;
