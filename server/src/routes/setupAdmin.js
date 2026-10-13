import { Router } from 'express';
import { HttpError, pool, withTransaction } from '../db.js';

// Mounted under /api/admin, after requireAdmin. Organizers add, rename and remove games,
// and edit the merit and demerit guide.
export const setupAdminRouter = Router();

const idParam = (value, what) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, `Invalid ${what}.`);
  return id;
};
const cleanText = (value, what, max) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new HttpError(400, `${what} must be 1 to ${max} characters.`);
  return text;
};
const cleanPoints = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new HttpError(400, 'Points must be a whole number from 1 to 1000.');
  return n;
};

// ---- Games (scored by hand). Judged games live on the Judging page.
const JUDGED = 'This game is scored by judges. Manage it on the Judging page.';

setupAdminRouter.post('/games', async (req, res) => {
  const name = cleanText(req.body?.name, 'Game name', 100);
  const dupe = await pool.query('SELECT 1 FROM categories WHERE lower(category_name) = lower($1)', [name]);
  if (dupe.rowCount) throw new HttpError(409, 'A game with that name already exists.');
  const { rows } = await pool.query('INSERT INTO categories (category_name) VALUES ($1) RETURNING category_id', [name]);
  res.status(201).json({ id: rows[0].category_id, name });
});

setupAdminRouter.put('/games/:id', async (req, res) => {
  const id = idParam(req.params.id, 'game');
  const name = cleanText(req.body?.name, 'Game name', 100);
  const found = await pool.query('SELECT 1 FROM categories WHERE category_id = $1', [id]);
  if (!found.rowCount) throw new HttpError(404, 'Game not found.');
  const judged = await pool.query('SELECT 1 FROM events WHERE category_id = $1', [id]);
  if (judged.rowCount) throw new HttpError(409, JUDGED);
  const dupe = await pool.query('SELECT 1 FROM categories WHERE lower(category_name) = lower($1) AND category_id <> $2', [name, id]);
  if (dupe.rowCount) throw new HttpError(409, 'A game with that name already exists.');
  await pool.query('UPDATE categories SET category_name = $1 WHERE category_id = $2', [name, id]);
  res.json({ ok: true });
});

// Removing a game also removes every troop's score for it and its entries in the recent-points feed.
setupAdminRouter.delete('/games/:id', async (req, res) => {
  const id = idParam(req.params.id, 'game');
  await withTransaction(async (db) => {
    const found = await db.query('SELECT 1 FROM categories WHERE category_id = $1 FOR UPDATE', [id]);
    if (!found.rowCount) throw new HttpError(404, 'Game not found.');
    const judged = await db.query('SELECT 1 FROM events WHERE category_id = $1', [id]);
    if (judged.rowCount) throw new HttpError(409, JUDGED);
    await db.query('DELETE FROM point_log WHERE category_id = $1', [id]);
    await db.query('DELETE FROM categories WHERE category_id = $1', [id]);
  });
  res.json({ ok: true });
});

// ---- Merit and demerit guide
const KINDS = ['merit', 'demerit'];

setupAdminRouter.post('/rules', async (req, res) => {
  const kind = req.body?.kind;
  if (!KINDS.includes(kind)) throw new HttpError(400, 'Choose merit or demerit.');
  const label = cleanText(req.body?.label, 'Name', 80);
  const points = cleanPoints(req.body?.points);
  const dupe = await pool.query('SELECT 1 FROM rules WHERE kind = $1 AND lower(label) = lower($2)', [kind, label]);
  if (dupe.rowCount) throw new HttpError(409, `That ${kind} is already in the guide.`);
  const last = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM rules WHERE kind = $1', [kind]);
  const { rows } = await pool.query(
    'INSERT INTO rules (kind, label, points, sort_order) VALUES ($1, $2, $3, $4) RETURNING rule_id',
    [kind, label, points, Number(last.rows[0].n) + 1],
  );
  res.status(201).json({ id: rows[0].rule_id });
});

setupAdminRouter.put('/rules/:id', async (req, res) => {
  const id = idParam(req.params.id, 'rule');
  const label = cleanText(req.body?.label, 'Name', 80);
  const points = cleanPoints(req.body?.points);
  const found = await pool.query('SELECT kind FROM rules WHERE rule_id = $1', [id]);
  if (!found.rowCount) throw new HttpError(404, 'That entry no longer exists. Refresh the page.');
  const dupe = await pool.query('SELECT 1 FROM rules WHERE kind = $1 AND lower(label) = lower($2) AND rule_id <> $3', [found.rows[0].kind, label, id]);
  if (dupe.rowCount) throw new HttpError(409, `That ${found.rows[0].kind} is already in the guide.`);
  await pool.query('UPDATE rules SET label = $1, points = $2 WHERE rule_id = $3', [label, points, id]);
  res.json({ ok: true });
});

setupAdminRouter.delete('/rules/:id', async (req, res) => {
  const id = idParam(req.params.id, 'rule');
  const { rowCount } = await pool.query('DELETE FROM rules WHERE rule_id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'That entry was already removed.');
  res.json({ ok: true });
});
