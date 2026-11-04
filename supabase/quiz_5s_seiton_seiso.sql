-- Academia Industrial: Quiz 5S — Encontro 2 (Seiton e Seiso).
-- Execute no SQL Editor do Supabase antes de publicar/usar o novo quiz.
-- Faixa 9006–9010, separada do Quiz Seiri (9001–9005) e do quiz geral.

insert into public.quiz_questions
  (id, subject_id, question_text, options, correct_option, explanation, sort_order, is_active)
values
('00000000-0000-4000-8000-000000009006','5s',
 '1. Qual é o conceito fundamental do 2º Senso – Seiton (Ordenação) e qual é a meta de tempo esperada para localizar um item no posto de trabalho?',
 jsonb_build_array(
   'Empilhar todas as ferramentas em uma caixa fechada, com meta de localização em até 10 minutos.',
   'Definir “um lugar para cada coisa e cada coisa em seu lugar”, permitindo que qualquer colaborador encontre qualquer item em menos de 1 minuto.',
   'Guardar os materiais no almoxarifado central sem identificação visual, com meta de busca de até 5 minutos.',
   'Mudar a posição das ferramentas diariamente para variar a rotina operacional.'
 ),1,
 'O conceito central do Seiton é ter “um lugar para cada coisa e cada coisa em seu lugar”, com o objetivo prático de localizar qualquer item em menos de 1 minuto.',9006,true),
('00000000-0000-4000-8000-000000009007','5s',
 '2. Na organização do posto de trabalho conforme o Seiton, como devem ser dispostos os materiais em relação à sua frequência de uso?',
 jsonb_build_array(
   'Todos os itens, independentemente da frequência de uso, devem ficar armazenados nas prateleiras superiores.',
   'Itens de uso frequente ou diário devem ficar mais próximos da área de operação, enquanto itens de uso ocasional ficam em locais mais afastados.',
   'Ferramentas de uso diário devem ser guardadas no fundo de armários trancados.',
   'Materiais sem uso previsível devem ser mantidos no centro da bancada principal.'
 ),1,
 'A arrumação racional baseia-se na frequência de uso: o que é utilizado constantemente fica ao alcance fácil e imediato das mãos.',9007,true),
('00000000-0000-4000-8000-000000009008','5s',
 '3. Quais estratégias são comumente utilizadas no Seiton para facilitar a gestão visual e a identificação dos locais de cada ferramenta na fábrica?',
 jsonb_build_array(
   'Pintura aleatória de máquinas e remoção de etiquetas de identificação.',
   'Painel de sombra com o perfil desenhado das ferramentas, rotulagem visual e marcações no piso com linhas coloridas.',
   'Armazenamento de componentes em caixas fechadas sem rótulos ou indicações.',
   'Substituição dos painéis organizadores por sacolas plásticas individuais.'
 ),1,
 'A gestão visual do Seiton utiliza painéis de sombra, etiquetas de identificação e demarcações coloridas no piso.',9008,true),
('00000000-0000-4000-8000-000000009009','5s',
 '4. No 3º Senso – Seiso (Limpeza), qual é a orientação sobre a responsabilidade e a rotina de manutenção dos equipamentos?',
 jsonb_build_array(
   'Realizar limpezas pesadas apenas uma vez por ano ou às vésperas de auditorias externas.',
   'Trata-se de uma rotina diária e individual do operador, aproveitando a limpeza para inspecionar máquinas e identificar anomalias.',
   'Delegar toda a limpeza e verificação do posto de trabalho exclusivamente para a equipe terceirizada.',
   'Limpar apenas a carcaça externa do equipamento para garantir boa aparência estética.'
 ),1,
 'Limpar é inspecionar. O Seiso é uma tarefa diária do próprio operador para identificar folgas, vazamentos ou peças danificadas enquanto limpa.',9009,true),
('00000000-0000-4000-8000-000000009010','5s',
 '5. Além de retirar a poeira e a sujeira visível do ambiente, qual é o grande diferencial do Seiso no chão de fábrica?',
 jsonb_build_array(
   'Cobrir manchas de óleo com serragem sem investigar a origem do problema.',
   'Investigar e eliminar as causas raízes da sujeira, como vazamentos de óleo, parafusos soltos e filtros entupidos, prevenindo falhas e acidentes.',
   'Pintar os equipamentos por cima da graxa para acelerar o término do turno.',
   'Paralisar a produção diariamente para lavar todo o galpão fabril.'
 ),1,
 'O verdadeiro Seiso vai além de varrer: busca a eliminação das fontes de sujeira, como vazamentos, frestas e falhas, para prevenir paradas e acidentes.',9010,true)
on conflict (id) do update set
  subject_id=excluded.subject_id,
  question_text=excluded.question_text,
  options=excluded.options,
  correct_option=excluded.correct_option,
  explanation=excluded.explanation,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active;
