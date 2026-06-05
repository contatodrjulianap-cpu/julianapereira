import Link from "next/link";
import { CLIENT_CONFIG } from "@/lib/client-config";

const WA_TEXT = encodeURIComponent(
  "Olá! Vim pelo site da Clínica Sakura e gostaria de agendar uma avaliação.",
);
const WHATSAPP_URL = `https://wa.me/${CLIENT_CONFIG.publicWhatsappPhone}?text=${WA_TEXT}`;

export const metadata = {
  title: `${CLIENT_CONFIG.clinicName} — Estética Dental de Alto Padrão`,
  description:
    "Lentes de porcelana e estética dental de alto padrão em São Paulo, com a Dra. Juliana Pereira. Resultado natural, elegante e de precisão.",
};

export default function Home() {
  return (
    <div
      className="min-h-screen bg-brand-sand text-brand-cocoa antialiased"
      style={{ fontFamily: "var(--font-helvetica)" }}
    >
      <Header />
      <main>
        <Hero />
        <Conceito />
        <Pilares />
        <Tratamentos />
        <Doutora />
        <Casos />
        <Localizacao />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-green/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <a href="#top" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clinica/monograma-branco.png" alt={CLIENT_CONFIG.clinicName} className="h-9 w-auto" />
          <span className="hidden font-serif text-lg tracking-[0.2em] text-brand-ice sm:block">
            CLÍNICA SAKURA
          </span>
        </a>
        <nav className="hidden items-center gap-8 text-sm tracking-wide text-brand-ice/80 md:flex">
          <a href="#conceito" className="transition hover:text-white">A clínica</a>
          <a href="#tratamentos" className="transition hover:text-white">Tratamentos</a>
          <a href="#casos" className="transition hover:text-white">Resultados</a>
          <a href="#localizacao" className="transition hover:text-white">Contato</a>
        </nav>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-brand-sand px-5 py-2 text-sm font-medium text-brand-green transition hover:bg-white"
        >
          Agendar
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-brand-green text-brand-ice">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 md:grid-cols-2 md:pb-28 md:pt-24">
        <div className="relative z-10 text-center md:text-left">
          <p className="text-xs tracking-[0.4em] text-brand-sand/80">
            ESTÉTICA DENTAL DE ALTO PADRÃO · SÃO PAULO
          </p>
          <h1 className="mt-6 font-serif text-5xl font-normal leading-[1.05] tracking-tight text-white sm:text-6xl">
            O sorriso muda tudo.
          </h1>
          <p className="mx-auto mt-7 max-w-md text-lg leading-relaxed text-brand-ice/75 md:mx-0">
            O seu sorriso, planejado com cuidado e técnica: natural e elegante,
            do jeito que combina com você.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-full bg-brand-sand px-7 py-3.5 text-sm font-medium text-brand-green transition hover:bg-white sm:w-auto"
            >
              Agendar uma avaliação
            </a>
            <Link
              href="/quiz"
              className="inline-flex w-full items-center justify-center rounded-full border border-brand-sand/40 px-7 py-3.5 text-sm font-medium text-brand-ice transition hover:border-brand-sand hover:bg-white/5 sm:w-auto"
            >
              Descobrir meu tratamento
            </Link>
          </div>
        </div>

        <div className="relative z-10">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/clinica/ju-hero.jpg"
              alt={`${CLIENT_CONFIG.professionalName}, da Clínica Sakura`}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Conceito() {
  return (
    <section id="conceito" className="bg-brand-sand py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <p className="text-xs tracking-[0.4em] text-brand-green">A CLÍNICA</p>
        <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-brand-cocoa sm:text-5xl">
          Autoridade em estética dental,
          <br className="hidden sm:block" /> num novo nível
        </h2>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-brand-cocoa/80">
          <p>
            A Clínica Sakura nasce como a evolução natural da trajetória da{" "}
            {CLIENT_CONFIG.professionalName}, consolidando sua autoridade em
            estética dental em um novo nível: as lentes de porcelana.
          </p>
          <p>
            A flor de cerejeira traduz a proposta da clínica — beleza,
            renovação e naturalidade. Transformar sorrisos com leveza e alto
            padrão técnico, onde nada é por acaso.
          </p>
        </div>
        <blockquote className="mx-auto mt-10 max-w-xl font-serif text-2xl italic leading-snug text-brand-green">
          “Nada é excessivo. Tudo é intencional.”
        </blockquote>
      </div>
    </section>
  );
}

const PILARES = [
  {
    titulo: "Resultado natural",
    texto: "Sorrisos que parecem — e são — seus. Sem exageros, sem artificial.",
  },
  {
    titulo: "Alto padrão técnico",
    texto: "Planejamento digital e execução de precisão em cada caso.",
  },
  {
    titulo: "Elegância",
    texto: "Estética nos detalhes que ninguém vê, mas que todos percebem.",
  },
  {
    titulo: "Cuidado de perto",
    texto: "Da avaliação à cimentação, você acompanhada em cada etapa.",
  },
];

function Pilares() {
  return (
    <section className="bg-brand-green py-20 text-brand-ice md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs tracking-[0.4em] text-brand-sand/80">POR QUE A SAKURA</p>
          <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-white sm:text-5xl">
            Elegância é consequência da precisão
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILARES.map((item, i) => (
            <div
              key={item.titulo}
              className="rounded-3xl border border-white/12 bg-white/5 p-7 text-center"
            >
              <p className="text-xs tracking-[0.3em] text-brand-sand/70">0{i + 1}</p>
              <h3 className="mt-3 font-serif text-2xl text-white">{item.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-ice/70">{item.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TRATAMENTOS = [
  {
    nome: "Lentes de porcelana",
    img: "/clinica/porcelana.jpeg",
    texto:
      "Cerâmica de altíssima resistência e naturalidade. Planejamento digital e resultado pensado pra durar.",
  },
  {
    nome: "Facetas em resina",
    img: "/clinica/resina.jpeg",
    texto:
      "Reconstrução estética minimamente invasiva, feita em consultório, com acabamento artesanal.",
  },
];

function Tratamentos() {
  return (
    <section id="tratamentos" className="bg-brand-sand py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs tracking-[0.4em] text-brand-green">TRATAMENTOS</p>
          <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-brand-cocoa sm:text-5xl">
            Elegância em lentes e resinas
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-brand-cocoa/80">
            Do planejamento à cimentação, cada etapa pensada pra um sorriso de
            aparência natural.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {TRATAMENTOS.map((t) => (
            <article
              key={t.nome}
              className="overflow-hidden rounded-3xl border border-brand-line bg-brand-sand-2"
            >
              <div className="aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.img} alt={t.nome} className="h-full w-full object-cover" />
              </div>
              <div className="p-7">
                <h3 className="font-serif text-2xl text-brand-cocoa">{t.nome}</h3>
                <p className="mt-2 leading-relaxed text-brand-cocoa/80">{t.texto}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-brand-cocoa/80">
          Também realizamos{" "}
          <strong className="font-medium text-brand-cocoa">clareamento</strong> e{" "}
          <strong className="font-medium text-brand-cocoa">harmonização do sorriso</strong>.{" "}
          <Link href="/quiz" className="font-medium text-brand-green underline-offset-4 hover:underline">
            Descubra o seu →
          </Link>
        </p>
      </div>
    </section>
  );
}

const CASOS = [
  { img: "/clinica/case-porcelana.jpg", label: "Lentes de porcelana" },
  { img: "/clinica/case-resina.jpg", label: "Facetas em resina" },
];

function Casos() {
  return (
    <section id="casos" className="bg-brand-ice py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs tracking-[0.4em] text-brand-green">RESULTADOS</p>
          <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-brand-cocoa sm:text-5xl">
            Casos reais
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-brand-cocoa/80">
            Transformações conduzidas do planejamento à cimentação, na própria
            clínica.
          </p>
        </div>

        <div className="mt-14 grid items-start gap-8 md:grid-cols-2">
          {CASOS.map((c) => (
            <figure
              key={c.label}
              className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-brand-line bg-brand-sand-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt={`Antes e depois — ${c.label}`} className="block h-auto w-full" />
              <figcaption className="px-6 py-4 text-center text-sm tracking-wide text-brand-cocoa/80">
                Antes e depois · {c.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Doutora() {
  return (
    <section className="bg-brand-sand py-20 md:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 sm:px-8 md:grid-cols-[0.8fr_1fr]">
        <div className="relative mx-auto w-full max-w-xs">
          <div className="aspect-[4/5] overflow-hidden rounded-[2rem] border border-brand-line shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/clinica/ju-bio.jpg" alt={CLIENT_CONFIG.professionalName} className="h-full w-full object-cover" />
          </div>
        </div>
        <div>
          <p className="text-xs tracking-[0.4em] text-brand-green">A FUNDADORA</p>
          <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-brand-cocoa sm:text-5xl">
            {CLIENT_CONFIG.professionalName}
          </h2>
          <p className="mt-2 text-sm tracking-wide text-brand-cocoa/60">
            CRO-SP {CLIENT_CONFIG.crosp} · Estética Dental
          </p>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-brand-cocoa/80">
            <p>
              Anos construindo uma trajetória de dedicação e técnica, cuidando
              de cada sorriso e ensinando estética dental a dentistas de todo o
              Brasil.
            </p>
            <p>
              A Clínica Sakura é a consolidação desse trabalho num novo
              patamar: lentes de porcelana e um padrão de resultado em que
              naturalidade e elegância caminham juntas.
            </p>
          </div>
          <a
            href={CLIENT_CONFIG.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand-green transition hover:text-brand-cocoa"
          >
            @{CLIENT_CONFIG.instagramHandle} →
          </a>
        </div>
      </div>
    </section>
  );
}

function Localizacao() {
  return (
    <section id="localizacao" className="bg-brand-green py-20 text-brand-ice md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <p className="text-xs tracking-[0.4em] text-brand-sand/80">ONDE ESTAMOS</p>
        <h2 className="mt-4 font-serif text-4xl font-normal leading-tight text-white sm:text-5xl">
          No coração de São Paulo
        </h2>
        <address className="mt-6 space-y-1 text-lg not-italic leading-relaxed text-brand-ice/80">
          {CLIENT_CONFIG.address.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </address>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={CLIENT_CONFIG.address.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full border border-brand-sand/40 px-7 py-3.5 text-sm font-medium text-brand-ice transition hover:border-brand-sand hover:bg-white/5 sm:w-auto"
          >
            Ver no mapa
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-sand px-7 py-3.5 text-sm font-medium text-brand-green transition hover:bg-white sm:w-auto"
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section className="bg-brand-cocoa py-20 text-center md:py-28">
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <h2 className="font-serif text-4xl font-normal leading-tight text-brand-ice sm:text-5xl">
          Vamos transformar o seu sorriso?
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-brand-ice/70">
          Comece com uma avaliação. A gente cuida do resto, com calma e
          precisão.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-sand px-8 py-3.5 text-sm font-medium text-brand-cocoa transition hover:bg-white sm:w-auto"
          >
            Agendar uma avaliação
          </a>
          <Link
            href="/quiz"
            className="inline-flex w-full items-center justify-center rounded-full border border-brand-ice/30 px-8 py-3.5 text-sm font-medium text-brand-ice transition hover:bg-white/5 sm:w-auto"
          >
            Descobrir meu tratamento
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-brand-green py-12 text-brand-ice">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 text-center sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/clinica/logo-branca-vertical.png" alt={CLIENT_CONFIG.clinicName} className="h-20 w-auto" />
        <p className="max-w-md text-sm leading-relaxed text-brand-ice/60">
          {CLIENT_CONFIG.professionalName} · CRO-SP {CLIENT_CONFIG.crosp}
          <br />
          {CLIENT_CONFIG.address.lines[0]}
        </p>
        <div className="flex items-center gap-6 text-sm text-brand-ice/80">
          <a href={CLIENT_CONFIG.instagramUrl} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
            Instagram
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
            WhatsApp
          </a>
          <a href={CLIENT_CONFIG.address.mapsUrl} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
            Localização
          </a>
        </div>
        <p className="text-xs tracking-[0.25em] text-brand-ice/50">
          CLÍNICA SAKURA · ESTÉTICA DENTAL
        </p>
      </div>
    </footer>
  );
}
