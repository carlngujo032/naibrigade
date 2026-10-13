import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Tv } from 'lucide-react';
import { api } from '../lib/api.js';
import { usePolling } from '../lib/usePolling.js';
import Header from '../components/Header.jsx';
import RaceBoard from '../components/RaceBoard.jsx';
import GameMatrix from '../components/GameMatrix.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import RulesDialog from '../components/RulesDialog.jsx';

const SEEN_KEY = 'brigade_guide_seen';
const guideSeen = () => { try { return !!sessionStorage.getItem(SEEN_KEY); } catch { return false; } };
const markGuideSeen = () => { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } };

export default function Leaderboard() {
  const board = usePolling(async () => {
    const [leaderboard, feed] = await Promise.all([api.leaderboard(), api.activity(8)]);
    return { ...leaderboard, activity: feed.activity };
  }, 10_000);

  const [rules, setRules] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => { document.title = 'Brigade 2026 leaderboard | Nissi Academy Inc.'; }, []);

  // The guide pops up once per visit (like the old site), but only after it has loaded.
  useEffect(() => {
    api.rules().then((r) => {
      setRules(r);
      if (!guideSeen()) setGuideOpen(true);
    }).catch(() => {});
  }, []);

  // Free hosting sleeps when idle; tell people why the first load is slow.
  useEffect(() => {
    if (!board.loading) { setSlow(false); return undefined; }
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, [board.loading]);

  const closeGuide = () => { markGuideSeen(); setGuideOpen(false); };
  const data = board.data;

  return (
    <>
      <Header>
        <Link to="/tv" className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
          <Tv className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">TV view</span>
          <span className="sr-only sm:hidden">TV view</span>
        </Link>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          Merit guide
        </button>
      </Header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {board.error && !data ? (
          <div role="alert" className="rounded-3xl bg-white p-8 text-center ring-1 ring-pine-900/10">
            <h1 className="font-display text-4xl font-bold text-pine-900">Can&rsquo;t load the standings</h1>
            <p className="mt-2 text-muted">{board.error.message}</p>
            <button type="button" onClick={board.refresh} className="mt-5 rounded-full bg-pine-900 px-6 py-3 font-semibold text-white hover:bg-pine-800">
              Try again
            </button>
          </div>
        ) : (
          <>
            <RaceBoard
              troops={data?.troops}
              loading={board.loading}
              slow={slow}
              updatedAt={board.updatedAt}
              failing={!!board.error}
            />
            {data && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                <GameMatrix troops={data.troops} categories={data.categories} />
                <ActivityFeed activity={data.activity} />
              </div>
            )}
          </>
        )}
        <p className="pb-4 text-center text-sm text-muted">Standings refresh on their own every 10 seconds.</p>
      </main>

      <RulesDialog open={guideOpen} onClose={closeGuide} rules={rules} />
    </>
  );
}
