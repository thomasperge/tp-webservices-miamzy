import { Router } from 'express';
import {
  getDb,
  getOrderWithItems,
  toPublicOrder,
  computeSubtotalCents,
  applyPromo,
} from '../db/index.js';
import { sendError } from '../lib/errors.js';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(raw) {
  const n = raw === undefined ? DEFAULT_LIMIT : Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseOffset(raw) {
  const n = raw === undefined ? 0 : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

router.get('/', (req, res) => {
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const rows = db
    .prepare(
      `SELECT id, restaurant_id, user_id, status, total_cents, discount_cents, promo_code, created_at
       FROM orders ORDER BY id LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  const next_offset = offset + limit < total ? offset + limit : null;

  res.json({
    data: rows.map(toPublicOrder),
    pagination: {
      limit,
      offset,
      total,
      next_offset,
    },
  });
});

router.get('/:orderId', (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) {
    return sendError(res, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }
  const order = getOrderWithItems(orderId);
  if (!order) {
    return sendError(res, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }
  res.json(order);
});

export default router;

export function createOrderHandler(req, res) {
  const restaurantId = Number(req.params.restaurantId);
  const db = getDb();

  const restaurant = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(restaurantId);
  if (!restaurant) {
    return sendError(res, 404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable.');
  }

  const { user_id, items, promo_code } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return sendError(res, 422, 'EMPTY_CART', 'Le panier est vide : ajoutez au moins un article.');
  }

  if (user_id === undefined || user_id === null) {
    return sendError(res, 400, 'INVALID_BODY', 'Le champ user_id est obligatoire.');
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return sendError(res, 404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  }

  for (const item of items) {
    if (
      !item?.name ||
      !Number.isFinite(item.unit_price_cents) ||
      !Number.isFinite(item.quantity) ||
      item.quantity < 1
    ) {
      return sendError(res, 400, 'INVALID_BODY', 'Chaque article doit avoir name, unit_price_cents, quantity.');
    }
  }

  const subtotal = computeSubtotalCents(items);
  const priced = applyPromo(subtotal, promo_code ?? null);
  if (priced.error) {
    return sendError(res, 422, 'PROMO_INVALID', 'Code promo invalide.');
  }

  const insertOrder = db.prepare(
    `INSERT INTO orders (restaurant_id, user_id, status, total_cents, discount_cents, promo_code)
     VALUES (?, ?, 'pending', ?, ?, ?)`
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, name, unit_price_cents, quantity) VALUES (?, ?, ?, ?)'
  );

  const create = db.transaction(() => {
    const info = insertOrder.run(
      restaurantId,
      user_id,
      priced.total_cents,
      priced.discount_cents,
      priced.promo_code
    );
    const orderId = info.lastInsertRowid;
    for (const item of items) {
      insertItem.run(orderId, item.name, item.unit_price_cents, item.quantity);
    }
    return orderId;
  });

  const orderId = create();
  const order = getOrderWithItems(orderId);
  res.status(201).json(order);
}