-- Academia Industrial: schema inicial Supabase
-- Execute no SQL Editor do projeto Supabase.
-- Use apenas a chave pública no frontend. Nunca exponha service_role.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Participante',
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.subjects (
  id text primary key,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.subjects (id,name,description,sort_order) values
('5s','5S','Organização, limpeza, padronização e disciplina.',1),
('lubrificacao','Lubrificação Básica','Atrito, desgaste, lubrificantes e boas práticas.',2),
('pneumatica','Pneumática Básica','Ar comprimido, válvulas, cilindros e preparação do ar.',3),
('eletrica','Elétrica Básica','Grandezas elétricas, circuitos, proteção e segurança.',4)
on conflict (id) do update set name=excluded.name, description=excluded.description, sort_order=excluded.sort_order;

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id) on delete cascade,
  question_text text not null,
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options)>=2),
  correct_option integer not null check (correct_option >= 0),
  explanation text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (correct_option < jsonb_array_length(options))
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  score integer not null check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  points integer not null check (points >= 0),
  answers jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_subject_idx on public.quiz_attempts(user_id,subject_id);
create index if not exists quiz_attempts_submitted_idx on public.quiz_attempts(submitted_at desc);

create or replace view public.best_scores
with (security_invoker = true)
as
select user_id, subject_id, max(points)::integer as best_score,
       max(score)::integer as best_correct,
       max(total_questions)::integer as total_questions
from public.quiz_attempts
group by user_id, subject_id;

-- Ranking global intencionalmente público para usuários autenticados:
-- a view expõe apenas nome de exibição e pontos agregados, nunca e-mail ou respostas.
-- A view usa os privilégios do proprietário para agregar pontuações apesar da RLS
-- que restringe a tabela quiz_attempts à própria pessoa.
create or replace view public.leaderboard
as
select p.id as user_id, p.display_name,
       coalesce((
         select sum(best.points)::integer
         from (
           select max(a.points)::integer as points
           from public.quiz_attempts a
           where a.user_id=p.id
           group by a.subject_id
         ) best
       ),0)::integer as total_points,
       (select count(distinct a.subject_id)::integer
        from public.quiz_attempts a where a.user_id=p.id) as completed_subjects
from public.profiles p;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- RPC: pontuação corrigida no servidor; o cliente não envia acertos ou pontos.
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
begin
  if v_user is null then raise exception 'Você precisa entrar para enviar respostas.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'Formato de respostas inválido.'; end if;

  select count(*) into v_total
  from public.quiz_questions q
  where q.subject_id=p_subject_id and q.is_active=true;

  if v_total=0 then raise exception 'Este quiz ainda não possui perguntas ativas.'; end if;
  if jsonb_array_length(p_answers) <> v_total then raise exception 'Responda todas as perguntas antes de enviar.'; end if;

  select count(distinct a.question_id) into v_answers_count
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id=a.question_id
  where q.subject_id=p_subject_id and q.is_active=true;

  if v_answers_count <> v_total then raise exception 'As respostas não correspondem às perguntas atuais deste quiz.'; end if;

  select count(*) filter (where q.correct_option=a.selected_option)
    into v_score
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_option integer)
  join public.quiz_questions q on q.id=a.question_id
  where q.subject_id=p_subject_id and q.is_active=true;

  v_points := v_score * 10;
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

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.materials enable row level security;

-- Função auxiliar para políticas administrativas.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "profiles readable by authenticated users" on public.profiles
for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role='student');
drop policy if exists "subjects readable" on public.subjects;
create policy "subjects readable" on public.subjects for select to authenticated using (is_active or public.is_admin());
drop policy if exists "admin manages subjects" on public.subjects;
create policy "admin manages subjects" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "questions readable" on public.quiz_questions;
create policy "questions readable" on public.quiz_questions for select to authenticated using (is_active or public.is_admin());
drop policy if exists "admin manages questions" on public.quiz_questions;
create policy "admin manages questions" on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "users read own attempts" on public.quiz_attempts;
create policy "users read own attempts" on public.quiz_attempts for select to authenticated using (user_id=auth.uid() or public.is_admin());
-- Sem INSERT/UPDATE direto: envio de tentativas apenas pela função submit_quiz.
drop policy if exists "materials readable by authenticated users" on public.materials;
create policy "materials readable by authenticated users" on public.materials for select to authenticated using ((is_published and auth.uid() is not null) or public.is_admin());
drop policy if exists "admin manages materials" on public.materials;
create policy "admin manages materials" on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to authenticated;
grant select on public.profiles,public.subjects,public.quiz_questions,public.quiz_attempts,public.materials,public.best_scores,public.leaderboard to authenticated;
grant insert,update,delete on public.subjects,public.quiz_questions,public.materials to authenticated;
grant execute on function public.submit_quiz(text,jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Bucket privado para PDFs oficiais.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('handouts','handouts',false,20971520,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=20971520,allowed_mime_types=array['application/pdf'];

drop policy if exists "authenticated read handout objects" on storage.objects;
create policy "authenticated read handout objects" on storage.objects
for select to authenticated using (bucket_id='handouts' and (public.is_admin() or exists (
  select 1 from public.materials m where m.storage_path=name and m.is_published=true
)));
drop policy if exists "admins upload handout objects" on storage.objects;
create policy "admins upload handout objects" on storage.objects
for insert to authenticated with check (bucket_id='handouts' and public.is_admin());
drop policy if exists "admins update handout objects" on storage.objects;
create policy "admins update handout objects" on storage.objects
for update to authenticated using (bucket_id='handouts' and public.is_admin()) with check (bucket_id='handouts' and public.is_admin());
drop policy if exists "admins delete handout objects" on storage.objects;
create policy "admins delete handout objects" on storage.objects
for delete to authenticated using (bucket_id='handouts' and public.is_admin());

-- IMPORTANTE: após criar a sua conta, promova-a a admin no SQL Editor:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='seu-email@empresa.com');
