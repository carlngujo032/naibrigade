import { pool } from './db.js';
import { placementPoints, scaleFor } from './rules.js';

/**
 * Builds the leaderboard. Total = merit - demerit + sum of game scores
 * (same formula as the old PHP version). Tied troops share a rank.
 */
export async function getLeaderboard() {
  const [troopsRes, gamesRes, categoriesRes, judgedRes, eventsRes] = await Promise.all([
    pool.query('SELECT troop_id, troop_name, merit_points, demerit_points FROM troops ORDER BY troop_id'),
    pool.query(`
      SELECT t.troop_id, c.category_id, c.category_name, COALESCE(s.score, 0) AS score
      FROM troops t
      CROSS JOIN categories c
      LEFT JOIN scores s ON s.troop_id = t.troop_id AND s.category_id = c.category_id
      ORDER BY t.troop_id, c.category_id`),
    pool.query('SELECT category_id, category_name FROM categories ORDER BY category_id'),
    // Published judged events: average of each submitted judge's total for the troop.
    pool.query(`
      SELECT e.category_id, t.troop_id, AVG(x.total) AS average
      FROM events e
      CROSS JOIN troops t
      LEFT JOIN (
        SELECT js.event_id, js.troop_id, js.judge_id, SUM(js.score) AS total
        FROM judge_scores js
        JOIN judge_submissions s ON s.event_id = js.event_id AND s.judge_id = js.judge_id
        GROUP BY js.event_id, js.troop_id, js.judge_id
      ) x ON x.event_id = e.event_id AND x.troop_id = t.troop_id
      WHERE e.status = 'published'
      GROUP BY e.category_id, t.troop_id`),
    pool.query('SELECT category_id FROM events'),
  ]);

  // Judged games: rank troops by average judge score and award placement points (200, 180, ...).
  const categoryName = new Map(categoriesRes.rows.map((c) => [c.category_id, c.category_name]));
  const judgedScore = new Map();
  for (const categoryId of new Set(judgedRes.rows.map((r) => r.category_id))) {
    const entries = judgedRes.rows
      .filter((r) => r.category_id === categoryId)
      .map((r) => ({ id: r.troop_id, average: r.average === null ? null : Number(r.average) }));
    const placed = placementPoints(entries, scaleFor(categoryName.get(categoryId)));
    for (const e of entries) judgedScore.set(`${e.id}:${categoryId}`, placed.get(e.id));
  }
  const judgedCategories = new Set(eventsRes.rows.map((r) => r.category_id));

  const troops = troopsRes.rows.map((t) => {
    const games = gamesRes.rows
      .filter((g) => g.troop_id === t.troop_id)
      .map((g) => ({
        categoryId: g.category_id,
        name: g.category_name,
        // Judged games ignore typed-in points; they only count once the organizer publishes.
        score: judgedCategories.has(g.category_id) ? judgedScore.get(`${g.troop_id}:${g.category_id}`) ?? 0 : g.score,
      }));
    const gameTotal = games.reduce((sum, g) => sum + g.score, 0);
    return {
      id: t.troop_id,
      name: t.troop_name,
      merit: t.merit_points,
      demerit: t.demerit_points,
      gameTotal,
      total: t.merit_points - t.demerit_points + gameTotal,
      games,
    };
  });

  troops.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  troops.forEach((t, i) => {
    t.rank = i > 0 && t.total === troops[i - 1].total ? troops[i - 1].rank : i + 1;
  });

  return {
    troops,
    categories: categoriesRes.rows.map((c) => ({ id: c.category_id, name: c.category_name, judged: judgedCategories.has(c.category_id) })),
    updatedAt: new Date().toISOString(),
  };
}

export async function getActivity(limit = 10) {
  const { rows } = await pool.query(
    `SELECT l.log_id, l.kind, l.points, l.note, l.created_at, l.troop_id,
            t.troop_name, c.category_name
     FROM point_log l
     JOIN troops t ON t.troop_id = l.troop_id
     LEFT JOIN categories c ON c.category_id = l.category_id
     ORDER BY l.created_at DESC, l.log_id DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.log_id,
    troopId: r.troop_id,
    troopName: r.troop_name,
    kind: r.kind,
    points: r.points,
    note: r.note,
    game: r.category_name,
    createdAt: r.created_at,
  }));
}
