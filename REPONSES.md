# Études de cas — Groupe : ThomasKGroupe

## Cas 1

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| Verbes dans les URLs, méthodes HTTP incohérentes, delete via query sur un GET. | **Sécurité** : un GET avec `delete=true` peut supprimer des notes via prefetch, cache ou lien partagé. | REST + sémantique HTTP (GET sans effet de bord). |

**Notre correction :**

```http
GET    /students
DELETE /students/4
GET    /notes
PATCH  /notes/{id}
GET    /students/4/notes
```

Danger de la dernière ligne : mutation sur un GET.

---

## Cas 2

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| `200 OK` alors que la réservation a échoué (`ok: false`). | **Prix** : le client croit avoir la place → litiges, remboursements (ex. 2 % sur 200 places = ~4 litiges/séance). | Codes HTTP honnêtes + erreurs lisibles. |

**Notre correction :**

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{ "error": { "code": "SEAT_ALREADY_BOOKED", "message": "La place F7 est déjà réservée." } }
```

`E42` : code interne opaque. Seul le back le connaît, pas le front ni le support.

---

## Cas 3

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| `SELECT *` charge 80 000 produits pour n’en afficher que 12. | **Scalabilité** : 80 000 lignes lues/sérialisées à chaque visite → home à 9 s, base saturée pour tous. | Pagination (côté base). |

**Notre correction :**

```http
GET /v1/products?limit=12&offset=0
```

```json
{ "data": [/* 12 produits */], "pagination": { "limit": 12, "offset": 0, "total": 80000 } }
```

Si demande de 500 000 : plafonner (ex. max 100) ou refuser en 400. Jamais tout renvoyer.

---

## Cas 4

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| Pas d’idempotence : un retry recrée le don et redébite. | **Prix** : Léa débitée 3 × 20 € = 60 € pour un don de 20 €. | Idempotence. |

**Notre correction :**

1. Appli : génère une clé, la renvoie à chaque retry.
2. Serveur 1er envoi : crée + débite une fois, répond 201.
3. Serveur 2e envoi (même clé) : même réponse, pas de nouveau débit.

Si `debiter` échoue après `insert` : don en base sans paiement → incohérent. Enregistrer pending puis confirmer après débit (ou l’inverse avec compensation).

---

## Cas 5

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| L’API renvoie téléphone, adresse, IBAN, hash, permis alors que l’écran n’a besoin que du prénom et de la note. | **Sécurité** : fuite IBAN/adresse/hash → usurpation, amende RGPD. | Moindre exposition. |

| Visible par tous | Réservé au conducteur | Ne sort jamais |
|------------------|----------------------|----------------|
| `id`, `firstName`, `rating` | `phone`, `homeAddress`, `iban`, `licenseNumber` | `passwordHash` |

« Le front ne les affiche pas » : le front n’est pas une sécurité — n’importe qui appelle l’API directement.

---

## Cas 6

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| API ouverte, sans limite, chaque hit appelle un fournisseur à 0,002 €. | **Prix** : facture × 40 (ex. 2 000 € → 80 000 €). | Rate limiting (+ cache). |

**Mise en place :** compteur par clé d’API, ex. 60 req/min ; au-delà `429` + `Retry-After`. Contrôle avant l’appel fournisseur.

Limite par IP seule : 800 étudiants derrière 1 IP → tous bloqués ensemble.

Météo stable → cache (TTL 5–15 min) en plus du rate limit.

---

## Cas 7

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| Changements cassants poussés en v1 alors que 200 000 applis sont installées. | **Prix** : 4 000 appels support, applis cassées. | Compatibilité / versioning. |

| Changement | Cassant ? |
|------------|-----------|
| Ajout `currency` | Non |
| `balance` → `availableBalance` | Oui |
| Suppression `iban` | Oui |
| `reason` obligatoire | Oui |
| Ajout GET `.../cards` | Non |

**Plan :** v1 = ajouts non cassants (`currency`, route cards, garder `balance` + ajouter `availableBalance`). v2 = renommages, suppressions, champs obligatoires. v1 dépréciée puis éteinte.

Ligne 2 sans casser : renvoyer les deux champs, déprécier `balance`, le retirer en v2.

---

## Cas 8

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| Accord oral vague, pas de contrat écrit. | **Prix** : « 2490 € » et dates invalides sur tous les écrans. | Contrat d’API avant le code. |

**Document du 1er jour :** contrat (OpenAPI/tableau) avec route, noms exacts, unités (`amount_cents`), format date (ISO-8601), erreurs, exemples.

**Malentendus :**

1. `price` vs `amount_cents`
2. euros vs centimes
3. `date` vs `created`
4. string vs timestamp → Invalid Date
5. changement annoncé à Karim, pas à Sarah

---

## Cas 9

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| Le test ne vérifie que le status 200, pas le montant. | **Prix** : 50 € → 40,50 € au lieu de 45 € (−4,50 €/commande). | Asserts métier, pas seulement le status. |

**Test :**

```js
test('remise 10 % une seule fois', async () => {
  const res = await api.post('/v1/carts/7/checkout', { promoCode: 'BIENVENUE10' });
  expect(res.status).toBe(200);
  expect(res.body.total_cents).toBe(4500); // pas 4050
});
```

**Autres cas :** promo invalide → 400 ; double checkout → pas de double facturation.

---

## Cas 10

| Où est le problème ? | Quel dégât ? (prix, sécurité, scalabilité) | Quel principe du cours ? |
|----------------------|---------------------------------------------|--------------------------|
| Naming, pas de 404, user complet exposé, orders non paginés, pas d’authz. | **Sécurité + scalabilité** : fuite données + liste non bornée. | Synthèse (REST, erreurs, exposition, pagination, authz). |

**Problèmes :**

1. Verbe dans l’URL → REST
2. id en query → ressources
3. Pas de version → versioning
4. User complet renvoyé → moindre exposition
5. Orders non paginés → pagination
6. User inexistant → crash 500 au lieu de 404
7. Pas d’authz → sécurité

**Si id inexistant :** `findById` → null → `user.id` plante → 500.

**Gravité :** 1) fuite + accès aux commandes d’autrui 2) 500 si id inconnu 3) pas de pagination 4) naming/version.

**Correction :**

```js
app.get('/v1/users/:userId/orders', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = Number(req.query.offset ?? 0);
  const user = await db.users.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' } });
  const orders = await db.orders.findPage({ userId: user.id, limit, offset });
  res.json({ data: orders, pagination: { limit, offset } });
});
```
