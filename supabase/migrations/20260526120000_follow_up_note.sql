-- follow_up_note: tarefa textual ("o que falar/fazer") agendada junto do follow_up_at.
-- Opcional — quando atendente quer só "lembrar amanhã" sem escrever nada, fica null.
-- Usada na tela /crm/status pra listar "tarefas do dia" com contexto.

alter table public.leads
  add column if not exists follow_up_note text;

comment on column public.leads.follow_up_note is
  'Tarefa textual livre vinculada ao follow_up_at — o que a atendente quer lembrar de falar/fazer';

notify pgrst, 'reload schema';
