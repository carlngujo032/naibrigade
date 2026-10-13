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

// Set a troop's score in a hand-scored game to an exact number (fixing a wrong entry).
// Recorded as one adjustment in the points feed, so it shows up in the history and can be undone.
setupAdminRouter.put('/games/:id/scores/:troopId', async (req, res) => {
  const id = idParam(req.params.id, 'game');
  const troopId = idParam(req.params.troopId, 'troop');
  const target = Number(req.body?.score);
  if (!Number.isInteger(target) || target < 0 || target > 5000) throw new HttpError(400, 'Score must be a whole number from 0 to 5000.');

  await withTransaction(async (db) => {
    const game = await db.query('SELECT 1 FROM categories WHERE category_id = $1', [id]);
    if (!game.rowCount) throw new HttpError(404, 'Game not found.');
    const judged = await db.query('SELECT 1 FROM events WHERE category_id = $1', [id]);
    if (judged.rowCount) throw new HttpError(409, JUDGED);
    const troop = await db.query('SELECT 1 FROM troops WHERE troop_id = $1 FOR UPDATE', [troopId]);
    if (!troop.rowCount) throw new HttpError(404, 'Troop not found.');

    const cur = await db.query('SELECT score FROM scores WHERE troop_id = $1 AND category_id = $2 FOR UPDATE', [troopId, id]);
    const current = cur.rowCount ? cur.rows[0].score : 0;
    const delta = target - current;
    if (delta === 0) return;

    await db.query(
      `INSERT INTO scores (troop_id, category_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (troop_id, category_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [troopId, id, target],
    );
    await db.query(
      "INSERT INTO point_log (troop_id, kind, category_id, points, note) VALUES ($1, 'game', $2, $3, $4)",
      [troopId, id, delta, `Score corrected (was ${current})`],
    );
  });
  res.json({ ok: true });
});

// ---- Placement points (what 1st, 2nd, 3rd... place earn). Replaces the whole list at once.
setupAdminRouter.put('/placement', async (req, res) => {
  const list = req.body?.points;
  if (!Array.isArray(list) || list.length < 1 || list.length > 20) throw new HttpError(400, 'Keep between 1 and 20 places.');
  const points = list.map(Number);
  if (points.some((n) => !Number.isInteger(n) || n < 0 || n > 5000)) throw new HttpError(400, 'Each place needs a whole number of points from 0 to 5000.');
  try {
    await withTransaction(async (db) => {
      await db.query('DELETE FROM placement_points');
      for (const [i, p] of points.entries()) await db.query('INSERT INTO placement_points (place, points) VALUES ($1, $2)', [i + 1, p]);
    });
  } catch (err) {
    if (err.code === '42P01') throw new HttpError(409, 'The placement table has not been created yet. Run the database update first.');
    throw err;
  }
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
