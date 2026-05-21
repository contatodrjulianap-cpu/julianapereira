import type { Metadata } from "next";
import { LpForm } from "./lp-form";

export const metadata: Metadata = {
  title: "Aplicação · Viver de Lentes de Resina",
  description:
    "Aplicação pro curso Viver de Lentes de Resina com a Dra. Juliana Pereira.",
  robots: { index: false, follow: false },
};

export default function AplicacaoVlrPage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "#0A0A0A", color: "#FFFFFF" }}
    >
      <section className="flex-1 flex items-center justify-center px-5 sm:px-8 py-16 sm:py-24">
        <div className="w-full max-w-xl">
          <p
            className="text-center text-[11px] tracking-[3px] uppercase font-semibold mb-6"
            style={{ color: "#F5B521" }}
          >
            Inscrição aberta · acesso por tempo limitado
          </p>

          <h1
            className="text-center uppercase font-bold leading-[1.05] tracking-tight mb-3"
            style={{
              fontSize: "clamp(32px, 6.2vw, 52px)",
              color: "#FFFFFF",
            }}
          >
            Aplicação
            <br />
            <span style={{ color: "#F4E4B8" }}>Curso Viver de Lentes de Resina</span>
          </h1>

          <p
            className="text-center text-sm sm:text-base mb-10"
            style={{ color: "#A1A1AA", lineHeight: 1.55 }}
          >
            Preencha pra continuar com sua aplicação.
          </p>

          <div
            className="rounded-xl p-6 sm:p-8 shadow-xl"
            style={{
              background: "#141414",
              border: "1px solid #27272A",
            }}
          >
            <LpForm />
          </div>

          <p
            className="text-center mt-6 text-[11px]"
            style={{ color: "#71717A", letterSpacing: "0.04em" }}
          >
            Pagamento seguro Kiwify · seus dados não são compartilhados
          </p>
        </div>
      </section>

      <div
        className="overflow-hidden py-3"
        style={{ background: "#F5B521", color: "#0A0A0A" }}
      >
        <div
          className="whitespace-nowrap font-bold text-[13px] sm:text-sm tracking-[2px] uppercase"
          style={{ animation: "vlr-marquee 28s linear infinite" }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="inline-block mr-12">
              Viver de Lentes em Resina <span className="mx-6">·</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes vlr-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
