// Creates the tables and seed data. Run once after setting DATABASE_URL:  npm run db:init
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const sql = await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query('SELECT (SELECT count(*) FROM troops) AS troops, (SELECT count(*) FROM categories) AS games');
  console.log(`Database ready: ${rows[0].troops} troops, ${rows[0].games} games.`);
} catch (err) {
  console.error('Could not set up the database:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
