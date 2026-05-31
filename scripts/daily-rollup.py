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

    return {
        "dia": dia,
        "cliente": "sakura",
        "leads_novos": len(novos),
        "por_fonte": dict(collections.Counter(fonte(l) for l in novos)),
        "transicoes": {"novos_que_avancaram_de_new": avancaram},
        "wons": len(wons_dia),
        "parados": len(parados),
        "por_atendente": {k: {"parados": v} for k, v in por_at.items()},
        # ads ficam null até o Utmify MCP da Ju ser ligado (v2)
        "investimento_brl": None, "cpl_brl": None, "cpa_brl": None,
        "fontes_numericas": [
            f"Supabase leads created_at {dia}",
            "Supabase leads follow_up_at vencido (agora)",
            "crm_users (mapa atendente)",
        ],
    }


if __name__ == "__main__":
    dia = sys.argv[1] if len(sys.argv) > 1 else (datetime.now(BRT) - timedelta(days=1)).strftime("%Y-%m-%d")
    print(json.dumps(rollup(dia), ensure_ascii=False, indent=2))
