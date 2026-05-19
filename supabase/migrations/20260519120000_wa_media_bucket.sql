-- Bucket privado pra mídia outbound (câmera / documentos enviados pelo CRM)
-- Z-API baixa via signed URL na hora do send (TTL 5min suficiente).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wa-media',
  'wa-media',
  false,
  20971520, -- 20MB
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
