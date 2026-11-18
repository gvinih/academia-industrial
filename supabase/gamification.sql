-- Academia Industrial: XP, missões, sequência de estudo e medalhas
-- Gamificação paralela ao ranking de conhecimento. O XP não altera quiz_attempts.points.

create table if not exists public.user_gamification (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_study_date date,
  updated_at timestamptz not null default now()
);
create table if not exists public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source_key text not null,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now(),
  unique(user_id,event_type,source_key)
);
create table if not exists public.gamification_mission_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('daily','weekly')),
  period_start date not null,
  mission_key text not null,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  primary key(user_id,period_type,period_start,mission_key)
);
create table if not exists public.gamification_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null default now(),
  primary key(user_id,achievement_key)
);

alter table public.user_gamification enable row level security;
alter table public.gamification_events enable row level security;
alter table public.gamification_mission_progress enable row level security;
alter table public.gamification_achievements enable row level security;

drop policy if exists "Users read own gamification profile" on public.user_gamification;
create policy "Users read own gamification profile" on public.user_gamification for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Users read own gamification events" on public.gamification_events;
create policy "Users read own gamification events" on public.gamification_events for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Users read own mission progress" on public.gamification_mission_progress;
create policy "Users read own mission progress" on public.gamification_mission_progress for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Users read own achievements" on public.gamification_achievements;
create policy "Users read own achievements" on public.gamification_achievements for select to authenticated using (user_id=(select auth.uid()));

revoke all on public.user_gamification, public.gamification_events, public.gamification_mission_progress, public.gamification_achievements from anon, authenticated;
grant select on public.user_gamification, public.gamification_events, public.gamification_mission_progress, public.gamification_achievements to authenticated;

create or replace function public.gamification_add_event(p_user uuid,p_event_type text,p_source_key text,p_xp integer default 0)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_inserted integer;
begin
  insert into public.gamification_events(user_id,event_type,source_key,xp_awarded)
  values(p_user,p_event_type,p_source_key,greatest(p_xp,0))
  on conflict(user_id,event_type,source_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=1 and p_xp>0 then
    insert into public.user_gamification(user_id,xp_total) values(p_user,p_xp)
    on conflict(user_id) do update set xp_total=public.user_gamification.xp_total+p_xp,updated_at=now();
  end if;
  return v_inserted=1;
end $$;
revoke execute on function public.gamification_add_event(uuid,text,text,integer) from public, anon, authenticated;

create or replace function public.gamification_handle_quiz_attempt()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := new.user_id;
  v_today date := (new.submitted_at at time zone 'America/Sao_Paulo')::date;
  v_week date := date_trunc('week',(new.submitted_at at time zone 'America/Sao_Paulo'))::date;
  v_first boolean;
  v_correct integer := 0;
  v_subjects_today integer;
  v_active_days integer;
  v_streak integer;
  v_last date;
begin
  select count(*)=1 into v_first from public.quiz_attempts a where a.user_id=v_user and a.subject_id=new.subject_id and a.quiz_key=new.quiz_key;
  select count(*) into v_correct from jsonb_array_elements(coalesce(new.answers,'[]'::jsonb)) a where coalesce((a->>'correct')::boolean,false);

  insert into public.user_gamification(user_id) values(v_user) on conflict do nothing;
  select last_study_date,current_streak into v_last,v_streak from public.user_gamification where user_id=v_user;
  if v_last is null or v_last<v_today-1 then v_streak:=1;
  elsif v_last=v_today then v_streak:=greatest(v_streak,1);
  else v_streak:=v_streak+1;
  end if;
  update public.user_gamification set current_streak=v_streak,longest_streak=greatest(longest_streak,v_streak),last_study_date=v_today,updated_at=now() where user_id=v_user;

  perform public.gamification_add_event(v_user,'quiz_activity',new.id::text,0);
  if v_first then
    perform public.gamification_add_event(v_user,'quiz_first_completion',new.subject_id||':'||new.quiz_key,20);
    insert into public.gamification_mission_progress(user_id,period_type,period_start,mission_key,progress)
      values(v_user,'daily',v_today,'quizzes',1)
      on conflict(user_id,period_type,period_start,mission_key) do update set progress=public.gamification_mission_progress.progress+1;
    insert into public.gamification_mission_progress(user_id,period_type,period_start,mission_key,progress)
      values(v_user,'weekly',v_week,'quizzes',1)
      on conflict(user_id,period_type,period_start,mission_key) do update set progress=public.gamification_mission_progress.progress+1;
    insert into public.gamification_events(user_id,event_type,source_key,xp_awarded)
      values(v_user,'daily_subject_studied',v_today::text||':'||new.subject_id,0) on conflict do nothing;
    select count(*) into v_subjects_today from public.gamification_events
      where user_id=v_user and event_type='daily_subject_studied' and split_part(source_key,':',1)=v_today::text;
    insert into public.gamification_mission_progress(user_id,period_type,period_start,mission_key,progress)
      values(v_user,'daily',v_today,'subjects',v_subjects_today)
      on conflict(user_id,period_type,period_start,mission_key) do update set progress=excluded.progress;
  end if;

  insert into public.gamification_mission_progress(user_id,period_type,period_start,mission_key,progress)
    values(v_user,'daily',v_today,'correct',v_correct)
    on conflict(user_id,period_type,period_start,mission_key) do update set progress=public.gamification_mission_progress.progress+excluded.progress;

  update public.gamification_mission_progress set completed_at=now()
    where user_id=v_user and period_type='daily' and period_start=v_today and mission_key='quizzes' and progress>=1 and completed_at is null;
  if found then perform public.gamification_add_event(v_user,'mission_daily_quiz',v_today::text,30); end if;
  update public.gamification_mission_progress set completed_at=now()
    where user_id=v_user and period_type='daily' and period_start=v_today and mission_key='correct' and progress>=5 and completed_at is null;
  if found then perform public.gamification_add_event(v_user,'mission_daily_correct',v_today::text,20); end if;
  update public.gamification_mission_progress set completed_at=now()
    where user_id=v_user and period_type='daily' and period_start=v_today and mission_key='subjects' and progress>=2 and completed_at is null;
  if found then perform public.gamification_add_event(v_user,'mission_daily_subjects',v_today::text,25); end if;
  update public.gamification_mission_progress set completed_at=now()
    where user_id=v_user and period_type='weekly' and period_start=v_week and mission_key='quizzes' and progress>=3 and completed_at is null;
  if found then perform public.gamification_add_event(v_user,'mission_weekly_quizzes',v_week::text,75); end if;

  insert into public.gamification_events(user_id,event_type,source_key,xp_awarded)
    values(v_user,'weekly_active_day',v_today::text,0) on conflict do nothing;
  select count(*) into v_active_days from public.gamification_events
    where user_id=v_user and event_type='weekly_active_day'
      and created_at >= (v_week::timestamp at time zone 'America/Sao_Paulo')
      and created_at < ((v_week+7)::timestamp at time zone 'America/Sao_Paulo');
  insert into public.gamification_mission_progress(user_id,period_type,period_start,mission_key,progress)
    values(v_user,'weekly',v_week,'active_days',v_active_days)
    on conflict(user_id,period_type,period_start,mission_key) do update set progress=excluded.progress;
  update public.gamification_mission_progress set completed_at=now()
    where user_id=v_user and period_type='weekly' and period_start=v_week and mission_key='active_days' and progress>=5 and completed_at is null;
  if found then perform public.gamification_add_event(v_user,'mission_weekly_days',v_week::text,100); end if;

  if (select count(*) from public.gamification_events where user_id=v_user and event_type='quiz_first_completion')>=1 then
    insert into public.gamification_achievements(user_id,achievement_key) values(v_user,'first_quiz') on conflict do nothing;
    if found then perform public.gamification_add_event(v_user,'achievement','first_quiz',25); end if;
  end if;
  if (select xp_total from public.user_gamification where user_id=v_user)>=500 then
    insert into public.gamification_achievements(user_id,achievement_key) values(v_user,'xp_500') on conflict do nothing;
    if found then perform public.gamification_add_event(v_user,'achievement','xp_500',50); end if;
  end if;
  if v_streak>=3 then
    insert into public.gamification_achievements(user_id,achievement_key) values(v_user,'streak_3') on conflict do nothing;
    if found then perform public.gamification_add_event(v_user,'achievement','streak_3',30); end if;
  end if;
  if v_streak>=7 then
    insert into public.gamification_achievements(user_id,achievement_key) values(v_user,'streak_7') on conflict do nothing;
    if found then perform public.gamification_add_event(v_user,'achievement','streak_7',100); end if;
  end if;
  if (select count(*) from public.gamification_events where user_id=v_user and event_type='quiz_first_completion')>=10 then
    insert into public.gamification_achievements(user_id,achievement_key) values(v_user,'quizzes_10') on conflict do nothing;
    if found then perform public.gamification_add_event(v_user,'achievement','quizzes_10',75); end if;
  end if;
  return new;
end $$;
revoke execute on function public.gamification_handle_quiz_attempt() from public, anon, authenticated;
drop trigger if exists quiz_attempt_gamification on public.quiz_attempts;
create trigger quiz_attempt_gamification after insert on public.quiz_attempts for each row execute function public.gamification_handle_quiz_attempt();

create or replace function public.get_gamification_dashboard()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week date := date_trunc('week',now() at time zone 'America/Sao_Paulo')::date;
  v_profile jsonb;
  v_daily jsonb;
  v_weekly jsonb;
  v_achievements jsonb;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  insert into public.user_gamification(user_id) values(v_user) on conflict do nothing;
  select jsonb_build_object('xp',xp_total,'streak',current_streak,'longest_streak',longest_streak,'level',greatest(1,floor(xp_total/500.0)::int+1),'level_progress',mod(xp_total,500),'last_study_date',last_study_date)
    into v_profile from public.user_gamification where user_id=v_user;
  select jsonb_build_array(
    jsonb_build_object('key','quizzes','title','Conclua 1 quiz','description','Finalize um quiz hoje','progress',coalesce((select progress from public.gamification_mission_progress where user_id=v_user and period_type='daily' and period_start=v_today and mission_key='quizzes'),0),'goal',1,'xp',30,'completed',exists(select 1 from public.gamification_events where user_id=v_user and event_type='mission_daily_quiz' and source_key=v_today::text)),
    jsonb_build_object('key','correct','title','Acerte 5 questões','description','Some cinco respostas corretas','progress',coalesce((select progress from public.gamification_mission_progress where user_id=v_user and period_type='daily' and period_start=v_today and mission_key='correct'),0),'goal',5,'xp',20,'completed',exists(select 1 from public.gamification_events where user_id=v_user and event_type='mission_daily_correct' and source_key=v_today::text)),
    jsonb_build_object('key','subjects','title','Explore 2 matérias','description','Complete quizzes de duas matérias','progress',coalesce((select progress from public.gamification_mission_progress where user_id=v_user and period_type='daily' and period_start=v_today and mission_key='subjects'),0),'goal',2,'xp',25,'completed',exists(select 1 from public.gamification_events where user_id=v_user and event_type='mission_daily_subjects' and source_key=v_today::text))
  ) into v_daily;
  select jsonb_build_array(
    jsonb_build_object('key','quizzes','title','3 quizzes na semana','description','Complete três quizzes diferentes','progress',coalesce((select progress from public.gamification_mission_progress where user_id=v_user and period_type='weekly' and period_start=v_week and mission_key='quizzes'),0),'goal',3,'xp',75,'completed',exists(select 1 from public.gamification_events where user_id=v_user and event_type='mission_weekly_quizzes' and source_key=v_week::text)),
    jsonb_build_object('key','active_days','title','Estude em 5 dias','description','Mantenha sua rotina de aprendizado','progress',coalesce((select progress from public.gamification_mission_progress where user_id=v_user and period_type='weekly' and period_start=v_week and mission_key='active_days'),0),'goal',5,'xp',100,'completed',exists(select 1 from public.gamification_events where user_id=v_user and event_type='mission_weekly_days' and source_key=v_week::text))
  ) into v_weekly;
  select coalesce(jsonb_agg(jsonb_build_object('key',achievement_key,'earned_at',earned_at) order by earned_at desc),'[]'::jsonb) into v_achievements from public.gamification_achievements where user_id=v_user;
  return jsonb_build_object('profile',v_profile,'daily',v_daily,'weekly',v_weekly,'achievements',v_achievements);
end $$;
revoke execute on function public.get_gamification_dashboard() from public, anon;
grant execute on function public.get_gamification_dashboard() to authenticated;
