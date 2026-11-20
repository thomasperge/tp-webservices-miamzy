# Journal de décisions — Groupe : ThomasKGroupe

**Langage et framework :** Node 20, Express  
**Base de données :** SQLite (`better-sqlite3`, fichier `data/miamzy.sqlite`)

| Étape | Ce qu'on a décidé | Pourquoi | Ce qu'on a écarté |
|-------|-------------------|----------|-------------------|
| 0 | Contrat `contrat.md`, centimes + ISO-8601, préfixe `/v1` | Lisible, versionnable, assez pour 5 routes | OpenAPI complet (plus lourd pour le délai) |
| 1 | Ressources REST, `POST .../orders` → 201 | Aligné cours + TP | Verbes dans l'URL |
| 2 | Helper unique `sendError`, format `{ error: { code, message } }` | Une seule forme, pas de 500 sur JSON invalide | Corps d'erreur différents par route |
| 3 | `limit`/`offset`, défaut 20, max 100 plafonné en SQL | Simple, requête `LIMIT/OFFSET` ne lit qu'une page | Curseur (overkill pour SQLite local) |
| 4 | Clé `Idempotency-Key` côté **client**, stockée en table 24 h | Standard paiement ; 3e retry = même réponse | Clé serveur seul (client ne peut pas rejouer proprement) |
| 5 | DTO `toPublicUser()` + projection SQL sur les commandes | Colonne ajoutée demain ne sort pas si pas dans le SELECT/DTO | `DELETE` colonnes sensibles à la volée |
| 6 | `express-rate-limit` par IP, 100 req / 15 min, avant routes | Refus sans toucher la base | Limite globale unique pour toute l'API |
| 7 | Champ optionnel `promo_code` sur POST commande, champs `discount_cents` / `promo_code` ajoutés | Non cassant pour clients sans promo | v2 obligatoire |
| 8 | 6 tests Vitest + supertest, `npm test` | Couvre idempotence, plafond, profil, 404, promo, panier vide | 20 tests (pas le temps) |

**Pagination — requête base (étape 3) :**
```sql
SELECT ... FROM orders ORDER BY id LIMIT ? OFFSET ?;
-- COUNT(*) séparé pour total
```

**3 serveurs (étape 6) :** compteur en mémoire par instance → quotas multipliés. En prod : store partagé (Redis) pour un seul compteur.