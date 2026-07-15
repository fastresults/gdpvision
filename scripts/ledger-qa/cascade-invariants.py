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
  I5 flows       — country_capital_flows row count > 0

Usage: python3 scripts/ledger-qa/cascade-invariants.py [CC1 CC2 ...]
Defaults to BRB LCA JAM GUY GB.
"""
from __future__ import annotations
import os, sys, json, urllib.request, urllib.parse

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def rest(path: str, params: dict) -> list:
    q = urllib.parse.urlencode(params, safe="=,.*()")
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}?{q}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def check_country(cc: str) -> list[tuple[str, bool, str]]:
    out: list[tuple[str, bool, str]] = []

    # I1 sectors
    rows = rest("country_sectors", {"country_code": f"eq.{cc}", "select": "share_pct"})
    total = sum(float(r.get("share_pct") or 0) for r in rows)
    ok = len(rows) > 0 and 95.0 <= total <= 105.0
    out.append(("I1 sectors    ", ok, f"n={len(rows)} sum={total:.1f}%"))

    # I2 ministries have profiles
    mins = rest("ministries", {"country_code": f"eq.{cc}", "select": "id"})
    if not mins:
        out.append(("I2 ministries ", True, "n=0 (no ministries yet)"))
    else:
        ids = ",".join(f'"{m["id"]}"' for m in mins)
        profs = rest("ministry_profiles", {"ministry_id": f"in.({ids})", "select": "ministry_id"})
        missing = len(mins) - len({p["ministry_id"] for p in profs})
        out.append(("I2 ministries ", missing == 0, f"{len(mins)-missing}/{len(mins)} profiled"))

    # I3 kpis have latest_value
    kpis = rest("country_kpis", {"country_code": f"eq.{cc}", "latest_value": "not.is.null", "select": "id"})
    out.append(("I3 kpis latest", len(kpis) > 0, f"n={len(kpis)} with latest_value"))

    # I4 no invalid active source URLs (filter client-side; PostgREST wildcard
    # escaping is fiddly and we already have the row set from the hook)
    srcs = rest("country_sources", {"country_code": f"eq.{cc}", "active": "eq.true", "select": "url"})
    bad = [s for s in srcs if not str(s.get("url") or "").lower().startswith(("http://", "https://"))]
    out.append(("I4 sources url", len(bad) == 0, f"{len(bad)}/{len(srcs)} active non-URL rows"))

    # I5 capital flows
    flows = rest("country_capital_flows", {"country_code": f"eq.{cc}", "select": "id"})
    out.append(("I5 flows      ", len(flows) > 0, f"n={len(flows)}"))
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
