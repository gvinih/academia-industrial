-- Academia Industrial: módulo de auditorias administrativas.
-- Execute no SQL Editor do Supabase antes de usar a nova aba.
begin;

create table if not exists public.audit_records (
  id uuid primary key default gen_random_uuid(),
  sector text not null check (sector in (
    'Bihler','Forno','Jato','Pintura','Seleção Visual','Acabamento','Ajan',
    'Estampagem RSFI','Montagem Final RSFI','Estampagem Combinada',
    'Montagem Final Combinada','Parafuso','Laminação','Automática',
    'Montagem Final RSFC','Estampagem Tucho','Montagem Final Tucho','Mangote'
  )),
  audit_type text not null check (audit_type in ('escalonada','manutencao_autonoma')),
  status text not null check (status in ('OK','NOK')),
  observations text not null default '',
  evidence_paths text[] not null default '{}',
  audited_by uuid not null references public.profiles(id),
  audited_at timestamptz not null default now(),
  audit_date date not null default current_date
);

create index if not exists audit_records_date_idx on public.audit_records(audit_date desc);
create index if not exists audit_records_sector_type_idx on public.audit_records(sector,audit_type,status);

alter table public.audit_records enable row level security;
drop policy if exists "admins manage audit records" on public.audit_records;
create policy "admins manage audit records" on public.audit_records
for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.audit_records to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('audit-evidence','audit-evidence',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "admins manage audit evidence" on storage.objects;
create policy "admins manage audit evidence" on storage.objects
for all to authenticated
using (bucket_id='audit-evidence' and public.is_admin())
with check (bucket_id='audit-evidence' and public.is_admin());

commit;
