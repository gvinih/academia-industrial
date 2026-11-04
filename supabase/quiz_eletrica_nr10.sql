-- Academia Industrial: quiz interativo de Segurança em Eletricidade e NR-10.
-- Execute este arquivo no SQL Editor do Supabase do projeto em produção.
-- O quiz especial utiliza sort_order 9201–9205; o quiz padrão ignora sort_order >= 9001.

insert into public.quiz_questions
  (id, subject_id, question_text, options, correct_option, explanation, sort_order, is_active)
values
('00000000-0000-4000-8000-000000009201','eletrica',
 'Qual é a regra número um antes de realizar qualquer trabalho em um circuito elétrico?',
 jsonb_build_array(
   'Trabalhar com rapidez usando luvas simples.',
   'Garantir que o circuito esteja desenergizado, bloqueado e testado.',
   'Apenas desligar o interruptor principal sem colocar cadeado.',
   'Usar ferramentas metálicas comuns com o painel ligado.'
 ),1,
 'A intervenção deve ocorrer somente após a desenergização, o bloqueio e a verificação da ausência de tensão, seguindo o procedimento de segurança aplicável.',9201,true),
('00000000-0000-4000-8000-000000009202','eletrica',
 'De acordo com a NR-10, qual deve ser a conduta do operador ao perceber um problema elétrico na máquina?',
 jsonb_build_array(
   'Abrir o painel e tentar consertar a fiação por conta própria.',
   'Burlar os sensores de segurança para manter a produção funcionando.',
   'Parar a máquina imediatamente e chamar a equipe de manutenção.',
   'Trocar os fusíveis por outros de maior capacidade.'
 ),2,
 'O operador deve interromper a operação diante de uma condição anormal e acionar a equipe responsável. Intervenções elétricas devem ser realizadas por trabalhadores autorizados e qualificados, conforme os procedimentos aplicáveis.',9202,true),
('00000000-0000-4000-8000-000000009203','eletrica',
 'Sobre o procedimento de Bloqueio e Etiquetagem, quem deve retirar o cadeado de bloqueio?',
 jsonb_build_array(
   'Qualquer operador que precise usar a máquina.',
   'O supervisor do turno, independentemente de quem instalou o cadeado.',
   'A pessoa responsável que colocou o cadeado, conforme o procedimento de bloqueio da empresa.',
   'Qualquer técnico da manutenção que esteja disponível.'
 ),2,
 'O bloqueio é pessoal e deve ser removido por quem o instalou, conforme o procedimento estabelecido. Situações excepcionais exigem procedimento formal específico, nunca a retirada informal por terceiros.',9203,true),
('00000000-0000-4000-8000-000000009204','eletrica',
 'Qual é a sensibilidade nominal de corrente diferencial-residual associada à proteção adicional de pessoas contra choques elétricos?',
 jsonb_build_array(
   '1 mA.',
   '30 mA.',
   '100 mA.',
   '10 A.'
 ),1,
 'Dispositivos DR de alta sensibilidade, com corrente diferencial-residual nominal de até 30 mA, são empregados como proteção adicional contra choques elétricos em aplicações previstas nas normas. O DR não substitui as demais medidas de proteção.',9204,true),
('00000000-0000-4000-8000-000000009205','eletrica',
 'Se um operador notar um cabo danificado, cheiro de queimado ou faíscas na máquina, qual conduta deve adotar?',
 jsonb_build_array(
   'Continuar trabalhando até o final do turno.',
   'Jogar água sobre o cabo para resfriá-lo.',
   'Parar a máquina, manter distância segura e avisar a manutenção.',
   'Isolar a área com fita e continuar operando.'
 ),2,
 'Cabos danificados, faíscas e cheiro de queimado indicam risco. A operação deve ser interrompida e a equipe responsável acionada; não se deve tocar no cabo nem aplicar água.',9205,true)
on conflict (id) do update set
  subject_id=excluded.subject_id,
  question_text=excluded.question_text,
  options=excluded.options,
  correct_option=excluded.correct_option,
  explanation=excluded.explanation,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active;
