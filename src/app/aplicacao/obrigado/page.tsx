import Image from "next/image";

export const metadata = {
  title: "Aplicação recebida — Clínica Sakura",
};

// WhatsApp da clínica (fallback caso o greeting automático não chegue).
const WA = "5511962943078";

export default function ObrigadoPage() {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: "#E8E0D4", color: "#2A2420" }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        <Image
          src="/aplicacao/logo-escuro.png"
          alt="Clínica Sakura"
          width={220}
          height={120}
          className="w-44 h-auto mb-10"
          priority
        />

        <div
          className="text-5xl mb-6"
          style={{ color: "#586046" }}
          aria-hidden
        >
          ✓
        </div>

        <h1
          className="font-serif text-3xl leading-tight mb-4"
          style={{ fontFamily: "var(--font-gilda)" }}
        >
          Aplicação recebida.
        </h1>

        <p className="text-base leading-relaxed text-[#473631] mb-3">
          Em instantes nossa equipe te chama no <strong>WhatsApp</strong> pra
          conhecer melhor o seu caso e, se fizer sentido, reservar a sua
          avaliação com a Dra. Juliana.
        </p>
        <p className="text-sm text-[#8a7a6e] mb-10">
          Fique de olho nas mensagens. Cada minuto conta — sua vaga de avaliação
          fica reservada por pouco tempo.
        </p>

        <blockquote
          className="font-serif italic text-2xl leading-snug text-[#473631] mb-2"
          style={{ fontFamily: "var(--font-gilda)" }}
        >
          “Eu fiz no meu próprio sorriso.”
        </blockquote>
        <p className="text-xs uppercase tracking-[0.25em] text-[#B18180] mb-10">
          Dra. Juliana Pereira
        </p>

        <a
          href={`https://wa.me/${WA}?text=${encodeURIComponent(
            "Oi! Acabei de fazer minha aplicação no site e quero falar sobre a minha avaliação 🌸",
          )}`}
          className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide text-[#E8E0D4]"
          style={{ background: "#473631" }}
        >
          Falar agora no WhatsApp
        </a>
      </div>
    </main>
  );
}
