import Link from "next/link";
import { CLIENT_CONFIG } from "@/lib/client-config";
import { SakuraBranch, SakuraFlower, PetalLayer } from "./_institucional/sakura-art";

const WA_TEXT = encodeURIComponent(
  "Olá! Vim pelo site da Clínica Sakura e gostaria de agendar uma avaliação.",
);
const WHATSAPP_URL = `https://wa.me/${CLIENT_CONFIG.publicWhatsappPhone}?text=${WA_TEXT}`;

export const metadata = {
  title: `${CLIENT_CONFIG.clinicName} — Odontologia Estética em São Paulo`,
  description:
    "Sorrir é florescer. Lentes de porcelana, facetas em resina, clareamento e harmonização do sorriso com a Dra. Juliana Pereira, na Av. Paulista.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-sakura-cream font-sans text-sakura-cocoa antialiased">
      <Header />
      <main>
        <Hero />
        <Conceito />
        <Galho />
        <Especialidades />
        <Casos />
        <Doutora />
        <Localizacao />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-col items-center leading-none ${className}`}>
      <span className="font-serif text-2xl font-medium tracking-[0.32em] text-sakura-cocoa">
        SAKURA
      </span>
      <span className="mt-1 text-[0.5rem] tracking-[0.42em] text-sakura-cocoa-3">
        ODONTOLOGIA ESTÉTICA
      </span>
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-sakura-hairline/60 bg-sakura-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-sm tracking-wide text-sakura-cocoa-2 md:flex">
          <a href="#conceito" className="transition hover:text-sakura-rose-2">A Sakura</a>
          <a href="#especialidades" className="transition hover:text-sakura-rose-2">Tratamentos</a>
          <a href="#casos" className="transition hover:text-sakura-rose-2">Resultados</a>
          <a href="#localizacao" className="transition hover:text-sakura-rose-2">Onde estamos</a>
        </nav>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-sakura-rose-2 px-5 py-2 text-sm font-medium text-sakura-cream shadow-sm transition hover:bg-sakura-cocoa"
        >
          Agendar
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <PetalLayer />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-16 sm:px-8 md:grid-cols-2 md:pb-28 md:pt-24">
        <div className="relative z-10 text-center md:text-left">
          <p className="text-xs tracking-[0.4em] text-sakura-rose-2">
            SÃO PAULO · AV. PAULISTA
          </p>
          <h1 className="mt-5 font-serif text-6xl font-medium leading-[0.95] tracking-tight text-sakura-cocoa sm:text-7xl">
            Sorrir é<br />
            <span className="text-sakura-rose-2">florescer</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-sakura-cocoa-2 md:mx-0">
            Odontologia estética que floresce no tempo certo. Lentes, facetas em
            resina, clareamento e harmonização do sorriso, com a precisão e o
            cuidado da {CLIENT_CONFIG.professionalName}.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-full bg-sakura-rose-2 px-7 py-3.5 text-sm font-medium text-sakura-cream shadow-sm transition hover:bg-sakura-cocoa sm:w-auto"
            >
              Agendar uma avaliação
            </a>
            <Link
              href="/quiz"
              className="inline-flex w-full items-center justify-center rounded-full border border-sakura-rose-2/40 px-7 py-3.5 text-sm font-medium text-sakura-cocoa transition hover:border-sakura-rose-2 hover:bg-sakura-cream-2 sm:w-auto"
            >
              Descobrir meu tratamento
            </Link>
          </div>
        </div>

        <div className="relative z-10">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] border border-sakura-hairline bg-sakura-cream-2 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/clinica/ju-hero.jpg"
              alt={`${CLIENT_CONFIG.professionalName}, da Clínica Sakura`}
              className="h-full w-full object-cover"
            />
          </div>
          <SakuraFlower className="absolute -left-4 -top-4 h-16 w-16 text-sakura-rose/70 md:-left-8 md:h-24 md:w-24" />
          <SakuraFlower className="absolute -bottom-3 right-2 h-10 w-10 text-sakura-rose/60 md:right-0 md:h-16 md:w-16" />
        </div>
      </div>
    </section>
  );
}

function Conceito() {
  return (
    <section id="conceito" className="bg-sakura-cream-2 py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <SakuraBranch className="mx-auto h-10 w-52 text-sakura-rose" />
        <p className="mt-8 text-xs tracking-[0.4em] text-sakura-rose-2">
          UMA NOVA ESTAÇÃO
        </p>
        <h2 className="mt-4 font-serif text-4xl font-medium leading-tight text-sakura-cocoa sm:text-5xl">
          A clínica que floresceu
          <br className="hidden sm:block" /> no tempo certo
        </h2>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-sakura-cocoa-2">
          <p>
            No Japão, a sakura marca a chegada da primavera. Ela anuncia o fim
            de um ciclo e o começo de outro. Não floresce por acaso, floresce
            depois de criar raízes, atravessar estações e se preparar em
            silêncio para transformar a paisagem.
          </p>
          <p>
            Assim nasce esta nova fase: uma clínica maior, com uma equipe mais
            completa, pronta para acolher mais pacientes. Um lugar que não só
            transforma sorrisos, mas transborda cuidado, delicadeza, renovação
            e propósito.
          </p>
        </div>
        <blockquote className="mx-auto mt-10 max-w-xl border-l-2 border-sakura-rose pl-5 text-left font-serif text-2xl italic leading-snug text-sakura-cocoa">
          “Como a sakura, seu sorriso floresce no momento em que você decide
          cuidar dele.”
        </blockquote>
      </div>
    </section>
  );
}

const GALHO_ITENS = [
  {
    titulo: "A raiz",
    texto: "A Dra. Juliana, fundadora. A origem, os valores e o padrão que não muda.",
  },
  {
    titulo: "Os galhos",
    texto: "As especialidades que crescem em direções próprias, da mesma árvore.",
  },
  {
    titulo: "Os profissionais",
    texto: "Cada um com sua área, todos compartilhando a mesma essência.",
  },
  {
    titulo: "As flores",
    texto: "Os pacientes transformados. Cada sorriso que floresce em cada ponta.",
  },
];

function Galho() {
  return (
    <section className="bg-sakura-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs tracking-[0.4em] text-sakura-rose-2">CRESCIMENTO</p>
          <h2 className="mt-4 font-serif text-4xl font-medium leading-tight text-sakura-cocoa sm:text-5xl">
            Uma raiz. Muitos galhos.
            <br /> Flores em cada ponta.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-sakura-cocoa-2">
            A cerejeira não cresce só para cima. Ela se abre, se ramifica, e
            quanto mais se ramifica, mais flores produz. Essa é a lógica de
            crescimento da Sakura.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {GALHO_ITENS.map((item, i) => (
            <div
              key={item.titulo}
              className="rounded-3xl border border-sakura-hairline bg-sakura-cream-2/60 p-7 text-center"
            >
              <SakuraFlower className="mx-auto h-10 w-10 text-sakura-rose" />
              <p className="mt-2 text-xs tracking-[0.3em] text-sakura-rose-2">
                0{i + 1}
              </p>
              <h3 className="mt-3 font-serif text-2xl text-sakura-cocoa">
                {item.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-sakura-cocoa-2">
                {item.texto}
              </p>
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

function Especialidades() {
  return (
    <section id="especialidades" className="bg-sakura-cream-2 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs tracking-[0.4em] text-sakura-rose-2">TRATAMENTOS</p>
          <h2 className="mt-4 font-serif text-4xl font-medium leading-tight text-sakura-cocoa sm:text-5xl">
            O que floresce aqui
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-sakura-cocoa-2">
            Do planejamento à cimentação, cada etapa pensada pra um sorriso que
            parece — e é — natural.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {TRATAMENTOS.map((t) => (
            <article
              key={t.nome}
              className="overflow-hidden rounded-3xl border border-sakura-hairline bg-sakura-cream"
            >
              <div className="aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.img} alt={t.nome} className="h-full w-full object-cover" />
              </div>
              <div className="p-7">
                <h3 className="font-serif text-2xl text-sakura-cocoa">{t.nome}</h3>
                <p className="mt-2 leading-relaxed text-sakura-cocoa-2">{t.texto}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sakura-cocoa-2">
          Também realizamos <strong className="font-medium text-sakura-cocoa">clareamento</strong>,{" "}
          <strong className="font-medium text-sakura-cocoa">harmonização do sorriso</strong> e tratamentos
          personalizados.{" "}
          <Link href="/quiz" className="font-medium text-sakura-rose-2 underline-offset-4 hover:underline">
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
    <section id="casos" className="bg-sakura-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs tracking-[0.4em] text-sakura-rose-2">RESULTADOS</p>
          <h2 className="mt-4 font-serif text-4xl font-medium leading-tight text-sakura-cocoa sm:text-5xl">
            Casos reais
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-sakura-cocoa-2">
            Transformações conduzidas do planejamento à cimentação, na própria
            clínica.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {CASOS.map((c) => (
            <figure
              key={c.label}
              className="overflow-hidden rounded-3xl border border-sakura-hairline bg-sakura-cream-2"
            >
              <div className="aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt={`Antes e depois — ${c.label}`} className="h-full w-full object-cover" />
              </div>
              <figcaption className="px-6 py-4 text-center text-sm tracking-wide text-sakura-cocoa-2">
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
    <section className="bg-sakura-cream-2 py-20 md:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 sm:px-8 md:grid-cols-[0.8fr_1fr]">
        <div className="relative mx-auto w-full max-w-xs">
          <div className="aspect-[4/5] overflow-hidden rounded-[2rem] border border-sakura-hairline shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/clinica/ju-bio.jpg" alt={CLIENT_CONFIG.professionalName} className="h-full w-full object-cover" />
          </div>
          <SakuraFlower className="absolute -bottom-4 -right-4 h-16 w-16 text-sakura-rose/70" />
        </div>
        <div>
          <p className="text-xs tracking-[0.4em] text-sakura-rose-2">A FUNDADORA</p>
          <h2 className="mt-4 font-serif text-4xl font-medium leading-tight text-sakura-cocoa sm:text-5xl">
            {CLIENT_CONFIG.professionalName}
          </h2>
          <p className="mt-2 text-sm tracking-wide text-sakura-cocoa-3">
            CRO-SP {CLIENT_CONFIG.crosp} · Odontologia Estética
          </p>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-sakura-cocoa-2">
            <p>
              Anos construindo uma trajetória de dedicação, técnica e um jeito
              único de cuidar de cada sorriso e de ensinar Odontologia Estética
              a dentistas de todo o Brasil.
            </p>
            <p>
              A Sakura nasce desse cuidado que não cabia mais em um só espaço.
              É a raiz de onde crescem novos galhos: mais profissionais, mais
              especialidades, a mesma essência.
            </p>
          </div>
          <a
            href={CLIENT_CONFIG.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-sakura-rose-2 transition hover:text-sakura-cocoa"
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
    <section id="localizacao" className="bg-sakura-cream py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <SakuraBranch className="mx-auto h-9 w-44 text-sakura-rose" />
        <p className="mt-7 text-xs tracking-[0.4em] text-sakura-rose-2">ONDE ESTAMOS</p>
        <h2 className="mt-4 font-serif text-4xl font-medium leading-tight text-sakura-cocoa sm:text-5xl">
          No coração de São Paulo
        </h2>
        <address className="mt-6 space-y-1 text-lg not-italic leading-relaxed text-sakura-cocoa-2">
          {CLIENT_CONFIG.address.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </address>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={CLIENT_CONFIG.address.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full border border-sakura-rose-2/40 px-7 py-3.5 text-sm font-medium text-sakura-cocoa transition hover:border-sakura-rose-2 hover:bg-sakura-cream-2 sm:w-auto"
          >
            Ver no mapa
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-sakura-rose-2 px-7 py-3.5 text-sm font-medium text-sakura-cream shadow-sm transition hover:bg-sakura-cocoa sm:w-auto"
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
    <section className="relative overflow-hidden bg-sakura-cocoa py-20 text-center md:py-28">
      <SakuraFlower className="absolute -left-6 top-8 h-28 w-28 text-sakura-rose/15" />
      <SakuraFlower className="absolute -right-4 bottom-6 h-36 w-36 text-sakura-rose/10" />
      <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
        <h2 className="font-serif text-4xl font-medium leading-tight text-sakura-cream sm:text-5xl">
          Pronta pra ver seu sorriso florescer?
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-sakura-cream/70">
          Comece com uma avaliação. A gente cuida do resto, no tempo certo.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full bg-sakura-rose px-8 py-3.5 text-sm font-medium text-sakura-cocoa shadow-sm transition hover:bg-sakura-cream sm:w-auto"
          >
            Agendar uma avaliação
          </a>
          <Link
            href="/quiz"
            className="inline-flex w-full items-center justify-center rounded-full border border-sakura-cream/30 px-8 py-3.5 text-sm font-medium text-sakura-cream transition hover:bg-sakura-cocoa-2 sm:w-auto"
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
    <footer className="border-t border-sakura-hairline bg-sakura-cream-2 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 text-center sm:px-8">
        <Wordmark />
        <p className="max-w-md text-sm leading-relaxed text-sakura-cocoa-3">
          {CLIENT_CONFIG.professionalName} · CRO-SP {CLIENT_CONFIG.crosp}
          <br />
          {CLIENT_CONFIG.address.lines[0]}
        </p>
        <div className="flex items-center gap-6 text-sm text-sakura-cocoa-2">
          <a href={CLIENT_CONFIG.instagramUrl} target="_blank" rel="noopener noreferrer" className="transition hover:text-sakura-rose-2">
            Instagram
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-sakura-rose-2">
            WhatsApp
          </a>
          <a href={CLIENT_CONFIG.address.mapsUrl} target="_blank" rel="noopener noreferrer" className="transition hover:text-sakura-rose-2">
            Localização
          </a>
        </div>
        <p className="text-xs tracking-wide text-sakura-cocoa-3">
          © {CLIENT_CONFIG.clinicName} · Sorrir é florescer
        </p>
      </div>
    </footer>
  );
}
