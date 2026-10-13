import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { api, setToken } from '../../lib/api.js';

export default function LoginForm({ onSignedIn, notice = '' }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(notice);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.login(password);
      setToken(token);
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
      <form onSubmit={submit} className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-pine-900/10">
        <div className="flex size-12 items-center justify-center rounded-full bg-pine-900 text-white">
          <Lock className="size-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-pine-900">Organizer sign in</h1>
        <p className="mt-1 text-muted">Enter the organizer password to add or undo points.</p>

        <label htmlFor="password" className="mt-6 block text-sm font-semibold">Password</label>
        <div className="relative mt-1.5">
          <input
            id="password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
            className="w-full rounded-xl border-2 border-pine-900/20 px-4 py-3 pr-12 text-lg focus:border-pine-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 px-4 text-muted hover:text-ink"
          >
            {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>

        {error && <p role="alert" className="mt-3 text-sm font-medium text-demerit">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 w-full rounded-full bg-pine-900 px-6 py-3.5 text-lg font-semibold text-white hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
