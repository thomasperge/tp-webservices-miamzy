import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.MIAMZY_DB_PATH || join(__dirname, '../../data/miamzy.sqlite');

let db;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    display_name: row.display_name,
    created_at: row.created_at,
  };
}

export function toPublicOrder(row) {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    user_id: row.user_id,
    status: row.status,
    total_cents: row.total_cents,
    discount_cents: row.discount_cents,
    promo_code: row.promo_code,
    created_at: row.created_at,
  };
}

export function getOrderWithItems(orderId) {
  const database = getDb();
  const order = database.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = database
    .prepare('SELECT name, unit_price_cents, quantity FROM order_items WHERE order_id = ?')
    .all(orderId);
  return { ...toPublicOrder(order), items };
}

export function computeSubtotalCents(items) {
  return items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);
}

export function applyPromo(subtotalCents, promoCode) {
  if (!promoCode) {
    return { total_cents: subtotalCents, discount_cents: 0, promo_code: null };
  }
  const row = getDb().prepare('SELECT percent_off FROM promo_codes WHERE code = ?').get(promoCode);
  if (!row) {
    return { error: 'PROMO_INVALID' };
  }
  const percent = row.percent_off;
  const discount_cents = Math.floor((subtotalCents * percent) / 100);
  return {
    total_cents: subtotalCents - discount_cents,
    discount_cents,
    promo_code: promoCode,
  };
}