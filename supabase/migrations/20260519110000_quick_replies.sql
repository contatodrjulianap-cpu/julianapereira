-- Sprint 3: respostas rápidas (templates de mensagem)
-- Compartilhadas pela clínica inteira (sem workspace_id por ora).
-- Atendente clica no ⚡, escolhe template, sistema insere texto interpolado no campo.

create table if not exists public.quick_replies (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete set null,
  name         text not null,
  emoji        text default '⚡',
  body         text not null,
  category     text,
  favorite     boolean not null default false,
  uses_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists quick_replies_favorite_idx on public.quick_replies (favorite desc, uses_count desc);
create index if not exists quick_replies_owner_idx on public.quick_replies (owner_id);

-- Trigger updated_at
create or replace function public.set_quick_replies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quick_replies_updated_at on public.quick_replies;
create trigger trg_quick_replies_updated_at
  before update on public.quick_replies
  for each row execute function public.set_quick_replies_updated_at();

-- Acesso: service_role (todas as rotas /api passam por createServiceClient após auth).
grant all on public.quick_replies to service_role;
