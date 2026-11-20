import { Router } from 'express';
import { getDb, toPublicUser } from '../db/index.js';
import { sendError } from '../lib/errors.js';

const router = Router();

router.get('/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) {
    return sendError(res, 404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  }
  const row = getDb()
    .prepare('SELECT id, display_name, email, phone, password_hash, created_at FROM users WHERE id = ?')
    .get(userId);
  if (!row) {
    return sendError(res, 404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  }
  res.json(toPublicUser(row));
});

export default router;