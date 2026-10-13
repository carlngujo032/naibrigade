import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError, withTransaction } from '../db.js';
import { passwordMatches, requireAdmin, signToken } from '../auth.js';
import { getActivity } from '../leaderboard.js';
import { judgingAdminRouter } from './judgingAdmin.js';
import { setupAdminRouter } from './setupAdmin.js';

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

adminRouter.post('/login', loginLimiter, (req, res) => {
  if (!passwordMatches(req.body?.password)) {
    throw new HttpError(401, 'Wrong password. Try again.');
  }
  res.json({ token: signToken() });
});

// Everything below needs a valid token.
adminRouter.use(requireAdmin);

adminRouter.get('/verify', (_req, res) => res.json({ ok: true }));

adminRouter.get('/log', async (_req, res) => {
  res.json({ activity: await getActivity(30) });
});

adminRouter.post('/points', async (req, res) => {
  const { troopId, kind, categoryId, points, note } = req.body ?? {};

  if (!['merit', 'demerit', 'game'].includes(kind)) throw new HttpError(400, 'Choose merit, demerit or game score.');
  if (!Number.isInteger(troopId)) throw new HttpError(400, 'Choose a troop.');
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1000) {
    throw new HttpError(400, 'Enter a whole number of points between 1 and 1000.');
  }
  if (kind !== 'game' && points < 0) {
    throw new HttpError(400, 'Merit and demerit points must be positive. Use Undo to fix a mistake.');
  }
  if (kind === 'game' && !Number.isInteger(categoryId)) throw new HttpError(400, 'Choose a game.');

  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 120) : '';

  const entry = await withTransaction(async (db) => {
    const troop = await db.query('SELECT troop_id, troop_name FROM troops WHERE troop_id = $1 FOR UPDATE', [troopId]);
    if (!troop.rowCount) throw new HttpError(404, 'Troop not found.');

    if (kind === 'merit') {
      await db.query('UPDATE troops SET merit_points = merit_points + $1 WHERE troop_id = $2', [points, troopId]);
    } else if (kind === 'demerit') {
      await db.query('UPDATE troops SET demerit_points = demerit_points + $1 WHERE troop_id = $2', [points, troopId]);
    } else {
      const category = await db.query('SELECT category_id FROM categories WHERE category_id = $1', [categoryId]);
      if (!category.rowCount) throw new HttpError(404, 'Game not found.');
      const judged = await db.query('SELECT 1 FROM events WHERE category_id = $1', [categoryId]);
      if (judged.rowCount) throw new HttpError(400, 'This game is scored by judges. Manage it on the Judging page.');
      await db.query(
        `INSERT INTO scores (troop_id, category_id, score) VALUES ($1, $2, $3)
         ON CONFLICT (troop_id, category_id)
         DO UPDATE SET score = scores.score + EXCLUDED.score, updated_at = now()`,
        [troopId, categoryId, points],
      );
    }

    const log = await db.query(
      `INSERT INTO point_log (troop_id, kind, category_id, points, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING log_id`,
      [troopId, kind, kind === 'game' ? categoryId : null, points, cleanNote || null],
    );
    return { id: log.rows[0].log_id, troopName: troop.rows[0].troop_name };
  });

  res.status(201).json({ ok: true, ...entry });
});

// Undo = reverse the change and remove the log entry.
adminRouter.delete('/log/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid entry.');

  await withTransaction(async (db) => {
    const found = await db.query('SELECT * FROM point_log WHERE log_id = $1 FOR UPDATE', [id]);
    if (!found.rowCount) throw new HttpError(404, 'That entry was already undone.');
    const { troop_id, kind, category_id, points } = found.rows[0];

    if (kind === 'merit') {
      await db.query('UPDATE troops SET merit_points = merit_points - $1 WHERE troop_id = $2', [points, troop_id]);
    } else if (kind === 'demerit') {
      await db.query('UPDATE troops SET demerit_points = demerit_points - $1 WHERE troop_id = $2', [points, troop_id]);
    } else if (category_id) {
      await db.query(
        'UPDATE scores SET score = score - $1, updated_at = now() WHERE troop_id = $2 AND category_id = $3',
        [points, troop_id, category_id],
      );
    }
    await db.query('DELETE FROM point_log WHERE log_id = $1', [id]);
  });

  res.json({ ok: true });
});

adminRouter.use(judgingAdminRouter);
adminRouter.use(setupAdminRouter);
