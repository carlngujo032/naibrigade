import { useState } from 'react';
import { Gavel } from 'lucide-react';
import { api, setJudgeToken } from '../../lib/api.js';

export default function JudgeLogin({ onSignedIn, notice = '' }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(notice);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.judgeLogin(code);
      setJudgeToken(token);
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
          <Gavel className="size-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-pine-900">Judge sign in</h1>
        <p className="mt-1 text-muted">Type the code the organizer gave you.</p>

        <label htmlFor="code" className="mt-6 block text-sm font-semibold">Judge code</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
          className="mt-1.5 w-full rounded-xl border-2 border-pine-900/20 px-4 py-3 text-center font-display text-3xl font-bold tracking-[0.25em] placeholder:text-pine-900/20 focus:border-pine-900 focus:outline-none"
        />

        {error && <p role="alert" className="mt-3 text-sm font-medium text-demerit">{error}</p>}

        <button
          type="submit"
          disabled={busy || code.replace(/[^A-Z0-9]/g, '').length < 8}
          className="mt-6 w-full rounded-full bg-pine-900 px-6 py-3.5 text-lg font-semibold text-white hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Checking' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
