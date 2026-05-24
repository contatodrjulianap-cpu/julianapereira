/**
 * Normaliza telefone brasileiro pra formato canônico 55DDDNNNNNNNNN.
 *
 * Funcao pure (sem dependência de Supabase/Next), pode ser importada
 * tanto em Server quanto Client Components.
 */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D+/g, "");
  // Remove DDI 55 inicial (se 13+ dígitos) pra normalizar o core BR
  while (d.length >= 13 && d.startsWith("55")) d = d.slice(2);
  // Remove "0" inicial do DDD (formato nacional "0 11 9..." vira "11 9...")
  // Cobre o bug histórico: lead digitava "0 11 95764-8606" → virava "55011..."
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  // Adiciona DDI 55 se vier 10-11 dígitos sem
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}
