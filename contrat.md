# Contrat API Miamzy — v1

**Groupe :** ThomasKGroupe  
**Montants :** entiers en **centimes d'euro** (`*_cents`)  
**Dates :** **ISO-8601** UTC (`created_at`, etc.)

## Erreur (toutes les routes)

```json
{ "error": { "code": "STRING", "message": "STRING" } }
```

| Code HTTP | Usage |
|-----------|--------|
| 400 | Body invalide, JSON illisible, paramètres incorrects |
| 404 | Ressource introuvable |
| 422 | Règle métier (panier vide, promo invalide) |
| 429 | Trop de requêtes (`Retry-After` en secondes) |

---

## GET /v1/orders

Liste paginée des commandes.

**Query :** `limit` (défaut 20, max 100), `offset` (défaut 0)

**200 :**
```json
{
  "data": [
    {
      "id": 1,
      "restaurant_id": 3,
      "user_id": 12,
      "status": "pending",
      "total_cents": 2490,
      "discount_cents": 0,
      "promo_code": null,
      "created_at": "2026-11-20T09:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 5000,
    "next_offset": 20
  }
}
```

---

## GET /v1/orders/:orderId

**200 :** une commande + lignes `items` (pas d'objet utilisateur complet).

**404 :** `ORDER_NOT_FOUND`

---

## POST /v1/restaurants/:restaurantId/orders

**Body :**
```json
{
  "user_id": 12,
  "items": [{ "name": "Burger", "unit_price_cents": 1200, "quantity": 2 }],
  "promo_code": "BIENVENUE10"
}
```

`promo_code` optionnel (ajout non cassant).

**201 :** commande créée (même forme que GET une commande).

**404 :** `RESTAURANT_NOT_FOUND`  
**422 :** `EMPTY_CART` — `items` vide ou absent  
**422 :** `PROMO_INVALID` — code inconnu

---

## POST /v1/orders/:orderId/payments

**Header obligatoire :** `Idempotency-Key: <uuid>`

**Body :** `{}` ou `{ "method": "card" }`

**201 :** premier paiement réussi (réponse stockée pour la clé).

**200 :** même corps que le premier succès si la clé a déjà été utilisée.

**400 :** `IDEMPOTENCY_KEY_REQUIRED`  
**404 :** `ORDER_NOT_FOUND`  
**422 :** `ORDER_ALREADY_PAID`

---

## GET /v1/users/:userId

Profil public : `id`, `display_name`, `created_at` uniquement.

**404 :** `USER_NOT_FOUND`