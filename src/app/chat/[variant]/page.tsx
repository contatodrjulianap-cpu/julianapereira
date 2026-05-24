import { notFound } from "next/navigation";
import { BotFlow } from "../bot-flow";
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
    title: `Chat com a equipe — Plano ${plano} · Dra. Juliana Pereira`,
    description: `Converse com a equipe da Dra. Juliana e descubra em 3 minutos se você é caso pro Plano ${plano}.`,
  };
}

export default async function ChatVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isVariant(variant)) notFound();
  const config = await getQuizConfig(variant);
  return <BotFlow config={config} variant={variant} />;
}
