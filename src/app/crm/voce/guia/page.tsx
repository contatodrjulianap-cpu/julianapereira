import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";
import { SourceBadge } from "../../conversas/source-icons";

export const dynamic = "force-dynamic";

const TEMPERATURE = [
  {
    emoji: "🔥",
    label: "Quente",
    desc: "Última msg do lead há menos de 1h. Responde rápido — alta chance de fechar agora.",
  },
  {
    emoji: "☀️",
    label: "Morno",
    desc: "Última msg do lead há menos de 24h. Ainda dá pra recuperar — vale follow-up.",
  },
  {
    emoji: "❄️",
    label: "Frio",
    desc: "Sem msg há mais de 24h. Provavelmente esfriou. Reengajar com cuidado.",
  },
  {
    emoji: "✅",
    label: "Comprou",
    desc: "Lead com status Fechado. Substitui a temperatura — venda já foi.",
  },
  {
    emoji: "❌",
    label: "Perdido",
    desc: "Lead com status Perdido. Substitui a temperatura — não fechou.",
  },
  {
    emoji: "⏰",
    label: "Follow up agendado",
    desc: "Lead com lembrete marcado (via ⏰ Lembrar amanhã das ações rápidas).",
  },
];

const SOURCES = [
  { value: "instagram", label: "Instagram", desc: "Lead veio de anúncio ou bio do Instagram." },
  { value: "google", label: "Google", desc: "Lead clicou num anúncio Google Ads ou achou no Maps/busca." },
  { value: "tiktok", label: "TikTok", desc: "Lead veio de anúncio ou conteúdo orgânico no TikTok." },
  { value: "quiz", label: "Quiz", desc: "Lead respondeu o questionário em clinicasakura.org/quiz." },
  { value: "indicacao", label: "Indicação", desc: "Paciente atual ou conhecido indicou esse lead." },
  { value: "organico", label: "Orgânico / SEO", desc: "Lead chegou pelo site sem anúncio (Google orgânico, link direto)." },
  { value: "whatsapp", label: "WhatsApp direto", desc: "Sem origem identificada — abriu conversa direto no WhatsApp." },
];

const PIPELINE = [
  { emoji: "🆕", label: "Novos", desc: "Lead acabou de chegar, ainda não foi atendido." },
  { emoji: "🤝", label: "Em contato", desc: "Já começou a conversa, em qualificação." },
  { emoji: "⏰", label: "Follow up", desc: "Recebeu orçamento / avaliação e aguarda acompanhamento. Lead com lembrete marcado também cai aqui." },
  { emoji: "✅", label: "Fechados", desc: "Vendeu — paciente agendou o procedimento." },
  { emoji: "❌", label: "Perdidos", desc: "Desistiu, sumiu ou não fechou." },
];

const GESTURES = [
  {
    emoji: "👈",
    label: "Arrastar pra esquerda",
    desc: "Revela atalho de ✅ Comprou e ❌ Perdido.",
  },
  {
    emoji: "👉",
    label: "Arrastar pra direita",
    desc: "Revela atalho de 📌 Fixar/Desfixar e ⏰ Follow-up.",
  },
  {
    emoji: "✋",
    label: "Segurar (long-press)",
    desc: "Abre menu completo: mover pipeline, mudar origem, copiar telefone, ver detalhes.",
  },
  {
    emoji: "📌",
    label: "Pin no avatar",
    desc: "Lead fixado aparece sempre no topo da lista.",
  },
];

export default async function GuiaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  return (
    <CrmShell active="voce" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-6">
        <div className="mb-5">
          <Link
            href="/crm/voce"
            className="text-sm text-slate-500 inline-flex items-center gap-1"
          >
            ← Você
          </Link>
        </div>
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Guia visual</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            O que cada ícone significa no app.
          </p>
        </header>

        <Section title="Temperatura do lead">
          {TEMPERATURE.map((t) => (
            <Row key={t.emoji} icon={<span className="text-2xl">{t.emoji}</span>} label={t.label} desc={t.desc} />
          ))}
        </Section>

        <Section title="Origem (canal)">
          {SOURCES.map((s) => (
            <Row
              key={s.value}
              icon={<SourceBadge source={s.value} />}
              label={s.label}
              desc={s.desc}
            />
          ))}
        </Section>

        <Section title="Pipeline (status)">
          {PIPELINE.map((p) => (
            <Row key={p.label} icon={<span className="text-2xl">{p.emoji}</span>} label={p.label} desc={p.desc} />
          ))}
        </Section>

        <Section title="Gestos">
          {GESTURES.map((g) => (
            <Row key={g.label} icon={<span className="text-2xl">{g.emoji}</span>} label={g.label} desc={g.desc} />
          ))}
        </Section>
      </div>
    </CrmShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
        {title}
      </h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 leading-snug mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
