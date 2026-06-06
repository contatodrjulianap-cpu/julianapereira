#!/bin/bash
# generate-tasks.sh — FALLBACK launchd pra gerar as tarefas de lembrete de avaliação.
# Só necessário se o plano do Vercel não permitir cron sub-diário (hobby = 1x/dia).
# Bate na rota /api/cron/generate-tasks da app deployada. NÃO dispara mensagem —
# só cria a tarefa na fila do atendente (tabela tasks).
set -euo pipefail

APP="/Users/lucasdinizcordeiro/Projetos/1-Projects/julianapereira"
cd "$APP"
set -a; source .env.local; set +a

: "${APP_BASE_URL:?defina APP_BASE_URL no .env.local (ex: https://drajulianapereira.com.br)}"
: "${CRON_SECRET:?defina CRON_SECRET no .env.local}"

curl -fsS -X POST "$APP_BASE_URL/api/cron/generate-tasks" \
  -H "x-cron-secret: $CRON_SECRET" | python3 -m json.tool || true
