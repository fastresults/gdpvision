"""Assert Ledger-QA public-hook response contract. Reads JSON on stdin."""
import json, sys

r = json.load(sys.stdin)
assert r.get("ok") is True, r
vs = r["verdicts"]
assert len(vs) == 12, f"expected 12 verdicts, got {len(vs)}"
required = {"key", "status", "detail", "ms"}
for v in vs:
    assert required.issubset(v.keys()), f"missing keys on {v}"
    assert v["status"] in ("pass", "warn", "fail", "skipped"), v

s = r["summary"]
print(
    f"country={r['country']} run={r['run_id'][:8]} "
    f"pass={s['pass']} warn={s['warn']} fail={s['fail']} "
    f"skipped={s['skipped']} wall={s['wallMs']}ms"
)
tag = {"pass": "OK ", "warn": "WRN", "fail": "ERR", "skipped": "-- "}
for v in vs:
    print(f"  {tag[v['status']]} {v['key']:14s} {v['ms']:5d}ms  {v['detail']}")

sys.exit(1 if s["fail"] > 0 else 0)
