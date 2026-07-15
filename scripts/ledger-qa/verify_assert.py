"""Assert Ledger-QA public-hook response contract. Reads JSON on stdin.

Strict mode: when env MUST_SHIP contains this country, warns are treated
as failures (Chamber 01 v2 acceptance = every row must be pass, not just
non-fail). Set MUST_SHIP=LCA,BRB for the canonical shippable roster.
"""
import json, os, sys

r = json.load(sys.stdin)
assert r.get("ok") is True, r
vs = r["verdicts"]
assert len(vs) == 12, f"expected 12 verdicts, got {len(vs)}"
required = {"key", "status", "detail", "ms"}
for v in vs:
    assert required.issubset(v.keys()), f"missing keys on {v}"
    assert v["status"] in ("pass", "warn", "fail", "skipped"), v

s = r["summary"]
cc = r.get("country", "")
must_ship = {c.strip().upper() for c in (os.environ.get("MUST_SHIP") or "").split(",") if c.strip()}
strict = cc.upper() in must_ship

print(
    f"country={cc} run={r['run_id'][:8]} "
    f"pass={s['pass']} warn={s['warn']} fail={s['fail']} "
    f"skipped={s['skipped']} wall={s['wallMs']}ms"
    + (" [strict — must ship]" if strict else "")
)
tag = {"pass": "OK ", "warn": "WRN", "fail": "ERR", "skipped": "-- "}
for v in vs:
    print(f"  {tag[v['status']]} {v['key']:14s} {v['ms']:5d}ms  {v['detail']}")

# In strict mode, a warn on a must-ship country blocks acceptance.
bad = s["fail"] + (s["warn"] if strict else 0)
sys.exit(1 if bad > 0 else 0)

