import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Painel · Clínica Sakura",
  robots: { index: false, follow: false },
};

type LinkItem = {
  label: string;
  desc?: string;
  href: string;
  external?: boolean;
  emoji?: string;
};

type Section = {
  title: string;
  items: LinkItem[];
};

const SECTIONS: Section[] = [
  {
    title: "Funis · Quiz",
    items: [
      { label: "Quiz · Plano Resina", desc: "/quiz/resina", href: "/quiz/resina", emoji: "🌸" },
      { label: "Quiz · Plano Porcelana", desc: "/quiz/porcelana", href: "/quiz/porcelana", emoji: "💎" },
    ],
  },
  {
    title: "Funis · Chat (WhatsApp-style)",
    items: [
      { label: "Chat · Plano Resina", desc: "/chat/resina", href: "/chat/resina", emoji: "💬" },
      { label: "Chat · Plano Porcelana", desc: "/chat/porcelana", href: "/chat/porcelana", emoji: "💬" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "CRM da Clínica", desc: "atendimento, leads, funil", href: "/crm", emoji: "📋" },
    ],
  },
  {
    title: "Canais externos",
    items: [
      {
        label: "Instagram @drajuliana.pereira",
        desc: "instagram.com/drajuliana.pereira",
        href: "https://www.instagram.com/drajuliana.pereira/",
        external: true,
        emoji: "📷",
      },
      {
        label: "WhatsApp da clínica",
        desc: "+55 11 96294-3078",
        href: "https://wa.me/5511962943078",
        external: true,
        emoji: "📱",
      },
    ],
  },
];

export default function PainelPage() {
  return (
    <main
      className="min-h-screen px-5 py-10"
      style={{ background: "var(--sakura-cream)", color: "var(--sakura-cocoa)" }}
    >
      <div className="mx-auto w-full max-w-md">
        <header className="text-center mb-8">
          <p
            className="text-[10px] uppercase tracking-[3px] font-semibold font-mono mb-2"
            style={{ color: "var(--sakura-rose-2)" }}
          >
            Painel interno
          </p>
          <h1
            className="text-3xl mb-1"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            Clínica Sakura
          </h1>
          <p className="text-sm" style={{ color: "var(--sakura-cocoa-3)" }}>
            Atalhos da equipe · Dra. Juliana Pereira
          </p>
        </header>

        <div className="space-y-7">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2
                className="text-[11px] uppercase tracking-[2.5px] font-semibold font-mono mb-3 px-1"
                style={{ color: "var(--sakura-cocoa-3)" }}
              >
                {section.title}
              </h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-2xl px-5 py-4 transition-colors"
                        style={{
                          background: "white",
                          border: "1px solid var(--sakura-hairline)",
                        }}
                      >
                        <LinkBody item={item} />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="block rounded-2xl px-5 py-4 transition-colors"
                        style={{
                          background: "white",
                          border: "1px solid var(--sakura-hairline)",
                        }}
                      >
                        <LinkBody item={item} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer
          className="mt-10 text-center text-[11px] font-mono"
          style={{ color: "var(--sakura-cocoa-3)" }}
        >
          uso interno · não indexável
        </footer>
      </div>
    </main>
  );
}

function LinkBody({ item }: { item: LinkItem }) {
  return (
    <div className="flex items-center gap-3">
      {item.emoji && <span className="text-xl shrink-0">{item.emoji}</span>}
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-tight">{item.label}</p>
        {item.desc && (
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: "var(--sakura-cocoa-3)" }}
          >
            {item.desc}
          </p>
        )}
      </div>
      <span style={{ color: "var(--sakura-rose-2)" }}>→</span>
    </div>
  );
}
