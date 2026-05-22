-- Bucket wa-media originalmente só aceitava image/pdf/office/text. Isso
-- bloqueava 100% dos áudios inbound dos leads e outbound das atendentes —
-- Z-API entrega como `audio/ogg; codecs=opus` e o Supabase rejeitava com
-- "mime type ... is not supported". Adiciona audio/* e video/* na allowlist.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif',
  'audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/x-m4a',
  'video/mp4','video/webm','video/quicktime','video/3gpp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]
where id = 'wa-media';
