import { QuizFlow } from "./quiz-flow";
import { getQuizConfig } from "@/lib/quiz-config";

export const metadata = {
  title: "Diagnóstico do Sorriso | Dra. Juliana Pereira",
  description:
    "Em 8 perguntas, descubra qual caminho faz sentido pro seu sorriso. Diagnóstico personalizado da Dra. Juliana Pereira.",
};

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const config = await getQuizConfig();
  return <QuizFlow config={config} />;
}
