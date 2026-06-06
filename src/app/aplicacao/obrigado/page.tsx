import Image from "next/image";
import { VturbPlayer } from "@/components/vturb-player";
import { anchorCaseFor } from "@/lib/video-config";
import type { Variant } from "@/lib/quiz-archetypes";

export const metadata = {
  title: "Aplicação recebida — Clínica Sakura",
};

// WhatsApp da clínica (fura-fila / fallback).
const WA = "5511962943078";

const C = {
  cream: "#E8E0D4",
  green: "#41482F",
  greenSoft: "#586046",
  brown: "#473631",
  rose: "#B18180",
  ink: "#2A2420",
  taupe: "#8a7a6e",
};
const SERIF = { fontFamily: "var(--font-gilda)" } as const;

const PASSOS = [
  ["Sua aplicação chegou", "A equipe já recebeu o seu caso aqui."],
  ["Vamos te chamar no WhatsApp", "Pra entender melhor o que você quer no seu sorriso."],
  ["Reserva da avaliação", "Encaixamos o melhor horário com a Equipe da Dra. Juliana."],
  ["Avaliação", "Você sai com o plano do seu caso, com previsibilidade e sem surpresa."],
];

export default async function ObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const variant: Variant = v === "resina" ? "resina" : "porcelana";
  const video = anchorCaseFor(variant).video;

  const furaFilaHref = `https://wa.me/${WA}?text=${encodeURIComponent(
    "Oi! Acabei de me candidatar no site e quero furar a fila pra agendar minha avaliação 🌸",
  )}`;

  return (
    <main className="min-h-dvh" style={{ background: C.cream, color: C.ink }}>
      <div className="max-w-md mx-auto px-6 py-12">
        {/* header */}
        <div className="text-center">
          <Image
            src="/aplicacao/logo-escuro.png"
            alt="Clínica Sakura"
            width={220}
            height={120}
            className="w-40 h-auto mx-auto mb-8"
            priority
          />
          <div className="text-4xl mb-4" style={{ color: C.greenSoft }} aria-hidden>
            ✓
          </div>
          <h1 className="text-3xl leading-tight mb-3" style={SERIF}>
            Aplicação recebida.
          </h1>
          <p className="text-sm text-[#473631] leading-relaxed">
            Já já a gente te chama no WhatsApp. Enquanto isso, veja como funciona
            e um resultado real.
          </p>
        </div>

        {/* passo a passo */}
        <section className="mt-9">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-4"
            style={{ color: C.greenSoft }}
          >
            O que acontece agora
          </p>
          <ol className="space-y-3">
            {PASSOS.map(([t, d], i) => (
              <li
                key={t}
                className="flex gap-3.5 rounded-xl bg-white/70 border border-[#e2dccf] px-4 py-3"
              >
                <span className="shrink-0 text-2xl leading-none" style={{ ...SERIF, color: C.rose }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium text-[15px]">{t}</p>
                  <p className="text-[13px] text-[#6f635b]">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* vídeo de resultado */}
        <section className="mt-9">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-3"
            style={{ color: C.greenSoft }}
          >
            Um resultado real
          </p>
          <div className="rounded-2xl overflow-hidden bg-black/5">
            <VturbPlayer video={video} />
          </div>
        </section>

        {/* fura-fila */}
        <section
          className="mt-9 rounded-2xl p-6 text-center"
          style={{ background: C.green }}
        >
          <p className="text-[#fff] text-xl mb-1.5" style={SERIF}>
            Não quer esperar?
          </p>
          <p className="text-[#d9ddcf] text-sm mb-5">
            Fure a fila e fale agora com a nossa equipe pra adiantar a sua
            avaliação.
          </p>
          <a
            href={furaFilaHref}
            className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide w-full"
            style={{ background: C.rose, color: "#3a2723" }}
          >
            Furar a fila no WhatsApp
          </a>
        </section>

        <p className="text-center text-xs mt-8" style={{ color: C.taupe }}>
          Clínica Sakura · Odontologia Estética
        </p>
      </div>
    </main>
  );
}
