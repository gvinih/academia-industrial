-- Academia Industrial: adicionar setor ao perfil dos participantes.
-- Execute este arquivo no SQL Editor do Supabase de produção.

alter table public.profiles
  add column if not exists department text not null default '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, department)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data->>'department'), ''), '')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        department = excluded.department;
  return new;
end;
$$;

-- Atualiza setor de contas existentes caso o dado já esteja nos metadados do cadastro.
update public.profiles p
set department = coalesce(nullif(trim(u.raw_user_meta_data->>'department'), ''), '')
from auth.users u
where u.id = p.id
  and coalesce(p.department, '') = '';

grant select on public.profiles to authenticated;
