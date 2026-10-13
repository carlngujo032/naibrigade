import { useEffect } from 'react';
import { Check } from 'lucide-react';

/** Small confirmation that clears itself. Pass the message and a function that empties it. */
export default function Toast({ message, onClear, ms = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(onClear, ms);
    return () => clearTimeout(id);
  }, [message, onClear, ms]);

  if (!message) return null;
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-pine-950 px-5 py-3 text-white shadow-xl">
      <Check className="size-5 shrink-0 text-emerald-300" aria-hidden="true" />
      {message}
    </div>
  );
}
