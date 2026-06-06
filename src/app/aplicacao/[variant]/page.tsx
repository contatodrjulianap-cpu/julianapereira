import { notFound } from "next/navigation";
import { Aplicacao } from "./aplicacao";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ variant: "resina" }, { variant: "porcelana" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  const v = variant === "resina" ? "Resina" : "Porcelana";
  return {
    title: `Aplicação — Lentes em ${v} · Clínica Sakura`,
    description:
      "Candidate-se a uma avaliação exclusiva com a Dra. Juliana Pereira. Sorriso natural, planejado e previsível.",
  };
}

export default async function AplicacaoVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (variant !== "resina" && variant !== "porcelana") notFound();
  return <Aplicacao variant={variant} />;
}
