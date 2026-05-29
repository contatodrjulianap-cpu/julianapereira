-- Web Push subscriptions (Movimento A — alerta PRONTA/ESPERANCOSA pra Barbara em ≤15min)
-- Cada atendente pode ter múltiplas subscriptions (1 por device/browser).
-- Endpoint é único globalmente (browser gera) — Unique nele evita duplicar
-- quando o mesmo device re-subscribe (ex: app reinstalado).

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references crm_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  last_error text,
  last_error_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions(user_id);

-- RLS: cada atendente vê só as próprias subscriptions; admin vê tudo.
alter table push_subscriptions enable row level security;

create policy "own subscriptions" on push_subscriptions
  for all
  using (
    user_id = auth.uid()
    or exists (select 1 from crm_users where id = auth.uid() and role = 'admin')
  );

-- Notifica PostgREST pra refresh schema cache
notify pgrst, 'reload schema';
