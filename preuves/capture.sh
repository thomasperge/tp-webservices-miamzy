#!/usr/bin/env bash
# Preuves TP Miamzy — lancer l'API avant : npm start
# Usage : ./preuves/capture.sh   ou   bash preuves/capture.sh

set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
DIVIDER='========================================'

hr() { echo; echo "$DIVIDER $1 $DIVIDER"; echo; }

if ! curl -sf -o /dev/null "${BASE}/v1/orders?limit=1"; then
  echo "Erreur : l'API ne répond pas sur ${BASE}"
  echo "Lance : npm start"
  exit 1
fi

hr "ÉTAPE 1 — GET liste commandes"
curl -s "${BASE}/v1/orders?limit=5" | python3 -m json.tool

hr "ÉTAPE 1 — GET une commande"
curl -s "${BASE}/v1/orders/1" | python3 -m json.tool

hr "ÉTAPE 1 — GET profil utilisateur"
curl -s "${BASE}/v1/users/1" | python3 -m json.tool

hr "ÉTAPE 1 — POST créer commande (201)"
CREATE=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/v1/restaurants/1/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"items":[{"name":"Burger","unit_price_cents":1200,"quantity":1}]}')
BODY=$(echo "$CREATE" | sed '$d')
CODE=$(echo "$CREATE" | tail -n 1)
echo "HTTP $CODE"
echo "$BODY" | python3 -m json.tool
ORDER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

hr "ÉTAPE 1 — POST payer commande"
KEY="demo-$(uuidgen 2>/dev/null || echo '11111111-1111-4111-8111-111111111111')"
PAY_RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/v1/orders/${ORDER_ID}/payments" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ${KEY}" \
  -d '{}')
PAY_BODY=$(echo "$PAY_RESP" | sed '$d')
PAY_CODE=$(echo "$PAY_RESP" | tail -n 1)
echo "HTTP $PAY_CODE"
echo "$PAY_BODY" | python3 -m json.tool

hr "ÉTAPE 2 — Trois erreurs (même forme error.code / error.message)"

echo "--- 404 ORDER_NOT_FOUND ---"
curl -s "${BASE}/v1/orders/99999999" | python3 -m json.tool

echo "--- 422 EMPTY_CART ---"
curl -s -X POST "${BASE}/v1/restaurants/1/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"items":[]}' | python3 -m json.tool

echo "--- 400 INVALID_JSON ---"
curl -s -X POST "${BASE}/v1/restaurants/1/orders" \
  -H "Content-Type: application/json" \
  -d '{bad' | python3 -m json.tool

hr "ÉTAPE 3 — limit=100000 (max 100 éléments)"
curl -s "${BASE}/v1/orders?limit=100000" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('len(data)=', len(d['data']))
print('pagination.limit=', d['pagination']['limit'])
print('pagination.total=', d['pagination']['total'])
"

hr "ÉTAPE 4 — Idempotence : 3 paiements, même clé"
PAY_ORDER=$(curl -s -X POST "${BASE}/v1/restaurants/2/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":2,"items":[{"name":"Menu","unit_price_cents":1000,"quantity":1}]}')
PAY_ID=$(echo "$PAY_ORDER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
IDEM_KEY="preuve-idempotence-00000001"
for i in 1 2 3; do
  echo "--- envoi $i ---"
  curl -s -X POST "${BASE}/v1/orders/${PAY_ID}/payments" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: ${IDEM_KEY}" \
    -d '{}' | python3 -m json.tool
done
echo "Lignes payments pour commande $PAY_ID :"
sqlite3 data/miamzy.sqlite "SELECT COUNT(*) FROM payments WHERE order_id=$PAY_ID;" 2>/dev/null || true

hr "ÉTAPE 5 — Profil (pas email / phone / password_hash)"
curl -s "${BASE}/v1/users/1" | python3 -m json.tool
echo "Champs sensibles en base (à montrer à côté) :"
sqlite3 data/miamzy.sqlite "SELECT id, display_name, email, phone, substr(password_hash,1,20) FROM users WHERE id=1;" 2>/dev/null || \
  echo "  sqlite3 data/miamzy.sqlite — si absent, ouvrir la base avec un client SQLite"

hr "ÉTAPE 7 — Commande sans promo vs BIENVENUE10"
echo "--- sans promo ---"
curl -s -X POST "${BASE}/v1/restaurants/1/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"items":[{"name":"Burger","unit_price_cents":1000,"quantity":1}]}' \
  | python3 -c "import sys,json; o=json.load(sys.stdin); print('total_cents', o['total_cents'], 'discount', o['discount_cents'])"

echo "--- avec promo ---"
curl -s -X POST "${BASE}/v1/restaurants/1/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"items":[{"name":"Burger","unit_price_cents":1000,"quantity":1}],"promo_code":"BIENVENUE10"}' \
  | python3 -c "import sys,json; o=json.load(sys.stdin); print('total_cents', o['total_cents'], 'discount', o['discount_cents'], 'promo', o['promo_code'])"

hr "ÉTAPE 6 — Rate limit (200 requêtes rapides sur GET /v1/users/1)"
OK=0
TOO=0
for i in $(seq 1 200); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/v1/users/1")
  if [ "$CODE" = "200" ]; then OK=$((OK+1)); else TOO=$((TOO+1)); fi
done
echo "200 = $OK | 429 = $TOO"
echo "Exemple réponse 429 :"
for i in $(seq 1 150); do curl -s -o /dev/null -w "%{http_code}" "${BASE}/v1/users/2" > /dev/null; done
curl -si "${BASE}/v1/users/2" | head -n 20

hr "ÉTAPE 8 — Tests automatiques"
echo "Dans un autre terminal : npm test"
echo "Capture terminal vert ; puis sabotage volontaire d'une protection et re-tester."

hr "FIN — Fais des captures d'écran de chaque section ci-dessus"