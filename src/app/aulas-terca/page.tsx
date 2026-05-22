import { AulaTercaForm } from "./form";

export const metadata = {
  title: "Aulas de Terça com Dra. Juliana Pereira",
  description:
    "Toda terça, 20h, ao vivo no YouTube. Aula gratuita pra dentista que quer fazer dinheiro de verdade.",
};

export default function AulasTercaPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
          Aula ao vivo, gratuita, toda terça
        </p>

        <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-4xl leading-[1.1] sm:text-5xl">
          Toda terça, 20h, eu te mostro como dentista faz dinheiro de verdade.
        </h1>

        <p className="mt-6 text-lg text-stone-700">
          Aula ao vivo no YouTube, gratuita, sem enrolação. Pra dentista que
          cansou de trabalhar mais e ganhar igual.
        </p>

        <div className="mt-10 space-y-4 border-l-2 border-rose-700/70 pl-5 text-stone-800">
          <p>
            <span className="font-semibold">O cálculo</span> que separa
            dentista que fatura R$ 30k de dentista que fatura R$ 100k. Não é
            volume de paciente.
          </p>
          <p>
            <span className="font-semibold">Por que aumentar preço</span> sem
            perder paciente é técnica, não sorte.
          </p>
          <p>
            <span className="font-semibold">Como sair</span> do "vendendo
            procedimento" pra "vendendo transformação", sem soar vendedor.
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl">
            Entre no grupo e receba o link da próxima aula
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Você cai direto no grupo do WhatsApp. Toda terça, 19h, mando o link
            do YouTube ao vivo.
          </p>
          <div className="mt-6">
            <AulaTercaForm />
          </div>
        </div>

        <p className="mt-10 text-xs text-stone-500">
          Dra. Juliana Pereira · CRO-SP · Odontologia estética e gestão de
          consultório.
        </p>
      </section>
    </main>
  );
}
