"""Assert Ledger-QA public-hook response contract. Reads JSON on stdin.

Strict mode: when env MUST_SHIP contains this country, warns are treated
as failures (Chamber 01 v2 acceptance = every row must be pass, not just
non-fail). Set MUST_SHIP=LCA,BRB for the canonical shippable roster.
"""
import json, os, sys

r = json.load(sys.stdin)
assert r.get("ok") is True, r
vs = r["verdicts"]
assert len(vs) == 13, f"expected 13 verdicts, got {len(vs)}"
required = {"key", "status", "detail", "ms"}
for v in vs:
    assert required.issubset(v.keys()), f"missing keys on {v}"
    assert v["status"] in ("pass", "warn", "fail", "skipped"), v

# Regression: visibility-guard must always pass — private rows must be
# properly stamped (owner_country_code + uploaded_by). A warn/fail here
# means the public/private data boundary is compromised.
vg = next((v for v in vs if v["key"] == "visibility-guard"), None)
assert vg is not None, "missing visibility-guard verdict"
assert vg["status"] == "pass", f"visibility-guard must pass: {vg['detail']}"

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

