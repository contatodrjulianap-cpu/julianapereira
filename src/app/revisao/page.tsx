import Image from "next/image";

export const metadata = {
  title: "Material para revisão — Clínica Sakura",
  robots: { index: false, follow: false },
};

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

const SLIDES = [
  {
    href: "/slides/paciente/index.html",
    title: "Apresentação ao Paciente",
    desc: "O deck que o closer usa na avaliação. 16 slides.",
  },
  {
    href: "/slides/comercial/index.html",
    title: "Estrutura Comercial",
    desc: "ICP, esteira, oferta e quadro de produtos. 22 slides.",
  },
];

export default function RevisaoPage() {
  return (
    <main className="min-h-dvh" style={{ background: C.cream, color: C.ink }}>
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-9">
          <Image
            src="/aplicacao/logo-escuro.png"
            alt="Clínica Sakura"
            width={220}
            height={120}
            className="w-40 h-auto mx-auto mb-7"
            priority
          />
          <h1 className="text-3xl leading-tight mb-2" style={SERIF}>
            Material para revisão
          </h1>
          <p className="text-sm text-[#6f635b]">
            Apresentações e funil. Os documentos (processos e scripts) estão no
            Google Drive pra comentar.
          </p>
        </div>

        <p
          className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-3"
          style={{ color: C.greenSoft }}
        >
          Apresentações
        </p>
        <div className="space-y-3 mb-8">
          {SLIDES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener"
              className="block rounded-2xl bg-white/80 border border-[#e2dccf] px-5 py-4 active:opacity-80"
            >
              <p className="text-lg" style={{ ...SERIF, color: C.ink }}>
                {s.title}
              </p>
              <p className="text-[13px] text-[#6f635b] mt-0.5">{s.desc}</p>
              <span
                className="text-[12px] font-semibold mt-1.5 inline-block"
                style={{ color: C.rose }}
              >
                Abrir slides →
              </span>
            </a>
          ))}
        </div>

        <p
          className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-3"
          style={{ color: C.greenSoft }}
        >
          Funil de aplicação (no ar)
        </p>
        <div className="space-y-3 mb-8">
          <a
            href="/aplicacao/porcelana"
            target="_blank"
            rel="noopener"
            className="block rounded-2xl bg-white/80 border border-[#e2dccf] px-5 py-4 active:opacity-80"
          >
            <p className="text-lg" style={{ ...SERIF, color: C.ink }}>
              Página de Aplicação
            </p>
            <p className="text-[13px] text-[#6f635b] mt-0.5">
              LP + formulário + página de obrigado (vídeo + fura-fila).
            </p>
            <span
              className="text-[12px] font-semibold mt-1.5 inline-block"
              style={{ color: C.rose }}
            >
              Abrir página →
            </span>
          </a>
        </div>

        <a
          href="https://drive.google.com/drive/folders/1EtAOF6sr1c2vIxrDm1i6vt0E64cNEZ7S"
          target="_blank"
          rel="noopener"
          className="block rounded-2xl p-5 text-center active:opacity-90"
          style={{ background: C.green }}
        >
          <p className="text-[#fff] text-sm" style={SERIF}>
            Processos e scripts
          </p>
          <p className="text-[#d9ddcf] text-[13px] mt-1">
            Os 11 documentos (ICP, oferta, scripts de closer/fechamento,
            playbook do SDR, matriz de objeções, plano de CRM) — em formato
            comentável.
          </p>
          <span
            className="text-[12px] font-semibold mt-2 inline-block"
            style={{ color: C.cream }}
          >
            Abrir no Google Drive →
          </span>
        </a>

        <p className="text-center text-xs mt-8" style={{ color: C.taupe }}>
          Uso interno · Diniz Digital × Momento Mori
        </p>
      </div>
    </main>
  );
}
