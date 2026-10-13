import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Check, LogOut, Trophy } from 'lucide-react';
import { api, ApiError, clearToken, getToken } from '../lib/api.js';
import { usePolling } from '../lib/usePolling.js';
import Header from '../components/Header.jsx';
import LoginForm from '../components/admin/LoginForm.jsx';
import AwardForm from '../components/admin/AwardForm.jsx';
import HistoryList from '../components/admin/HistoryList.jsx';
import JudgingPanel from '../components/admin/JudgingPanel.jsx';

const navButton = 'flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20';

function Dashboard({ onUnauthorized }) {
  const board = usePolling(() => api.leaderboard(), 15_000);
  const log = usePolling(() => api.adminLog(), 15_000);
  const [rules, setRules] = useState(null);
  const [toast, setToast] = useState('');
  const [undoError, setUndoError] = useState('');

  useEffect(() => { api.rules().then(setRules).catch(() => {}); }, []);

  useEffect(() => {
    if (board.error?.status === 401 || log.error?.status === 401) onUnauthorized();
  }, [board.error, log.error, onUnauthorized]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const refreshAll = () => Promise.all([board.refresh(), log.refresh()]);

  async function undo(id) {
    setUndoError('');
    try {
      await api.undo(id);
      setToast('Undone. The points were put back.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setUndoError(err.message);
    }
    await refreshAll();
  }

  const data = board.data;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-5xl font-extrabold text-pine-900 sm:text-6xl">Add points</h1>
      <p className="mt-1 text-muted">Changes show on the public leaderboard within 10 seconds.</p>

      {!data ? (
        <p className="mt-8 text-muted" role="status">
          {board.error ? board.error.message : 'Loading troops and games. The first load can take up to a minute.'}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <AwardForm
            troops={[...data.troops].sort((a, b) => a.id - b.id)}
            categories={data.categories}
            rules={rules}
            onUnauthorized={onUnauthorized}
            onAdded={(message) => { setToast(message); refreshAll(); }}
          />
          <div className="space-y-3 lg:sticky lg:top-4">
            {undoError && <p role="alert" className="rounded-2xl bg-demerit/10 px-4 py-3 text-sm font-medium text-demerit">{undoError}</p>}
            <HistoryList activity={log.data?.activity ?? []} onUndo={undo} />
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-pine-950 px-5 py-3 text-white shadow-xl">
          <Check className="size-5 text-emerald-300" aria-hidden="true" />
          {toast}
        </div>
      )}
    </main>
  );
}

function Tabs() {
  const tab = ({ isActive }) => `rounded-full px-5 py-2 text-sm font-semibold ${isActive ? 'bg-pine-900 text-white' : 'text-pine-900 hover:bg-pine-900/10'}`;
  return (
    <nav aria-label="Organizer sections" className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="inline-flex gap-1 rounded-full bg-white p-1 ring-1 ring-pine-900/10">
        <NavLink to="/admin" end className={tab}>Add points</NavLink>
        <NavLink to="/admin/judging" className={tab}>Judging</NavLink>
      </div>
    </nav>
  );
}

export default function Admin({ tab = 'points' }) {
  const [signedIn, setSignedIn] = useState(() => !!getToken());
  const [notice, setNotice] = useState('');

  useEffect(() => { document.title = 'Organizer | Brigade 2026'; }, []);

  const signOut = (message = '') => {
    clearToken();
    setNotice(message);
    setSignedIn(false);
  };

  return (
    <>
      <Header>
        <Link to="/" aria-label="Leaderboard" className={navButton}><Trophy className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Leaderboard</span></Link>
        {signedIn && (
          <button type="button" onClick={() => signOut()} aria-label="Sign out" className={navButton}>
            <LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </Header>
      {signedIn && <Tabs />}
      {signedIn
        ? (tab === 'judging'
          ? <JudgingPanel onUnauthorized={() => signOut('Your session expired. Please sign in again.')} />
          : <Dashboard onUnauthorized={() => signOut('Your session expired. Please sign in again.')} />)
        : <LoginForm notice={notice} onSignedIn={() => { setNotice(''); setSignedIn(true); }} />}
    </>
  );
}
