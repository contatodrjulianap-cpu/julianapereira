#!/usr/bin/env python3
"""
daily-rollup.py — camada de NÚMEROS do insight diário da Sakura.

Determinístico: puxa o funil do Supabase e cospe JSON. NÃO escreve narrativa
(isso é trabalho do agente Claude agendado, que lê este JSON + o diário e julga).
NÃO escreve no banco — só calcula e imprime. O agente decide e dá o upsert.

Uso:
    python3 scripts/daily-rollup.py            # rollup de ontem (D-1, BRT)
    python3 scripts/daily-rollup.py 2026-05-30 # rollup de um dia específico

Env (de .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import os, sys, json, urllib.request, urllib.parse, collections
from datetime import datetime, timezone, timedelta

BRT = timezone(timedelta(hours=-3))
ACTIVE = {"new", "contacted", "proposal", "qualified"}

BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def q(path):
    req = urllib.request.Request(
        f"{BASE}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    )
    return json.load(urllib.request.urlopen(req))


def fonte(l):
    return l.get("source") or l.get("utm_source") or "desconhecida"


# --- Utmify: gasto Meta do dia da CLÍNICA, via HTTP direto (sem MCP, funciona no cron) ---
UTMIFY_TOKEN = os.environ.get("UTMIFY_TOKEN", "")
UTMIFY_DASH = "69fccc9c3a7450559dec0f97"          # dashboard "Clinica Sakura - Ju"
UTMIFY_ACCTS = ["402752221617566"]                # CA2 - Dra Juliana (Impulsionar)
_UA = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
_RES = "gs,gm,gg,gk,gt,gu,gwe,ga,gp,gwa,gr,gtf,gpc,gcs"


def utmify_spend(dia):
    """Gasto Meta do dia em reais via Utmify HTTP. None se sem token/erro — nunca inventa."""
    if not UTMIFY_TOKEN:
        return None
    url = f"https://mcp.utmify.com.br/mcp/?token={UTMIFY_TOKEN}&resources={_RES}"
    hdr = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
           "User-Agent": _UA, "MCP-Protocol-Version": "2024-11-05"}

    def post(b):
        raw = urllib.request.urlopen(
            urllib.request.Request(url, data=json.dumps(b).encode(), headers=hdr, method="POST"),
            timeout=60).read().decode()
        if "data:" in raw:
            raw = "".join(l[5:].strip() for l in raw.splitlines() if l.startswith("data:"))
        return json.loads(raw)

    try:
        post({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "ddmm", "version": "1"}}})
        r = post({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
            "name": "get_dashboard_summary", "arguments": {
                "dashboardId": UTMIFY_DASH,
                "dateRange": {"from": f"{dia}T00:00:00-03:00", "to": f"{dia}T23:59:59-03:00"},
                "metaAdAccountIds": UTMIFY_ACCTS}}})
        cents = (json.loads(r["result"]["content"][0]["text"]).get("ads") or {}).get("spent")
        return round(cents / 100, 2) if cents is not None else None
    except Exception:
        return None


def rollup(dia: str) -> dict:
    frm = f"{dia}T00:00:00-03:00"
    nxt = (datetime.strptime(dia, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    to = f"{nxt}T00:00:00-03:00"
    F, T = urllib.parse.quote(frm), urllib.parse.quote(to)

    novos = q(f"leads?select=source,utm_source,status,assigned_owner_id"
              f"&created_at=gte.{F}&created_at=lt.{T}")
    wons_dia = q(f"leads?select=id&status=eq.won&updated_at=gte.{F}&updated_at=lt.{T}")

    now_iso = urllib.parse.quote(datetime.now(BRT).isoformat())
    parados = q(f"leads?select=assigned_owner_id,status"
                f"&status=in.({','.join(ACTIVE)})"
                f"&follow_up_at=lt.{now_iso}&follow_up_at=not.is.null")

    try:
        users = {u["id"]: (u.get("display_name") or u.get("role"))
                 for u in q("crm_users?select=id,display_name,role")}
    except Exception:
        users = {}
    nome = lambda uid: users.get(uid, (uid[:8] if uid else "sem dono"))

    por_at = collections.Counter(nome(l["assigned_owner_id"]) for l in parados)
    avancaram = sum(1 for l in novos if l["status"] != "new")

    invest = utmify_spend(dia)
    cpl = round(invest / len(novos), 2) if invest and novos else None
    cpa = round(invest / len(wons_dia), 2) if invest and wons_dia else None

    return {
        "dia": dia,
        "cliente": "sakura",
        "leads_novos": len(novos),
        "por_fonte": dict(collections.Counter(fonte(l) for l in novos)),
        "transicoes": {"novos_que_avancaram_de_new": avancaram},
        "wons": len(wons_dia),
        "parados": len(parados),
        "por_atendente": {k: {"parados": v} for k, v in por_at.items()},
        "investimento_brl": invest, "cpl_brl": cpl, "cpa_brl": cpa,
        "fontes_numericas": [
            f"Supabase leads created_at {dia}",
            "Supabase leads follow_up_at vencido (agora)",
            "crm_users (mapa atendente)",
            "Utmify HTTP (gasto Meta clínica do dia)" if invest is not None else "Utmify N/D",
        ],
    }


if __name__ == "__main__":
    dia = sys.argv[1] if len(sys.argv) > 1 else (datetime.now(BRT) - timedelta(days=1)).strftime("%Y-%m-%d")
    print(json.dumps(rollup(dia), ensure_ascii=False, indent=2))
