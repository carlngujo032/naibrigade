import { pool } from './db.js';
import { PLACEMENT_DEFAULT, RULES } from './rules.js';

/** Points for 1st, 2nd, 3rd... as organizers have set them. */
export async function getPlacementScale() {
  try {
    const { rows } = await pool.query('SELECT points FROM placement_points ORDER BY place');
    return rows.length ? rows.map((r) => r.points) : PLACEMENT_DEFAULT;
  } catch (err) {
    if (err.code === '42P01') return PLACEMENT_DEFAULT; // table not created yet: run `npm run db:init`
    throw err;
  }
}

/** The merit and demerit guide as organizers have set it, plus the placement points. */
export async function getGuide() {
  const placement = { scale: await getPlacementScale() };
  let rows;
  try {
    ({ rows } = await pool.query('SELECT rule_id, kind, label, points FROM rules ORDER BY sort_order, rule_id'));
  } catch (err) {
    if (err.code === '42P01') return { ...RULES, placement }; // table not created yet
    throw err;
  }
  const pick = (kind) => rows.filter((r) => r.kind === kind).map((r) => ({ id: r.rule_id, label: r.label, points: r.points }));
  return { placement, merits: pick('merit'), demerits: pick('demerit') };
}
