import { useEffect, useState } from 'react';

/** Two taps to run a risky action, so a stray tap can't do damage. */
export default function ConfirmButton({ Icon, label, confirmLabel = 'Tap again to confirm', onConfirm, className = '', disabled = false, primary = false }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  async function click() {
    if (!armed) return setArmed(true);
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={disabled || busy}
      className={`flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${armed ? 'bg-demerit text-white' : primary ? 'bg-pine-900 text-white hover:bg-pine-800' : 'bg-pine-900/10 text-pine-900 hover:bg-pine-900/20'} ${className}`}
    >
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {armed ? confirmLabel : label}
    </button>
  );
}
