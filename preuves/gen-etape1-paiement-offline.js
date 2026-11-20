// Génère etape1-paiement.txt sans serveur (supertest)
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import request from 'supertest';
import { closeDb } from '../src/db/index.js';
import { createApp } from '../src/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDb = join(__dirname, '../data/preuve-paiement.sqlite');
for (const s of ['', '-wal', '-shm']) {
  const p = testDb + s;
  if (existsSync(p)) unlinkSync(p);
}
process.env.MIAMZY_DB_PATH = testDb;
execSync('node src/db/seed.js', { cwd: join(__dirname, '..'), env: process.env });
closeDb();

const app = createApp({ rateLimitEnabled: false });
const create = await request(app)
  .post('/v1/restaurants/1/orders')
  .send({ user_id: 1, items: [{ name: 'Burger', unit_price_cents: 800, quantity: 1 }] });
const pay = await request(app)
  .post(`/v1/orders/${create.body.id}/payments`)
  .set('Idempotency-Key', 'preuve-offline-paiement')
  .send({});

const out = [
  `POST créer commande HTTP ${create.status}`,
  JSON.stringify(create.body, null, 2),
  '',
  `POST payer commande HTTP ${pay.status}`,
  JSON.stringify(pay.body, null, 2),
].join('\n');

writeFileSync(join(__dirname, 'etape1-paiement.txt'), out);
console.log('Écrit preuves/etape1-paiement.txt');
closeDb();