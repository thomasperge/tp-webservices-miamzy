#!/usr/bin/env bash
# Preuve POST paiement seule (si rate limit après capture.sh : redémarrer npm start)
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/preuves/etape1-paiement.txt"

CREATE=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/v1/restaurants/1/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"items":[{"name":"Burger","unit_price_cents":800,"quantity":1}]}')
C_BODY=$(echo "$CREATE" | sed '$d')
C_CODE=$(echo "$CREATE" | tail -n 1)
if [ "$C_CODE" = "429" ]; then
  echo "HTTP 429 — redémarre l'API (npm start) après le rate limit du script capture." >&2
  exit 1
fi
OID=$(echo "$C_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$OID" ]; then
  echo "Impossible de créer la commande (HTTP $C_CODE): $C_BODY" >&2
  exit 1
fi
KEY="preuve-paiement-$(date +%s)"

{
  echo "Commande créée id=$OID"
  echo "--- POST /v1/orders/$OID/payments ---"
  curl -si -X POST "${BASE}/v1/orders/${OID}/payments" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: ${KEY}" \
    -d '{}'
} | tee "$OUT"
echo "Enregistré dans $OUT"