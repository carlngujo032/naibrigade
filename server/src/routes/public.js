import { Router } from 'express';
import { getActivity, getLeaderboard } from '../leaderboard.js';
import { getGuide } from '../guide.js';

export const publicRouter = Router();

publicRouter.get('/leaderboard', async (_req, res) => {
  res.json(await getLeaderboard());
});

publicRouter.get('/activity', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  res.json({ activity: await getActivity(limit) });
});

publicRouter.get('/rules', async (_req, res) => {
  res.json(await getGuide());
});
