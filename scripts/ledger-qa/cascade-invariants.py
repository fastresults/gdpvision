"""Layer 4 (read-only) — Cascade invariants sweep.

Asserts the invariants each cascade remediator would restore, per country,
without mutating anything. Read-only: uses SUPABASE_SERVICE_ROLE_KEY to
query the DB via PostgREST. Fails loudly on any broken invariant so we can
open a targeted remediator run instead of shipping a red dashboard.

Invariants checked per country_code:
  I1 sectors     — country_sectors row count > 0 AND sum(share_pct) within [95,105]
  I2 ministries  — every ministries row has a matching ministry_profiles row
  I3 kpis        — >=1 country_kpis row with latest_value NOT NULL
  I4 sources     — 0 rows where active=true AND url NOT LIKE 'http%'
  I5 flows       — latest country_capital_flows has >=3 inputs, >=4 outputs, residual <=10%, no unknown node keys

Usage: python3 scripts/ledger-qa/cascade-invariants.py [CC1 CC2 ...]
Defaults to BRB LCA JAM GUY GB.
"""
from __future__ import annotations
import os, sys, json, urllib.request, urllib.parse

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def rest(path: str, params: dict) -> list:
    q = urllib.parse.urlencode(params, safe="=,.*()\"")
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}?{q}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        raise RuntimeError(f"{e.code} {path}?{q} :: {body}") from None

def check_country(cc: str) -> list[tuple[str, bool, str]]:
    out: list[tuple[str, bool, str]] = []

    # I1 sectors
    rows = rest("country_sectors", {"country_code": f"eq.{cc}", "select": "share_pct"})
    total = sum(float(r.get("share_pct") or 0) for r in rows)
    ok = len(rows) > 0 and 95.0 <= total <= 105.0
    out.append(("I1 sectors    ", ok, f"n={len(rows)} sum={total:.1f}%"))

    # I2 ministries have profiles (joined on country_code + ministry_slug)
    mins = rest("ministries", {"country_code": f"eq.{cc}", "select": "slug"})
    profs = rest("ministry_profiles", {"country_code": f"eq.{cc}", "select": "ministry_slug"})
    if not mins:
        out.append(("I2 ministries ", True, "n=0 (no ministries yet)"))
    else:
        have = {p["ministry_slug"] for p in profs}
        missing = sum(1 for m in mins if m["slug"] not in have)
        out.append(("I2 ministries ", missing == 0, f"{len(mins)-missing}/{len(mins)} profiled"))

    # I3 kpis have latest_value
    kpis = rest("country_kpis", {"country_code": f"eq.{cc}", "latest_value": "not.is.null", "select": "id"})
    out.append(("I3 kpis latest", len(kpis) > 0, f"n={len(kpis)} with latest_value"))

    # I4 no invalid active source URLs (filter client-side; PostgREST wildcard
    # escaping is fiddly and we already have the row set from the hook)
    srcs = rest("country_sources", {"country_code": f"eq.{cc}", "active": "eq.true", "select": "url"})
    bad = [s for s in srcs if not str(s.get("url") or "").lower().startswith(("http://", "https://"))]
    out.append(("I4 sources url", len(bad) == 0, f"{len(bad)}/{len(srcs)} active non-URL rows"))

    # I5 capital flows — acceptance-grade Sankey coverage
    nodes = rest("capital_flow_nodes", {"select": "node_key,side"})
    side_by_key = {r["node_key"]: r["side"] for r in nodes}
    flows = rest("country_capital_flows", {"country_code": f"eq.{cc}", "select": "node_key,period,value_usd_m"})
    periods = sorted({str(f.get("period") or "") for f in flows if f.get("period")}, reverse=True)
    latest_period = periods[0] if periods else None
    latest = [f for f in flows if not latest_period or f.get("period") == latest_period]
    inputs = outputs = unknown = 0
    sum_in = sum_out = 0.0
    residual_keys = {"RECONCILIATION_RESIDUAL", "RECONCILIATION_INFLOW_RESIDUAL"}
    for f in latest:
        key = f.get("node_key")
        side = side_by_key.get(key)
        val = float(f.get("value_usd_m") or 0)
        if side == "input":
            if key not in residual_keys:
                inputs += 1
            sum_in += val
        elif side == "output":
            if key not in residual_keys:
                outputs += 1
            sum_out += val
        else:
            unknown += 1
    residual_pct = abs(sum_in - sum_out) / max(sum_in, sum_out) if max(sum_in, sum_out) > 0 else 1.0
    ok = inputs >= 3 and outputs >= 4 and residual_pct <= 0.10 and unknown == 0
    out.append(("I5 flows      ", ok, f"n={len(latest)} period={latest_period or '-'} inputs={inputs}/6 outputs={outputs}/6 residual={residual_pct*100:.1f}% unknown={unknown}"))
    return out

def main():
    ccs = [c.upper() for c in sys.argv[1:]] or ["BRB", "LCA", "JAM", "GUY", "GBR"]
    total_fail = 0
    for cc in ccs:
        print(f"── {cc} ──────────────────────────────")
        try:
            rows = check_country(cc)
        except Exception as e:
            print(f"  ERR {e}")
            total_fail += 1
            continue
        for name, ok, detail in rows:
            tag = "OK " if ok else "ERR"
            print(f"  {tag} {name}  {detail}")
            if not ok: total_fail += 1
    print("──────────────────────────────────────────")
    if total_fail:
        print(f"FAIL · {total_fail} broken invariants")
        sys.exit(1)
    print(f"OK · all invariants green across {len(ccs)} countries")

if __name__ == "__main__":
    main()
