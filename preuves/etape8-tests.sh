#!/usr/bin/env bash
# Génère preuves étape 8 : tests verts + 1 test rouge après sabotage (pagination)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ORDERS="$ROOT/src/routes/orders.js"
BACKUP="$ROOT/preuves/.orders.js.bak"

restore_orders() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$ORDERS"
  fi
}
trap restore_orders EXIT

echo "=== Tests verts ===" | tee preuves/etape8-tests-verts.txt
set +e
npm test 2>&1 | tee -a preuves/etape8-tests-verts.txt
VERT=$?
set -e
if [ "$VERT" -ne 0 ]; then
  echo "ERREUR : les tests ne sont pas tous verts (code $VERT)" >&2
  exit "$VERT"
fi

cp "$ORDERS" "$BACKUP"
# Sabotage : plus de plafond à 100 → le test « liste plafonnée » doit échouer
sed -i '' 's/const MAX_LIMIT = 100;/const MAX_LIMIT = 1000000;/' "$ORDERS"

echo "" | tee -a preuves/etape8-test-sabotage-rouge.txt
echo "=== Sabotage MAX_LIMIT=1000000 — test pagination attendu ROUGE ===" | tee -a preuves/etape8-test-sabotage-rouge.txt
npm test -- -t "liste plafonnée" 2>&1 | tee -a preuves/etape8-test-sabotage-rouge.txt || true

restore_orders
trap - EXIT
echo "Fichiers : preuves/etape8-tests-verts.txt et preuves/etape8-test-sabotage-rouge.txt"