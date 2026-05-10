# Dra. Juliana Pereira

Plataforma do consultório (Clínica Sakura, B2C) e da educação B2B (VLR / Mentoria Legacy).

**Funcionalidades:**

- `/` — landing
- `/quiz` — quiz público que qualifica lead e dispara mensagem WhatsApp via Z-API
- `/crm` — CRM interno (auth Supabase magic link), chat em tempo real (Realtime Postgres)
- `/api/zapi/webhook` — recebe mensagens do WhatsApp via Z-API
- `/api/zapi/send` — envia mensagem (consumido pelo CRM)
- `/api/quiz/submit` — recebe submissão do quiz, cria lead, envia WhatsApp

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + Realtime)
- Z-API (WhatsApp)
- Deploy: Vercel
- DNS: Cloudflare → `clinicasakura.org`

## Setup local

```bash
npm install
cp .env.example .env.local
# preencher .env.local com chaves do 1Password (vault Juliana)
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Ver `.env.example`. Valores ficam no Vercel env (prod/preview) e em `.env.local` (dev).

## Schema Supabase

Ver migrations em `supabase/migrations/` (a criar).

## Deploy

Push em `main` → Vercel auto-deploy.

## Doc canônico de infra

`~/Projetos/2-Areas/empresas/dd-mm/clientes/juliana/infra.md`
