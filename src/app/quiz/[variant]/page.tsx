import { notFound } from "next/navigation";
import { QuizFlow } from "../quiz-flow";
import { getQuizConfig } from "@/lib/quiz-config";
import { isVariant } from "@/lib/quiz-archetypes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  const plano = variant === "porcelana" ? "Porcelana" : "Resina";
  return {
    title: `Avaliação Plano ${plano} — Dra. Juliana Pereira`,
    description: `Responda 8 perguntas e a equipe da Dra. Juliana entra em contato pra agendar sua avaliação de Plano ${plano}.`,
  };
}

export default async function QuizVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isVariant(variant)) notFound();
  const config = await getQuizConfig(variant);
  return <QuizFlow config={config} variant={variant} />;
}
