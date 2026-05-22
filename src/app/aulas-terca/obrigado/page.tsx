import { ObrigadoRedirect } from "./redirect";

export const metadata = {
  title: "Pronto! Te vejo na terça | Dra. Juliana Pereira",
  description:
    "Você está no grupo das aulas de terça. Te redirecionamos pro WhatsApp em instantes.",
};

export default function ObrigadoPage() {
  const groupUrl =
    process.env.NEXT_PUBLIC_AULA_TERCA_GROUP_URL ?? "https://sndflw.com/";

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
          Inscrição confirmada
        </p>
        <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-4xl leading-[1.1] sm:text-5xl">
          Pronto. Te vejo na terça, 20h.
        </h1>
        <p className="mt-6 text-lg text-stone-700">
          Tô te mandando agora pro grupo do WhatsApp. É lá que solto o link do
          YouTube ao vivo toda terça às 19h.
        </p>

        <div className="mt-10">
          <a
            href={groupUrl}
            className="inline-flex items-center justify-center rounded-md bg-rose-700 px-6 py-3 text-base font-medium text-white hover:bg-rose-800"
          >
            Entrar no grupo agora
          </a>
          <p className="mt-3 text-xs text-stone-500">
            Se nada acontecer em 3 segundos, clica no botão acima.
          </p>
        </div>

        <ObrigadoRedirect url={groupUrl} delayMs={3000} />
      </section>
    </main>
  );
}
