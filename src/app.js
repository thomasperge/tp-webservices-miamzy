import express from 'express';
import { getDb } from './db/index.js';
import { sendError } from './lib/errors.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import ordersRouter from './routes/orders.js';
import restaurantsRouter from './routes/restaurants.js';
import usersRouter from './routes/users.js';
import paymentsRouter from './routes/payments.js';

export function createApp(options = {}) {
  const { rateLimitEnabled = true } = options;

  getDb();

  const app = express();

  if (rateLimitEnabled) {
    app.use(apiRateLimiter);
  }

  app.use(
    express.json({
      strict: true,
    })
  );

  app.use('/v1/orders', ordersRouter);
  app.use('/v1/orders', paymentsRouter);
  app.use('/v1/restaurants', restaurantsRouter);
  app.use('/v1/users', usersRouter);

  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return sendError(res, 400, 'INVALID_JSON', 'Corps JSON invalide.');
    }
    return next(err);
  });

  app.use((err, req, res, next) => {
    console.error(err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Erreur interne.');
  });

  return app;
}