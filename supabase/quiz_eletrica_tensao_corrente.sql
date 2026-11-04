-- Academia Industrial: segundo quiz de Elétrica Básica — Tensão, Corrente e Tipos de Energia.
-- Execute este arquivo no SQL Editor do Supabase do projeto em produção.
-- Este quiz utiliza sort_order 9211–9215 e permanece separado do quiz NR-10 (9201–9205).

insert into public.quiz_questions
  (id, subject_id, question_text, options, correct_option, explanation, sort_order, is_active)
values
('00000000-0000-4000-8000-000000009211','eletrica',
 'Qual instrumento é indicado na apostila para conferir a corrente elétrica?',
 jsonb_build_array(
   'Multímetro, exclusivamente.',
   'Alicate amperímetro.',
   'Termômetro infravermelho.',
   'Megômetro, exclusivamente.'
 ),1,
 'A corrente elétrica é medida em amperes (A), e a apostila indica o alicate amperímetro para conferi-la de forma prática.',9211,true),
('00000000-0000-4000-8000-000000009212','eletrica',
 'Nas máquinas, a corrente contínua de 24 V é utilizada normalmente para alimentar quais componentes?',
 jsonb_build_array(
   'Motores e resistências.',
   'Apenas a iluminação do galpão.',
   'Botões, sensores, CLP e válvulas solenoides.',
   'Somente a chave geral e os disjuntores.'
 ),2,
 'A corrente contínua (CC) de 24 V é utilizada normalmente no circuito de comando, alimentando botões, sensores, CLP e válvulas solenoides.',9212,true),
('00000000-0000-4000-8000-000000009213','eletrica',
 'Qual alternativa explica corretamente a diferença entre o condutor Neutro e o Terra (PE)?',
 jsonb_build_array(
   'O neutro faz parte do circuito e conduz a corrente de retorno; o terra é proteção e conduz corrente em caso de defeito.',
   'O neutro é proteção e só conduz corrente quando há defeito; o terra faz parte do retorno normal.',
   'Neutro e terra têm a mesma função e podem ser usados indistintamente.',
   'O terra alimenta os sensores e o neutro alimenta o motor.'
 ),0,
 'O neutro é o condutor de retorno da corrente no funcionamento normal do circuito. O condutor de proteção (PE) é destinado à segurança e conduz corrente em condições de falha.',9213,true),
('00000000-0000-4000-8000-000000009214','eletrica',
 'Em um sensor industrial de três fios, qual identificação corresponde ao padrão apresentado na apostila?',
 jsonb_build_array(
   'Marrom = saída; azul = +24 V; preto = 0 V.',
   'Marrom = 0 V; azul = saída; preto = +24 V.',
   'Marrom = +24 V; azul = 0 V; preto = saída.',
   'Marrom = terra; azul = fase; preto = neutro.'
 ),2,
 'No padrão de cores apresentado para sensores industriais de três fios, marrom corresponde ao positivo (+24 V), azul ao 0 V e preto ao sinal de saída.',9214,true),
('00000000-0000-4000-8000-000000009215','eletrica',
 'Durante a operação, você percebe que o motor está mais quente que o normal e há cheiro de queimado. O que deve fazer?',
 jsonb_build_array(
   'Continuar operando, pois o aquecimento é esperado no fim do turno.',
   'Abrir o painel e procurar o componente que está aquecendo.',
   'Desconectar o fio terra para verificar se o aquecimento diminui.',
   'Parar a máquina e avisar a manutenção.'
 ),3,
 'Aquecimento excessivo e odor de queimado indicam uma anomalia. A conduta é interromper a operação e acionar a equipe de manutenção, sem abrir o painel ou manipular componentes.',9215,true)
on conflict (id) do update set
  subject_id=excluded.subject_id,
  question_text=excluded.question_text,
  options=excluded.options,
  correct_option=excluded.correct_option,
  explanation=excluded.explanation,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active;
