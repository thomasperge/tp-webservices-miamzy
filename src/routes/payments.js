import { Router } from 'express';
import { getDb, getOrderWithItems } from '../db/index.js';
import { sendError } from '../lib/errors.js';

const router = Router();

router.post('/:orderId/payments', (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || String(idempotencyKey).trim() === '') {
    return sendError(
      res,
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'En-tête Idempotency-Key obligatoire pour payer.'
    );
  }

  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) {
    return sendError(res, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }

  const db = getDb();
  const existing = db
    .prepare(
      'SELECT order_id, status_code, body_json FROM idempotency_responses WHERE idempotency_key = ?'
    )
    .get(idempotencyKey);

  if (existing) {
    if (existing.order_id !== orderId) {
      return sendError(
        res,
        409,
        'IDEMPOTENCY_KEY_MISMATCH',
        'Cette clé a déjà été utilisée pour une autre commande.'
      );
    }
    const body = JSON.parse(existing.body_json);
    return res.status(existing.status_code).json(body);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return sendError(res, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }

  if (order.status === 'paid') {
    return sendError(res, 422, 'ORDER_ALREADY_PAID', 'Cette commande est déjà payée.');
  }

  const method = req.body?.method === 'card' || !req.body?.method ? 'card' : String(req.body.method);

  const processPayment = db.transaction(() => {
    db.prepare(
      'INSERT INTO payments (order_id, amount_cents, method, idempotency_key) VALUES (?, ?, ?, ?)'
    ).run(orderId, order.total_cents, method, idempotencyKey);

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', orderId);

    const payment = db
      .prepare(
        'SELECT id, order_id, amount_cents, method, created_at FROM payments WHERE idempotency_key = ?'
      )
      .get(idempotencyKey);

    const body = { payment };
    db.prepare(
      'INSERT INTO idempotency_responses (idempotency_key, order_id, status_code, body_json) VALUES (?, ?, ?, ?)'
    ).run(idempotencyKey, orderId, 201, JSON.stringify(body));

    return { status: 201, body };
  });

  try {
    const { status, body } = processPayment();
    return res.status(status).json(body);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const stored = db
        .prepare(
          'SELECT order_id, status_code, body_json FROM idempotency_responses WHERE idempotency_key = ?'
        )
        .get(idempotencyKey);
      if (stored) {
        if (stored.order_id !== orderId) {
          return sendError(
            res,
            409,
            'IDEMPOTENCY_KEY_MISMATCH',
            'Cette clé a déjà été utilisée pour une autre commande.'
          );
        }
        return res.status(stored.status_code).json(JSON.parse(stored.body_json));
      }
    }
    throw e;
  }
});

export default router;