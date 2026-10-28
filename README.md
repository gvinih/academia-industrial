# Academia Industrial — versão online (base de produção)

Este repositório é a próxima etapa do protótipo: frontend responsivo + Supabase Auth + PostgreSQL + Storage privado para PDFs oficiais.

## Arquitetura

- **Frontend:** Vite + JavaScript modular, responsivo para celular e computador.
- **Identidade:** Supabase Auth com e-mail e senha.
- **Banco:** PostgreSQL no Supabase.
- **Segurança:** Row Level Security (RLS); o navegador não pode enviar pontos diretamente.
- **Correção:** função SQL `submit_quiz` corrige respostas no servidor e grava tentativas.
- **Ranking:** `best_scores` considera a melhor tentativa por matéria; `leaderboard` soma o melhor resultado de cada uma das quatro matérias.
- **Apostilas:** PDFs em bucket privado `handouts`, com links temporários assinados.
- **Hospedagem sugerida:** Vercel ou Netlify; banco e autenticação ficam no Supabase.

## Configuração local

1. Instale Node.js LTS.
2. Crie um projeto em https://supabase.com/.
3. No painel Supabase, abra **SQL Editor** e execute `supabase/schema.sql`.
4. Execute `supabase/seed_questions.sql` para cadastrar 20 perguntas iniciais.
5. Em **Project Settings → API**, copie Project URL e chave pública (anon/publishable).
6. Preencha `src/config.js`. Nunca use a chave `service_role` no navegador.
7. No terminal, na pasta do projeto:
   ```bash
   npm install
   npm run dev
   ```
8. Crie sua conta pelo app e confirme o e-mail, se solicitado.
9. No SQL Editor, promova o seu usuário a administrador (troque pelo e-mail real):
   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'seu-email@empresa.com');
   ```
10. Para produção, configure a URL do site e os redirects de autenticação em **Authentication → URL Configuration**.

## Publicação online

1. Envie esta pasta para um repositório Git privado ou público, conforme a política da empresa.
2. Importe o repositório no Vercel/Netlify.
3. Build command: `npm run build`; output directory: `dist`.
4. As credenciais deste scaffold estão em `src/config.js`. Para deploy, prefira variáveis de ambiente e ajuste o arquivo para lê-las durante o build, ou mantenha apenas URL e chave pública no frontend. A chave pública não substitui as políticas RLS.
5. Configure o domínio e URLs de redirecionamento no Supabase.

## Carregar apostilas

Depois de promover a conta a `admin`, entre no app, vá ao painel de materiais, selecione a matéria, informe o título e envie o PDF. Limite atual: 20 MB por PDF. Os arquivos ficam privados e só usuários autenticados podem obter links temporários.

## Regras do ranking

- Cada resposta correta vale 10 pontos; 5 perguntas valem até 50 pontos por matéria.
- Tentativas são gravadas no banco.
- Para cada matéria, apenas a maior pontuação do usuário entra na soma geral.
- O ranking ordena por pontos totais e depois por quantidade de matérias concluídas. Em caso de empate persistente, a ordem por nome é alfabética.
- A pontuação é calculada no banco, não confiada ao navegador.

## Antes de usar oficialmente

- Troque as perguntas de exemplo e valide todos os conteúdos com os responsáveis técnicos.
- Configure recuperação de senha, confirmação de e-mail, domínio e política de acesso.
- Defina se o cadastro ficará aberto ou será restrito a convites. Para restringir, desabilite inscrições públicas no Supabase ou implemente convites.
- Decida se administradores poderão editar perguntas pelo painel (o painel de questões ainda não está implementado).
- Faça teste de segurança, acessibilidade, backup e recuperação.
- As políticas RLS devem ser revisadas por quem administra o Supabase antes de publicar dados reais.

## Limitações conhecidas desta etapa

- Cadastro e login já estão integrados ao Supabase após configuração.
- Ranking, quizzes, correção de respostas e upload/leitura de PDFs estão implementados no frontend e SQL.
- O painel administrativo nesta versão permite upload de apostilas, mas ainda não oferece CRUD visual de perguntas, usuários ou vídeos.
- Os links de vídeo são buscas por tema, não vídeos finais selecionados.
- Esta entrega não cria o projeto Supabase nem publica o site automaticamente; você precisa fornecer/definir as credenciais e autorizar a publicação.
