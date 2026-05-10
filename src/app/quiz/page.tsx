import { QuizForm } from "./quiz-form";

export const metadata = {
  title: "Descubra qual tratamento é ideal pra você | Dra. Juliana Pereira",
  description:
    "Responda 4 perguntas e receba uma recomendação personalizada da Dra. Juliana Pereira.",
};

export default function QuizPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white py-10 px-4">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-rose-900">
            Descubra seu tratamento ideal
          </h1>
          <p className="mt-2 text-sm text-rose-700/80">
            4 perguntas. Resposta personalizada no seu WhatsApp em minutos.
          </p>
        </header>
        <QuizForm />
      </div>
    </main>
  );
}
