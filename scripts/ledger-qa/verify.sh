#!/usr/bin/env bash
# Fast-lane verifier for Ledger-QA. Hits the public hook per country and asserts contract.
# Usage: LEDGER_QA_HOOK_KEY=... ./scripts/ledger-qa/verify.sh [CC1 CC2 ...]
# Defaults to a CARICOM sweep: BRB LCA JAM GUY GB.
set -uo pipefail

BASE="${LEDGER_QA_BASE:-http://localhost:8080}"
if [ -z "${LEDGER_QA_HOOK_KEY:-}" ]; then
  echo "LEDGER_QA_HOOK_KEY missing" >&2; exit 2
fi

if [ "$#" -gt 0 ]; then
  CCS=("$@")
else
  CCS=(BRB LCA JAM GUY GBR)
fi

overall_fail=0
for CC in "${CCS[@]}"; do
  echo "── $CC ─────────────────────────────────────────────"
  http_code=$(curl -sS -o /tmp/lqa_"$CC".json -w "%{http_code}" \
    -H "apikey: $LEDGER_QA_HOOK_KEY" "$BASE/api/public/hooks/ledger-qa?country=$CC" || echo "000")
  if [ "$http_code" != "200" ]; then
    echo "  HTTP $http_code — request failed"; overall_fail=$((overall_fail+1)); continue
  fi
  if ! python3 "$(dirname "$0")/verify_assert.py" < /tmp/lqa_"$CC".json; then
    overall_fail=$((overall_fail+1))
  fi
done

echo "────────────────────────────────────────────────────"
if [ "$overall_fail" -eq 0 ]; then
  echo "OK · ${#CCS[@]} countries verified, 0 fails"
else
  echo "FAIL · $overall_fail of ${#CCS[@]} countries had fails"
  exit 1
fi
