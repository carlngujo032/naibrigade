// Empty in development (Vite proxies /api). On Vercel it is your Render URL.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'brigade_admin_token';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const JUDGE_KEY = 'brigade_judge_token';
export const getJudgeToken = () => {
  try { return localStorage.getItem(JUDGE_KEY); } catch { return null; }
};
export const setJudgeToken = (token) => {
  try { localStorage.setItem(JUDGE_KEY, token); } catch { /* storage unavailable */ }
};
export const clearJudgeToken = () => {
  try { localStorage.removeItem(JUDGE_KEY); } catch { /* storage unavailable */ }
};

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
};

async function request(path, { method = 'GET', body, auth = false, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${(auth === 'judge' ? getJudgeToken() : getToken()) ?? ''}`;

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong. Try again.');
  return data;
}

export const api = {
  leaderboard: (signal) => request('/leaderboard', { signal }),
  activity: (limit = 8, signal) => request(`/activity?limit=${limit}`, { signal }),
  rules: () => request('/rules'),

  login: (password) => request('/admin/login', { method: 'POST', body: { password } }),
  adminLog: (signal) => request('/admin/log', { auth: true, signal }),
  addPoints: (entry) => request('/admin/points', { method: 'POST', body: entry, auth: true }),
  undo: (id) => request(`/admin/log/${id}`, { method: 'DELETE', auth: true }),

  // Organizer: judging
  judging: (signal) => request('/admin/judging', { auth: true, signal }),
  createJudge: (name) => request('/admin/judges', { method: 'POST', body: { name }, auth: true }),
  resetJudgeCode: (id) => request(`/admin/judges/${id}/reset-code`, { method: 'POST', auth: true }),
  deleteJudge: (id) => request(`/admin/judges/${id}`, { method: 'DELETE', auth: true }),
  createEvent: (event) => request('/admin/events', { method: 'POST', body: event, auth: true }),
  updateEvent: (id, event) => request(`/admin/events/${id}`, { method: 'PUT', body: event, auth: true }),
  setEventStatus: (id, status) => request(`/admin/events/${id}/status`, { method: 'POST', body: { status }, auth: true }),
  setEventJudges: (id, judgeIds) => request(`/admin/events/${id}/judges`, { method: 'PUT', body: { judgeIds }, auth: true }),
  reopenJudge: (eventId, judgeId) => request(`/admin/events/${eventId}/judges/${judgeId}/reopen`, { method: 'POST', auth: true }),
  deleteEvent: (id) => request(`/admin/events/${id}`, { method: 'DELETE', auth: true }),

  // Organizer: games and the merit/demerit guide
  createGame: (name) => request('/admin/games', { method: 'POST', body: { name }, auth: true }),
  renameGame: (id, name) => request(`/admin/games/${id}`, { method: 'PUT', body: { name }, auth: true }),
  deleteGame: (id) => request(`/admin/games/${id}`, { method: 'DELETE', auth: true }),
  createRule: (kind, label, points) => request('/admin/rules', { method: 'POST', body: { kind, label, points }, auth: true }),
  updateRule: (id, label, points) => request(`/admin/rules/${id}`, { method: 'PUT', body: { label, points }, auth: true }),
  deleteRule: (id) => request(`/admin/rules/${id}`, { method: 'DELETE', auth: true }),

  // Judge
  judgeLogin: (code) => request('/judge/login', { method: 'POST', body: { code } }),
  judgeEvents: (signal) => request('/judge/events', { auth: 'judge', signal }),
  judgeSaveScores: (eventId, troopId, scores) => request(`/judge/events/${eventId}/scores`, { method: 'PUT', body: { troopId, scores }, auth: 'judge' }),
  judgeSubmit: (eventId) => request(`/judge/events/${eventId}/submit`, { method: 'POST', auth: 'judge' }),
};
