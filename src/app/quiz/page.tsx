import { redirect } from "next/navigation";

// Rota antiga: /quiz -> /quiz/resina (variant default).
// Mantida pra não quebrar anúncios apontando pra URL antiga enquanto migra.
export default function QuizIndexPage() {
  redirect("/quiz/resina");
}
