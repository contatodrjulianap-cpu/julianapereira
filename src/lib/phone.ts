/**
 * Normaliza telefone brasileiro pra formato canônico 55DDDNNNNNNNNN (13 dígitos
 * pra celular). Garante sempre o "9" inicial em celular BR — sem isso, o mesmo
 * número escrito com e sem o 9 vira duas leads (e dois round-robins distintos).
 *
 * Funcao pure (sem dependência de Supabase/Next), pode ser importada
 * tanto em Server quanto Client Components.
 */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D+/g, "");
  // Remove "0" do formato nacional ("0 11 9..." vira "11 9...") — bug histórico
  // em que lead digitava "0 11 95764-8606" e virava "55011..."
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  // Remove DDI 55 se claramente presente (12-13 dígitos com prefixo 55).
  // BR não tem DDD 55, então prefixo 55 em 12-13 dígitos é DDI.
  while (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  // Celular BR sem o 9: DDD(2) + 8 dígitos onde o 1º dígito do número é 6-9
  // (faixa histórica de móvel; fixo é 2-5). Insere "9" pra canonizar.
  // Sem isso, o mesmo celular escrito com e sem 9 vira duas leads distintas.
  if (d.length === 10) {
    const firstNum = d.charCodeAt(2);
    if (firstNum >= 0x36 /* '6' */ && firstNum <= 0x39 /* '9' */) {
      d = d.slice(0, 2) + "9" + d.slice(2);
    }
  }
  // Adiciona DDI 55 se vier 10-11 dígitos sem
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}
