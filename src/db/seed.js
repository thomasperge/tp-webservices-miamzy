import { getDb, closeDb } from './index.js';
import { unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.MIAMZY_DB_PATH || join(__dirname, '../../data/miamzy.sqlite');

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}

const db = getDb();

db.exec('DELETE FROM idempotency_responses');
db.exec('DELETE FROM payments');
db.exec('DELETE FROM order_items');
db.exec('DELETE FROM orders');
db.exec('DELETE FROM users');
db.exec('DELETE FROM restaurants');
db.exec('DELETE FROM promo_codes');

db.prepare('INSERT INTO promo_codes (code, percent_off) VALUES (?, ?)').run('BIENVENUE10', 10);

const insertUser = db.prepare(
  'INSERT INTO users (display_name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
);

const users = [];
for (let i = 1; i <= 50; i++) {
  const info = insertUser.run(
    `User ${i}`,
    `user${i}@example.com`,
    `0600000${String(i).padStart(3, '0')}`,
    '$2b$10$fakehashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    new Date(Date.UTC(2025, 0, i)).toISOString()
  );
  users.push(info.lastInsertRowid);
}

const insertResto = db.prepare('INSERT INTO restaurants (name, city) VALUES (?, ?)');
const restaurantIds = [];
const cities = ['Nantes', 'Paris', 'Lyon', 'Bordeaux', 'Lille'];
for (let r = 1; r <= 20; r++) {
  const info = insertResto.run(`Restaurant Miamzy ${r}`, cities[r % cities.length]);
  restaurantIds.push(info.lastInsertRowid);
}

const insertOrder = db.prepare(
  'INSERT INTO orders (restaurant_id, user_id, status, total_cents, discount_cents, promo_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const insertItem = db.prepare(
  'INSERT INTO order_items (order_id, name, unit_price_cents, quantity) VALUES (?, ?, ?, ?)'
);

const statuses = ['pending', 'paid', 'delivered'];
for (let o = 1; o <= 5000; o++) {
  const restaurant_id = restaurantIds[(o - 1) % restaurantIds.length];
  const user_id = users[(o - 1) % users.length];
  const total = 500 + (o % 4000);
  const status = statuses[o % 3];
  const info = insertOrder.run(
    restaurant_id,
    user_id,
    status,
    total,
    0,
    null,
    new Date(Date.UTC(2026, 5, (o % 28) + 1, o % 24, o % 60)).toISOString()
  );
  insertItem.run(info.lastInsertRowid, 'Menu du jour', 500 + (o % 200), 1 + (o % 3));
}

console.log('Seed OK: 20 restaurants, 5000 commandes, 50 utilisateurs.');
closeDb();