#!/usr/bin/env bash
# Fast-lane verifier for Ledger-QA. Hits the public hook and asserts contract.
# Usage: LEDGER_QA_HOOK_KEY=... ./scripts/ledger-qa/verify.sh [COUNTRY]
set -euo pipefail

CC="${1:-BRB}"
BASE="${LEDGER_QA_BASE:-http://localhost:8080}"

if [ -z "${LEDGER_QA_HOOK_KEY:-}" ]; then
  echo "LEDGER_QA_HOOK_KEY missing" >&2; exit 2
fi

RESP="$(curl -sS -H "apikey: $LEDGER_QA_HOOK_KEY" "$BASE/api/public/hooks/ledger-qa?country=$CC")"

echo "$RESP" | python3 -c '
import json, sys
r = json.load(sys.stdin)
assert r.get("ok") is True, r
vs = r["verdicts"]
assert len(vs) == 12, f"expected 12 verdicts, got {len(vs)}"
required = {"key","status","detail","ms"}
for v in vs:
    assert required.issubset(v.keys()), f"missing keys on {v}"
    assert v["status"] in ("pass","warn","fail","skipped"), v
s = r["summary"]
print(f"country={r[\"country\"]} run={r[\"run_id\"][:8]} pass={s[\"pass\"]} warn={s[\"warn\"]} fail={s[\"fail\"]} skipped={s[\"skipped\"]} wall={s[\"wallMs\"]}ms")
for v in vs:
    tag = {"pass":"OK ","warn":"WRN","fail":"ERR","skipped":"—  "}[v["status"]]
    print(f"  {tag} {v[\"key\"]:14s} {v[\"ms\"]:5d}ms · {v[\"detail\"]}")
sys.exit(1 if s["fail"] > 0 else 0)
'
