#!/usr/bin/env bash
# Fast-lane verifier for Ledger-QA. Hits the public hook and asserts contract.
# Usage: LEDGER_QA_HOOK_KEY=... ./scripts/ledger-qa/verify.sh [COUNTRY]
set -euo pipefail

CC="${1:-BRB}"
BASE="${LEDGER_QA_BASE:-http://localhost:8080}"

if [ -z "${LEDGER_QA_HOOK_KEY:-}" ]; then
  echo "LEDGER_QA_HOOK_KEY missing" >&2; exit 2
fi

curl -sS -H "apikey: $LEDGER_QA_HOOK_KEY" "$BASE/api/public/hooks/ledger-qa?country=$CC" \
  | python3 "$(dirname "$0")/verify_assert.py"
