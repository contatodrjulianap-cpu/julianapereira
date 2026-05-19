-- Contatos gerais cadastrados pela clínica (ex: recepção, Dra. Juliana,
-- ortodontista parceiro). Atendente compartilha via 📇 Contato no WhatsApp.

create table if not exists public.saved_contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  description text,
  emoji       text default '👤',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists saved_contacts_pinned_idx
  on public.saved_contacts (pinned desc, name);

create or replace function public.set_saved_contacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_saved_contacts_updated_at on public.saved_contacts;
create trigger trg_saved_contacts_updated_at
  before update on public.saved_contacts
  for each row execute function public.set_saved_contacts_updated_at();

grant all on public.saved_contacts to service_role;

-- Seed inicial: clínica
insert into public.saved_contacts (name, phone, description, emoji, pinned)
values
  ('Clínica Sakura', '5511999999999', 'Recepção principal', '🏥', true)
on conflict do nothing;
