import { redirect } from "next/navigation";

// Default da aplicação = porcelana (lane high-ticket). Campanhas apontam pra
// /aplicacao/resina ou /aplicacao/porcelana direto.
export default function AplicacaoIndex() {
  redirect("/aplicacao/porcelana");
}
