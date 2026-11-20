import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closeDb } from '../src/db/index.js';
import { createApp } from '../src/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDb = join(__dirname, '../data/test-miamzy.sqlite');

process.env.MIAMZY_DB_PATH = testDb;

async function seedTest() {
  const { execSync } = await import('child_process');
  for (const suffix of ['', '-wal', '-shm']) {
    const p = testDb + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
  execSync('node src/db/seed.js', {
    env: { ...process.env, MIAMZY_DB_PATH: testDb },
    cwd: join(__dirname, '..'),
  });
}

describe('Miamzy API', () => {
  let app;

  beforeAll(async () => {
    await seedTest();
    closeDb();
    app = createApp({ rateLimitEnabled: false });
  });

  afterAll(() => {
    closeDb();
  });

  it('404 si commande inexistante', async () => {
    const res = await request(app).get('/v1/orders/99999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    expect(res.body.error.message).toBeDefined();
  });

  it('liste plafonnée à 100 même si limit=100000', async () => {
    const res = await request(app).get('/v1/orders?limit=100000');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(100);
    expect(res.body.pagination.limit).toBe(100);
  });

  it('profil sans email, téléphone ni hash', async () => {
    const res = await request(app).get('/v1/users/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 1,
      display_name: expect.any(String),
      created_at: expect.any(String),
    });
    expect(res.body.email).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
    expect(res.body.password_hash).toBeUndefined();
  });

  it('paiement idempotent : 3 envois, 1 ligne en base', async () => {
    const create = await request(app)
      .post('/v1/restaurants/1/orders')
      .send({
        user_id: 1,
        items: [{ name: 'Test', unit_price_cents: 1000, quantity: 1 }],
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id;
    const key = crypto.randomUUID();

    const r1 = await request(app)
      .post(`/v1/orders/${orderId}/payments`)
      .set('Idempotency-Key', key)
      .send({});
    const r2 = await request(app)
      .post(`/v1/orders/${orderId}/payments`)
      .set('Idempotency-Key', key)
      .send({});
    const r3 = await request(app)
      .post(`/v1/orders/${orderId}/payments`)
      .set('Idempotency-Key', key)
      .send({});

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r3.status).toBe(201);
    expect(r2.body).toEqual(r1.body);
    expect(r3.body).toEqual(r1.body);

    const detail = await request(app).get(`/v1/orders/${orderId}`);
    expect(detail.body.status).toBe('paid');
  });

  it('refuse paiement sans Idempotency-Key', async () => {
    const res = await request(app).post('/v1/orders/1/payments').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('création commande panier vide → 422', async () => {
    const res = await request(app).post('/v1/restaurants/1/orders').send({ user_id: 1, items: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMPTY_CART');
  });

  it('promo réduit le total ; sans promo inchangé', async () => {
    const base = await request(app)
      .post('/v1/restaurants/1/orders')
      .send({
        user_id: 1,
        items: [{ name: 'Burger', unit_price_cents: 1000, quantity: 1 }],
      });
    const promo = await request(app)
      .post('/v1/restaurants/1/orders')
      .send({
        user_id: 1,
        items: [{ name: 'Burger', unit_price_cents: 1000, quantity: 1 }],
        promo_code: 'BIENVENUE10',
      });
    expect(base.status).toBe(201);
    expect(promo.status).toBe(201);
    expect(base.body.total_cents).toBe(1000);
    expect(promo.body.total_cents).toBe(900);
    expect(promo.body.discount_cents).toBe(100);
  });
});