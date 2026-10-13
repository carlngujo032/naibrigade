import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { api, ApiError, clearJudgeToken, getJudgeToken } from '../lib/api.js';
import { usePolling } from '../lib/usePolling.js';
import Header from '../components/Header.jsx';
import JudgeLogin from '../components/judge/JudgeLogin.jsx';
import EventScoring from '../components/judge/EventScoring.jsx';

const BADGE = {
  open: ['Open for scoring', 'bg-gold/30 text-pine-950'],
  submitted: ['Submitted', 'bg-merit/15 text-merit'],
  published: ['Closed', 'bg-pine-900/10 text-muted'],
};

function Workspace({ onUnauthorized }) {
  // Refreshes quietly so a newly opened event shows up without reloading.
  const board = usePolling(() => api.judgeEvents(), 15_000);
  const [selected, setSelected] = useState(null);
  const data = board.data;

  useEffect(() => {
    if (board.error?.status === 401) onUnauthorized();
  }, [board.error, onUnauthorized]);

  // Pick something sensible to show first: an event still waiting for this judge's scores.
  useEffect(() => {
    if (!data?.events.length) return;
    if (selected && data.events.some((e) => e.id === selected)) return;
    setSelected((data.events.find((e) => e.status === 'open' && !e.submitted) ?? data.events[0]).id);
  }, [data, selected]);

  const event = data?.events.find((e) => e.id === selected);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {!data ? (
        <p className="text-muted" role="status">
          {board.error ? board.error.message : 'Loading your events. The first load can take up to a minute.'}
        </p>
      ) : (
        <>
          <h1 className="font-display text-5xl font-extrabold text-pine-900 sm:text-6xl">Hello, {data.judge.name}</h1>

          {data.events.length === 0 ? (
            <p className="mt-4 rounded-3xl bg-white p-6 text-lg ring-1 ring-pine-900/10">
              No event is open for you yet. This page updates by itself when the organizer opens one.
            </p>
          ) : (
            <>
              {data.events.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-3" role="tablist" aria-label="Your events">
                  {data.events.map((e) => {
                    const [label, tone] = e.submitted ? BADGE.submitted : e.status === 'open' ? BADGE.open : BADGE.published;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        role="tab"
                        aria-selected={e.id === selected}
                        onClick={() => setSelected(e.id)}
                        className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${e.id === selected ? 'border-pine-900 bg-white' : 'border-transparent bg-white/60 hover:bg-white'}`}
                      >
                        <span className="block font-display text-2xl font-bold leading-none">{e.name}</span>
                        <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {event && (
                <div className="mt-6">
                  <EventScoring
                    key={`${event.id}`}
                    event={event}
                    troops={data.troops}
                    onSubmitted={board.refresh}
                    onUnauthorized={onUnauthorized}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function Judge() {
  const [signedIn, setSignedIn] = useState(() => !!getJudgeToken());
  const [notice, setNotice] = useState('');

  useEffect(() => { document.title = 'Judge | Brigade 2026'; }, []);

  const signOut = (message = '') => {
    clearJudgeToken();
    setNotice(message);
    setSignedIn(false);
  };

  return (
    <>
      <Header>
        {signedIn && (
          <button type="button" onClick={() => signOut()} aria-label="Sign out" className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </Header>
      {signedIn
        ? <Workspace onUnauthorized={() => signOut('Your session expired. Please enter your code again.')} />
        : <JudgeLogin notice={notice} onSignedIn={() => { setNotice(''); setSignedIn(true); }} />}
    </>
  );
}
