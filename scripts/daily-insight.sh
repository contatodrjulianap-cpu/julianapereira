#!/bin/bash
# daily-insight.sh — orquestrador LOCAL do "Insight do dia" da Sakura.
# Roda no M3 via launchd (ver scripts/com.ddmm.sakura-insight.plist).
#
# Fluxo: números (python determinístico) -> insight (claude -p, o cérebro) -> upsert (PostgREST).
# Tudo local: tem .env.local, o diário e a config de MCP do Claude Code.
set -euo pipefail

APP="/Users/lucasdinizcordeiro/Projetos/1-Projects/julianapereira"
DIARIO="/Users/lucasdinizcordeiro/Projetos/2-Areas/empresas/dd-mm/clientes/clinica-sakura/intel/diario-experimentos.md"
cd "$APP"
set -a; source .env.local; set +a

# 1. NÚMEROS (determinístico, nunca inventa) — D-1 por default
NUMEROS="$(python3 scripts/daily-rollup.py)"
DIA="$(echo "$NUMEROS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["dia"])')"
CONTEXTO_DIARIO="$(tail -120 "$DIARIO" 2>/dev/null || echo '(diário indisponível)')"

# 2. INSIGHT (Claude como cérebro, headless) — saída JSON estrita {narrativa, alerts, fontes}
PROMPT="Você é analista de performance da DD&MM gerando o 'insight do dia' do CRM da Clínica Sakura (high-ticket odonto, atendentes Gabi e Barbara, funil tráfego->WhatsApp).

NÚMEROS DO FUNIL (ontem, determinísticos — fonte de verdade, não recalcule):
$NUMEROS

CONTEXTO (tail do diário de experimentos — baseline e o que já está sendo trabalhado):
$CONTEXTO_DIARIO

TAREFA: escreva o insight do dia. Regras:
- narrativa: 3-5 frases. Cruze os números com o que o diário/playbook já registra (ex: gargalo da Barbara é lacuna conhecida). Diga onde está a alavanca do dia.
- alerts: lista de objetos {tipo, sev, msg} onde sev ∈ alta|media|baixa. Só o que os números sustentam.
- NUNCA invente número. investimento/CPL/CPA estão null (Utmify ainda não ligado) — não estime.
- fontes: liste o que embasou (números do Supabase + leitura do diário).

Responda APENAS com um bloco json válido, nada antes ou depois:
\`\`\`json
{\"narrativa\": \"...\", \"alerts\": [{\"tipo\":\"...\",\"sev\":\"alta\",\"msg\":\"...\"}], \"fontes\": [\"...\"]}
\`\`\`"

INSIGHT_RAW="$(claude -p "$PROMPT" --model claude-sonnet-4-6 2>/dev/null)"

# 3. MERGE números + insight e UPSERT via PostgREST
NUMEROS="$NUMEROS" INSIGHT_RAW="$INSIGHT_RAW" python3 <<'PY'
import os, sys, json, re, urllib.request
numeros = json.loads(os.environ["NUMEROS"])
raw = os.environ["INSIGHT_RAW"]
m = re.search(r'\{.*\}', raw, re.S)            # extrai o JSON do output do claude
insight = json.loads(m.group(0)) if m else {"narrativa": raw[:500], "alerts": [], "fontes": []}

row = {
    "dia": numeros["dia"], "cliente": "sakura",
    "leads_novos": numeros["leads_novos"], "por_fonte": numeros["por_fonte"],
    "transicoes": numeros["transicoes"], "wons": numeros["wons"],
    "parados": numeros["parados"], "por_atendente": numeros["por_atendente"],
    "investimento_brl": numeros.get("investimento_brl"),
    "cpl_brl": numeros.get("cpl_brl"), "cpa_brl": numeros.get("cpa_brl"),
    "narrativa": insight.get("narrativa", ""),
    "alerts": insight.get("alerts", []),
    "fontes": insight.get("fontes", []) + numeros.get("fontes_numericas", []),
    "updated_at": "now()",
}
BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"); KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
req = urllib.request.Request(
    f"{BASE}/rest/v1/daily_insights?on_conflict=cliente,dia",
    data=json.dumps([row]).encode(), method="POST",
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
             "Prefer": "resolution=merge-duplicates,return=representation"})
r = json.load(urllib.request.urlopen(req))[0]
print(f"[{r['dia']}] salvo · {row['leads_novos']} leads · {row['parados']} parados · "
      f"{len(row['alerts'])} alerts · narrativa: {row['narrativa'][:90]}...")
PY
