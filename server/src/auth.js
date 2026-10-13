import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { HttpError } from './db.js';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

/** Compare two strings without leaking length/timing information. */
export function passwordMatches(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== 'string') return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export const signToken = (payload = { role: 'admin' }) => jwt.sign(payload, secret(), { expiresIn: '12h' });

function requireRole(role) {
  return (req, _res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next(new HttpError(401, 'Please sign in.'));
    try {
      const payload = jwt.verify(token, secret());
      if (payload.role !== role) return next(new HttpError(403, 'This account cannot do that.'));
      req.auth = payload;
      next();
    } catch {
      next(new HttpError(401, 'Your session expired. Please sign in again.'));
    }
  };
}

export const requireAdmin = requireRole('admin');
export const requireJudge = requireRole('judge');

// ---- Judge codes: random, easy to read out loud (no 0/O/1/I), stored only as a keyed hash.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJudgeCode() {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function hashJudgeCode(code) {
  const normalized = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHmac('sha256', secret()).update(normalized).digest('hex');
}
