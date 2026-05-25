-- Audit trigger pra wa_numbers — loga mudanças de active/in_rotation no
-- event_log. Motivação: desbalanço Gabi vs Barbara em 23-24/05 sem rastro
-- de quando/quem mexeu na rotação. Daqui pra frente fica gravado.

create or replace function public.wa_numbers_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields jsonb := '{}'::jsonb;
  who uuid := auth.uid();
begin
  if old.active is distinct from new.active then
    changed_fields := changed_fields || jsonb_build_object(
      'active', jsonb_build_object('from', old.active, 'to', new.active)
    );
  end if;
  if old.in_rotation is distinct from new.in_rotation then
    changed_fields := changed_fields || jsonb_build_object(
      'in_rotation', jsonb_build_object('from', old.in_rotation, 'to', new.in_rotation)
    );
  end if;

  if changed_fields = '{}'::jsonb then
    return new;
  end if;

  insert into public.event_log (type, direction, target, status, payload)
  values (
    'wa_rotation_change',
    'internal',
    'supabase',
    'success',
    jsonb_build_object(
      'wa_number_id', new.id,
      'label', new.label,
      'phone', new.phone,
      'owner_id', new.owner_id,
      'changed_by', who,
      'changes', changed_fields
    )
  );

  return new;
end;
$$;

drop trigger if exists wa_numbers_audit on public.wa_numbers;
create trigger wa_numbers_audit
  after update on public.wa_numbers
  for each row
  execute function public.wa_numbers_audit_trigger();

comment on function public.wa_numbers_audit_trigger() is
  'Loga toggles de active/in_rotation no event_log pra auditar quem tirou número da rotação.';
