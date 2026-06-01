-- ============================================================================
-- SAKURA — setup operacional dos 2 números WhatsApp (Gabi + Barbara)
-- ============================================================================
--
-- PRÉ-REQUISITOS (Ju faz, NÃO Lucas):
--
-- 1. Comprar 2 chips (operadora qualquer) + instalar WPP Business em 2 celulares
-- 2. Z-API: criar 2 instâncias na sua conta (a 1ª já existe — vai virar a da Gabi)
-- 3. Em cada instância: escanear QR Code com o WPP Business do chip correspondente
-- 4. Anotar de cada instância: INSTANCE_ID + INSTANCE_TOKEN
-- 5. Configurar webhook em cada instância apontando pra:
--    https://clinicasakura.org/api/zapi/webhook
-- 6. Supabase Dashboard → Authentication → Users → "Add user", criar 2 users:
--    - email: gabi@sakura.local (ou email pessoal da Gabi)
--    - email: barbara@sakura.local (ou email pessoal da Barbara)
--    Password: gerar via password manager. Confirmar email automático.
-- 7. Pegar UUIDs dos users criados (Authentication → Users → copy "User UID")
-- 8. Atualizar metadata via SQL Editor abaixo (ou via dashboard direto).
--
-- Depois disso, trocar PLACEHOLDERS abaixo e rodar TUDO no SQL Editor do Supabase.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Passo A. Tagear users com role + display_name (lido pela view crm_users)
-- ----------------------------------------------------------------------------

-- Ju (admin) — já existe. Atualiza pra role=admin
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', 'admin', 'display_name', 'Juliana')
 where email = 'contato.drjulianap@gmail.com';

-- Gabi (sales)
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', 'sales', 'display_name', 'Gabi')
 where email = 'gabi@sakura.local'; -- TROCAR pelo email real da Gabi

-- Barbara (sales)
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', 'sales', 'display_name', 'Barbara')
 where email = 'barbara@sakura.local'; -- TROCAR pelo email real da Barbara

-- Confere
select id, email, raw_user_meta_data->>'role' as role, raw_user_meta_data->>'display_name' as display_name
  from auth.users
 where email in ('contato.drjulianap@gmail.com', 'gabi@sakura.local', 'barbara@sakura.local');


-- ----------------------------------------------------------------------------
-- Passo B. Inserir os 2 wa_numbers (TROCAR PLACEHOLDERS)
-- ----------------------------------------------------------------------------

insert into public.wa_numbers (instance_id, token, phone, label, owner_id, active, in_rotation)
values
  ( '<INSTANCE_ID_1>',                  -- TROCAR
    '<INSTANCE_TOKEN_1>',               -- TROCAR
    '5511XXXXXXXXX',                    -- TROCAR (chip da Gabi, com DDI 55)
    'Sakura WPP 1 (Gabi)',
    (select id from auth.users where email = 'gabi@sakura.local' limit 1),
    true,
    true ),
  ( '<INSTANCE_ID_2>',                  -- TROCAR
    '<INSTANCE_TOKEN_2>',               -- TROCAR
    '5511YYYYYYYYY',                    -- TROCAR (chip da Barbara, com DDI 55)
    'Sakura WPP 2 (Barbara)',
    (select id from auth.users where email = 'barbara@sakura.local' limit 1),
    true,
    true )
on conflict (instance_id) do update
   set token       = excluded.token,
       phone       = excluded.phone,
       label       = excluded.label,
       owner_id    = excluded.owner_id,
       active      = excluded.active,
       in_rotation = excluded.in_rotation;

-- Reset ponteiro de rotação (próximo lead vai pro primeiro da lista, ordenado por created_at)
update public.crm_config set next_wa_number = null where id = 1;

-- Confere
select w.label, w.phone, w.instance_id, u.email as owner_email, w.active, w.in_rotation
  from public.wa_numbers w
  join auth.users u on u.id = w.owner_id
 order by w.created_at;


-- ----------------------------------------------------------------------------
-- Passo C. Smoke test do round-robin (opcional)
-- ----------------------------------------------------------------------------

-- Roda 4x e vê alternar entre os 2 wa_numbers
-- select w.label
--   from public.wa_numbers w
--  where w.id = public.pick_next_wa_number();


-- ----------------------------------------------------------------------------
-- Manutenção corriqueira
-- ----------------------------------------------------------------------------

-- Atendente fora do round-robin temporariamente (continua respondendo os atuais)
-- update public.wa_numbers set in_rotation = false where label = 'Sakura WPP 1 (Gabi)';
-- update public.wa_numbers set in_rotation = true  where label = 'Sakura WPP 1 (Gabi)';

-- Trocar chip de uma atendente (mesma instância, chip novo)
-- update public.wa_numbers set phone = '5511ZZZZZZZZZ' where label = 'Sakura WPP 1 (Gabi)';

-- Adicionar um 3º número (nova atendente futura)
-- insert into public.wa_numbers (instance_id, token, phone, label, owner_id) ...


-- ----------------------------------------------------------------------------
-- TROCAR ATENDENTE NA MESMA CADEIRA (takeover in-place — mesmo chip/instância)
-- ----------------------------------------------------------------------------
-- Ex: Barbara saiu, Milena entrou no lugar dela (2026-06-01), pegando o MESMO
-- celular/chip e assumindo TODOS os leads. Caminho mais limpo: reusa o user e o
-- wa_number existentes, só troca a identidade por cima. UUIDs não mudam, então
-- o override hardcoded em api/quiz/submit/route.ts (closer de lead quente)
-- continua válido sem redeploy obrigatório.
--
-- PASSO 1 (Ju, no Dashboard → Authentication → Users):
--   Editar o user 6c0b2208-1806-4e89-bd08-2046895ab4f5 (era Barbara):
--     - trocar Email: barbara@clinicasakura.org → milena@clinicasakura.org
--     - "Reset password" / setar senha nova (entregar pra Milena)
--   Isso revoga o acesso da Barbara e dá o da Milena — é a troca de acesso.
--
-- PASSO 2 (SQL abaixo): renomear display_name, relabel do número e limpar push.

-- 2a. display_name Barbara → Milena (role continua 'sales')
-- update auth.users
--    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--                           || jsonb_build_object('display_name', 'Milena')
--  where id = '6c0b2208-1806-4e89-bd08-2046895ab4f5';

-- 2b. Relabel do número (mesmo chip/instância, só o nome na UI)
-- update public.wa_numbers
--    set label = 'Sakura WPP 2 (Milena)'
--  where id = '53cd6090-9160-485a-9fda-c46276a4ad6a';

-- 2c. Limpar push subscriptions antigas (devices da Barbara não recebem mais
--     lead quente). Milena re-registra fresh ao logar no chip e ativar push.
-- delete from public.push_subscriptions
--  where user_id = '6c0b2208-1806-4e89-bd08-2046895ab4f5';

-- 2d. Confere (leads já seguem atribuídos — mesmo UUID, nada a reatribuir)
-- select id, email, raw_user_meta_data->>'display_name' as display_name,
--        raw_user_meta_data->>'role' as role
--   from auth.users where id = '6c0b2208-1806-4e89-bd08-2046895ab4f5';
-- select label, phone, active, in_rotation
--   from public.wa_numbers where id = '53cd6090-9160-485a-9fda-c46276a4ad6a';
-- select count(*) as leads_da_milena
--   from public.leads where assigned_owner_id = '6c0b2208-1806-4e89-bd08-2046895ab4f5';
