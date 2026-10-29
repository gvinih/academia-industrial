-- Academia Industrial: integração do quiz interativo 5S — Seiri.
-- Execute este arquivo no SQL Editor do Supabase do projeto em produção.
-- O quiz especial utiliza sort_order 9001–9005; o quiz padrão ignora essa faixa.

insert into public.quiz_questions
  (id, subject_id, question_text, options, correct_option, explanation, sort_order, is_active)
values
('00000000-0000-4000-8000-000000009001','5s',
 '1. Qual foi a principal motivação para o surgimento do programa 5S no Japão pós-guerra e sua adoção nas indústrias?',
 jsonb_build_array(
   '(A) Substituir os gerentes de produção por comissões de operadores.',
   '(B) Combater a sujeira, a desorganização e otimizar custos reduzindo os desperdícios nas fábricas.',
   '(C) Obrigar os colaboradores a realizarem tarefas fora do seu horário de trabalho.',
   '(D) Eliminar a necessidade de sinalização de segurança no chão de fábrica.'
 ),1,
 'O 5S surgiu no Japão pós-guerra para reorganizar as indústrias devastadas, combatendo a sujeira e reduzindo desperdícios essenciais para a reconstrução do país.',9001,true),
('00000000-0000-4000-8000-000000009002','5s',
 '2. Em que consiste fundamentalmente o primeiro senso do programa, o Seiri (Utilização)?',
 jsonb_build_array(
   '(A) Em pintar todas as máquinas e paredes da fábrica com cores padronizadas.',
   '(B) Em separar os materiais e ferramentas úteis dos inúteis, mantendo no posto de trabalho apenas o estritamente necessário.',
   '(C) Em organizar as ferramentas exclusivamente por ordem alfabética de seus nomes.',
   '(D) Em realizar a limpeza pesada do piso uma vez por ano.'
 ),1,
 'Seiri é a etapa de triagem e descarte consciente. Fica no posto apenas aquilo que realmente agrega valor e é de uso imediato.',9002,true),
('00000000-0000-4000-8000-000000009003','5s',
 '3. De acordo com a regra prática do Seiri na fábrica, qual é a orientação para itens que não são utilizados há mais de 6 meses?',
 jsonb_build_array(
   '(A) Devem ser mantidos sobre a bancada principal para o caso de surgir uma emergência.',
   '(B) Devem ser escondidos atrás dos armários para não acumularem poeira.',
   '(C) São considerados desnecessários, devendo ser segregados para avaliação de descarte ou redistribuição junto à liderança.',
   '(D) Devem ser descartados no lixo comum imediatamente sem autorização prévia.'
 ),2,
 'A regra prática orienta que itens sem uso há mais de 6 meses sejam encaminhados para análise da liderança para destinação correta (reuso, venda ou descarte).',9003,true),
('00000000-0000-4000-8000-000000009004','5s',
 '4. Qual é a função prática da Etiqueta Vermelha (ou Cartão Vermelho) e da Área de Segregação?',
 jsonb_build_array(
   '(A) Identificar colaboradores que cometeram infrações de segurança.',
   '(B) Marcar itens duvidosos ou desnecessários no posto de trabalho e direcioná-los a um local temporário para avaliação de destinação.',
   '(C) Sinalizar produtos acabados que já foram aprovados para envio aos clientes.',
   '(D) Reservar ferramentas para uso exclusivo da gerência da empresa.'
 ),1,
 'A etiqueta vermelha sinaliza o item suspeito e a área de segregação o armazena temporariamente até o time decidir seu destino sem poluir a área operacional.',9004,true),
('00000000-0000-4000-8000-000000009005','5s',
 '5. Como os materiais e ferramentas necessários devem ser posicionados no posto de trabalho após a triagem do Seiri?',
 jsonb_build_array(
   '(A) Todos os itens devem ficar guardados no almoxarifado central, independentemente da frequência de uso.',
   '(B) Materiais de uso diário/constante ficam ao alcance direto das mãos, enquanto itens de uso semanal ou ocasional ficam em locais mais afastados.',
   '(C) Materiais de uso diário devem ser guardados no alto e os de uso raro perto das mãos.',
   '(D) Todos os materiais devem ser empilhados no centro da bancada de operação.'
 ),1,
 'A disposição ergonomicamente correta coloca os itens de alta frequência de uso bem próximos das mãos, otimizando o tempo de ciclo e reduzindo fadiga.',9005,true)
on conflict (id) do update set
  subject_id=excluded.subject_id,
  question_text=excluded.question_text,
  options=excluded.options,
  correct_option=excluded.correct_option,
  explanation=excluded.explanation,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active;

-- Permite o quiz padrão de 10 questões e o quiz Seiri de 5 questões.
-- A correção continua no servidor; o cliente não informa pontuação.
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

  -- Mantém a escala de 0 a 100 para quizzes de 5 e 10 questões.
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
