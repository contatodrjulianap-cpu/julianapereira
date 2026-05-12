import { QuizFlow } from "./quiz-flow";
import { getQuizConfig } from "@/lib/quiz-config";

export const metadata = {
  title: "Avaliação com a equipe da Dra. Juliana Pereira",
  description:
    "Responda 8 perguntas e a equipe da Dra. Juliana entra em contato pra agendar uma avaliação.",
};

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const config = await getQuizConfig();
  return <QuizFlow config={config} />;
}
