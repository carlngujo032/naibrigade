import { Link } from 'react-router-dom';

export default function Header({ children }) {
  return (
    <header className="bg-pine-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3 rounded-lg">
          <img src="/logo.jpg" alt="" width="44" height="44" className="size-11 shrink-0 rounded-full bg-white" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-semibold">Nissi Academy Inc.</span>
            <span className="block truncate text-sm text-pine-100/80">Brigade 2026</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2">{children}</nav>
      </div>
    </header>
  );
}
