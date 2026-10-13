import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { timeAgo } from '../lib/format.js';

export default function LiveStatus({ updatedAt, failing, className = 'text-sm' }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (failing) {
    return (
      <p className={`flex items-center gap-2 text-gold ${className}`} role="status">
        <WifiOff className="size-4" aria-hidden="true" />
        Connection lost. Showing the last update{updatedAt ? ` from ${timeAgo(updatedAt)}` : ''}.
      </p>
    );
  }
  return (
    <p className={`flex items-center gap-2 text-pine-100/80 ${className}`} role="status">
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
      </span>
      {updatedAt ? `Live, updated ${timeAgo(updatedAt)}` : 'Connecting'}
    </p>
  );
}
