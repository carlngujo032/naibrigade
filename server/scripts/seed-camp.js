// Sets up Camping 2026: 6 continental troops, 7 scoreboard games, and the judged events with the official rubrics.
// Safe to run more than once. Run after db:init:   npm run camp:seed
import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const TROOPS = ['Africa', 'Asia', 'Australia', 'Europe', 'North America', 'South America'];
const GAMES = ['Whistle Game', 'Amazing Race', 'Trashion Show', 'Volleyball', 'Yell', 'Flag Raising', 'Games'];

// Old sample troops are renamed in place (only if the new name is not taken yet).
const LEGACY = [['Alpha', 'Africa'], ['Bravo', 'Asia'], ['Charlie', 'Australia'], ['Delta', 'Europe'], ['Echo', 'North America']];

// name = what judges see, game = the scoreboard column it feeds. Points per criterion come from Judging-Rubrics.docx.
const EVENTS = [
  {
    name: 'Flag Making', game: 'Flag Raising',
    criteria: [
      ['Creativity and Originality', 25], ['Relevance to Theme / Symbolism', 20], ['Neatness and Craftsmanship', 20],
      ['Team Effort and Participation', 15], ['Presentation and Explanation', 10], ['Overall Impact', 10],
    ],
  },
  {
    name: 'Yell', game: 'Yell',
    criteria: [
      ['Unity and Coordination', 25], ['Creativity and Originality', 20], ['Clarity and Delivery', 15],
      ['Relevance to Camp Theme', 15], ['Spirit and Enthusiasm', 15], ['Costume and Presentation', 10],
    ],
  },
  {
    name: 'Trashion Show', game: 'Trashion Show', // Mr. and Ms. Eco-Continental
    criteria: [
      ['Creativity and Originality', 30], ['Use of Recycled / Repurposed Materials', 25], ['Craftsmanship / Construction', 20],
      ['Visual Impact / Stage Presence', 15], ['Sustainability Story / Concept', 10],
    ],
  },
  {
    name: 'Whistle Game', game: 'Whistle Game', // the rubric lists "Accuracy of Formation" twice; counted once so it totals 100
    criteria: [
      ['Accuracy of Formation', 30], ['Speed and Response to Commands', 20], ['Teamwork and Coordination', 20],
      ['Discipline and Orderliness', 15], ['Execution and Overall Performance', 15],
    ],
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query('BEGIN');

  for (const [from, to] of LEGACY) {
    await client.query(
      'UPDATE troops SET troop_name = $2 WHERE troop_name = $1 AND NOT EXISTS (SELECT 1 FROM troops WHERE troop_name = $2)',
      [from, to],
    );
  }
  for (const name of TROOPS) await client.query('INSERT INTO troops (troop_name) VALUES ($1) ON CONFLICT (troop_name) DO NOTHING', [name]);
  for (const name of GAMES) await client.query('INSERT INTO categories (category_name) VALUES ($1) ON CONFLICT (category_name) DO NOTHING', [name]);
  await client.query(
    `INSERT INTO scores (troop_id, category_id)
     SELECT t.troop_id, c.category_id FROM troops t CROSS JOIN categories c
     ON CONFLICT (troop_id, category_id) DO NOTHING`,
  );

  for (const ev of EVENTS) {
    const exists = await client.query('SELECT 1 FROM events WHERE name = $1', [ev.name]);
    if (exists.rowCount) { console.log(`Skipped "${ev.name}" (already exists).`); continue; }
    const cat = await client.query('SELECT category_id FROM categories WHERE category_name = $1', [ev.game]);
    const made = await client.query('INSERT INTO events (name, category_id) VALUES ($1, $2) RETURNING event_id', [ev.name, cat.rows[0].category_id]);
    for (const [i, [name, max]] of ev.criteria.entries()) {
      await client.query('INSERT INTO event_criteria (event_id, name, max_points, sort_order) VALUES ($1, $2, $3, $4)', [made.rows[0].event_id, name, max, i]);
    }
    console.log(`Created judged event "${ev.name}" for the ${ev.game} column (${ev.criteria.reduce((s, c) => s + c[1], 0)} points).`);
  }

  await client.query('COMMIT');
  const { rows } = await client.query('SELECT (SELECT count(*) FROM troops) AS troops, (SELECT count(*) FROM categories) AS games, (SELECT count(*) FROM events) AS events');
  console.log(`Done: ${rows[0].troops} troops, ${rows[0].games} games, ${rows[0].events} judged events.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Could not seed the camp data:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
