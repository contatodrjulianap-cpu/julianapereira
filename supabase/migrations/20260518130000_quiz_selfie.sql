-- Coluna selfie_url + bucket privado pra fotos do quiz
-- A pessoa pode mandar uma foto do sorriso opcional antes da lead form.
-- A equipe da Ju usa pra avaliação e orçamento (visível no CRM via signed URL).

alter table public.leads add column if not exists selfie_url text;

-- Bucket privado: nada de leitura pública. CRM acessa via signed URL gerada server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-selfies',
  'quiz-selfies',
  false,
  8388608, -- 8MB
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
