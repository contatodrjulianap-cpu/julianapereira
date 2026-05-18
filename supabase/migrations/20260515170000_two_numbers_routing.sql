-- ============================================================================
-- Sakura: roteamento de 2 (ou mais) números WhatsApp em round-robin sticky.
-- Atendentes (Gabi, Barbara) cadastradas em auth.users; mapping via wa_numbers.
-- Default Lucas/Ju (admin) vê todos os leads; sales (Gabi/Barbara) vê só os seus.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. wa_numbers — mapping instância Z-API → número → atendente dona
-- ---------------------------------------------------------------------------
create table if not exists public.wa_numbers (
  id            uuid primary key default gen_random_uuid(),
  instance_id   text unique not null,            -- ID da instância Z-API
  token         text not null,                   -- token instance-level (NÃO Client-Token)
  phone         text unique not null,            -- '5511...' do chip
  label         text not null,                   -- 'Sakura WPP 1 (Gabi)'
  owner_id      uuid not null references auth.users(id) on delete restrict,
  active        boolean not null default true,
  in_rotation   boolean not null default true,   -- pode receber novos via round-robin?
  created_at    timestamptz not null default now()
);

create index if not exists wa_numbers_active_idx on public.wa_numbers (active, in_rotation);
create index if not exists wa_numbers_owner_idx  on public.wa_numbers (owner_id);

alter table public.wa_numbers enable row level security;

-- Sales vê leitura (pra UI poder mostrar "responsável: Gabi"); só service-role escreve
drop policy if exists "auth users read wa_numbers" on public.wa_numbers;
create policy "auth users read wa_numbers"
  on public.wa_numbers for select
  to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. leads — colunas de atribuição programática
--    OBS: `assigned_to text` JÁ EXISTE (legacy 20260510_pipeline_fields — campo
--    livre editado no LeadModal). Mantemos sem mexer. Nova coluna `assigned_owner_id`
--    uuid é a fonte de verdade pra rotação Z-API + filtro do CRM.
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists assigned_owner_id uuid references auth.users(id) on delete set null;
alter table public.leads add column if not exists assigned_at        timestamptz;
alter table public.leads add column if not exists wa_number_id       uuid references public.wa_numbers(id) on delete set null;

create index if not exists leads_assigned_owner_idx on public.leads (assigned_owner_id);
create index if not exists leads_wa_number_idx      on public.leads (wa_number_id);

-- ---------------------------------------------------------------------------
-- 3. crm_config — estado singleton do round-robin
-- ---------------------------------------------------------------------------
create table if not exists public.crm_config (
  id              smallint primary key default 1,
  next_wa_number  uuid references public.wa_numbers(id) on delete set null,
  updated_at      timestamptz not null default now(),
  constraint singleton check (id = 1)
);

insert into public.crm_config (id) values (1) on conflict do nothing;

alter table public.crm_config enable row level security;

-- ---------------------------------------------------------------------------
-- 4. pick_next_wa_number — avança ponteiro de rotação e retorna próximo wa_id.
--    SQL puro (memory: feedback_supabase_rpc_armadilhas).
--    Retorna NULL se não há números ativos em rotação.
-- ---------------------------------------------------------------------------
create or replace function public.pick_next_wa_number()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidates uuid[];
  total      int;
  current_id uuid;
  current_idx int;
  next_idx   int;
  picked     uuid;
begin
  select array_agg(id order by created_at)
    into candidates
    from public.wa_numbers
    where active = true and in_rotation = true;

  total := coalesce(array_length(candidates, 1), 0);
  if total = 0 then
    return null;
  end if;

  select next_wa_number into current_id from public.crm_config where id = 1;

  if current_id is null then
    next_idx := 1;
  else
    current_idx := array_position(candidates, current_id);
    if current_idx is null then
      next_idx := 1;
    else
      next_idx := current_idx + 1;
      if next_idx > total then next_idx := 1; end if;
    end if;
  end if;

  picked := candidates[next_idx];

  update public.crm_config
     set next_wa_number = picked, updated_at = now()
   where id = 1;

  return picked;
end;
$$;

grant execute on function public.pick_next_wa_number() to service_role;

-- ---------------------------------------------------------------------------
-- 5. claim_lead_for_wa(p_phone) — atribui ou reusa atribuição existente.
--    Sticky: se lead já tem wa_number_id, mantém. Senão pega próximo.
--    Retorna sempre 1 row com dados do número alvo.
-- ---------------------------------------------------------------------------
create or replace function public.claim_lead_for_wa(p_phone text)
returns table (
  lead_id      uuid,
  wa_number_id uuid,
  phone        text,
  instance_id  text,
  owner_id     uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead      public.leads%rowtype;
  v_lead_id   uuid;
  v_wa_id     uuid;
begin
  -- 1. Procura lead por phone
  select * into v_lead from public.leads where phone = p_phone limit 1;

  if found and v_lead.wa_number_id is not null then
    v_lead_id := v_lead.id;
    v_wa_id   := v_lead.wa_number_id;
  else
    -- Pega próximo via round-robin
    v_wa_id := public.pick_next_wa_number();
    if v_wa_id is null then
      return; -- vazio: caller usa fallback
    end if;

    -- Atualiza atribuição se lead existe; senão cria stub
    if found then
      update public.leads
         set wa_number_id      = v_wa_id,
             assigned_owner_id = (select w.owner_id from public.wa_numbers w where w.id = v_wa_id),
             assigned_at       = now()
       where id = v_lead.id;
      v_lead_id := v_lead.id;
    else
      -- Cria stub mínimo (será preenchido pelo webhook quando msg chegar)
      insert into public.leads (phone, source, wa_number_id, assigned_owner_id, assigned_at)
      values (
        p_phone,
        'wa_link_stub',
        v_wa_id,
        (select w.owner_id from public.wa_numbers w where w.id = v_wa_id),
        now()
      )
      returning id into v_lead_id;
    end if;
  end if;

  return query
    select v_lead_id, w.id, w.phone, w.instance_id, w.owner_id
      from public.wa_numbers w
     where w.id = v_wa_id;
end;
$$;

grant execute on function public.claim_lead_for_wa(text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. crm_users view — facilita lookup de role + display_name no UI.
-- raw_user_meta_data esperado: { "role": "admin" | "sales", "display_name": "Gabi" }
-- ---------------------------------------------------------------------------
create or replace view public.crm_users as
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'role', 'sales') as role,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)) as display_name,
  u.created_at
from auth.users u;

grant select on public.crm_users to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Realtime: wa_numbers entra na publication (admin UI pode escutar mudanças)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.wa_numbers;
  end if;
exception when duplicate_object then null;
end $$;

comment on table  public.wa_numbers     is 'Números WPP da Sakura — 1 row por instância Z-API ligada a uma atendente.';
comment on column public.wa_numbers.in_rotation is 'Se false, não recebe novos leads via round-robin mas continua respondendo os atuais.';
comment on function public.claim_lead_for_wa(text) is 'Sticky round-robin: lead atribuído mantém o mesmo número; novo lead vai pro próximo.';

notify pgrst, 'reload schema';
