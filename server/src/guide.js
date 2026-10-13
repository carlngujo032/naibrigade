import { pool } from './db.js';
import { RULES } from './rules.js';

/** The merit and demerit guide as organizers have set it, plus the placement scale. */
export async function getGuide() {
  let rows;
  try {
    ({ rows } = await pool.query('SELECT rule_id, kind, label, points FROM rules ORDER BY sort_order, rule_id'));
  } catch (err) {
    if (err.code === '42P01') return RULES; // table not created yet: run `npm run db:init`
    throw err;
  }
  const pick = (kind) => rows.filter((r) => r.kind === kind).map((r) => ({ id: r.rule_id, label: r.label, points: r.points }));
  return { placement: RULES.placement, merits: pick('merit'), demerits: pick('demerit') };
}
