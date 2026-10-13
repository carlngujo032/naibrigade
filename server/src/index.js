import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { judgeRouter } from './routes/judge.js';

for (const name of ['DATABASE_URL', 'ADMIN_PASSWORD', 'JWT_SECRET']) {
  if (!process.env[name]) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for rate limiting by IP
app.use(helmet());

// CLIENT_ORIGIN may hold several origins, and "*" wildcards (e.g. Vercel preview URLs).
const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean)
  .map((o) => new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*')}$`));

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.some((re) => re.test(origin))),
  }),
);
app.use(express.json({ limit: '10kb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/api/judge', judgeRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Brigade API listening on port ${port}`));
