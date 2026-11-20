# API Miamzy — ThomasKGroupe

API de livraison (TP Web services M2). Node 20, Express, SQLite.

## Installation

```bash
npm install
npm run seed
```

## Lancer l'API

```bash
npm start
```

Base URL : `http://localhost:3000`

## Tests

```bash
npm test
```

## Routes v1

| Méthode | Chemin |
|---------|--------|
| GET | `/v1/orders` |
| GET | `/v1/orders/:orderId` |
| POST | `/v1/restaurants/:restaurantId/orders` |
| POST | `/v1/orders/:orderId/payments` (header `Idempotency-Key`) |
| GET | `/v1/users/:userId` |

Contrat détaillé : [`contrat.md`](contrat.md)

## Preuves (captures Bruno/curl)

Avec l’API démarrée (`npm start`) :

```bash
chmod +x preuves/capture.sh
./preuves/capture.sh | tee preuves/sortie-capture.txt
```

Fais des captures de chaque bloc affiché (ou importe les extraits dans `preuves/`).

À ajouter dans `preuves/` :

- chaque route OK (étape 1)
- 3 erreurs même forme (étape 2)
- `limit=100000` (étape 3)
- 3 paiements idempotents (étape 4)
- profil utilisateur (étape 5)
- boucle 429 (étape 6)
- commande avec/sans promo (étape 7)
- `npm test` vert (étape 8)

## Exemple curl

```bash
curl -s "http://localhost:3000/v1/orders?limit=5"
curl -s "http://localhost:3000/v1/users/1"
```