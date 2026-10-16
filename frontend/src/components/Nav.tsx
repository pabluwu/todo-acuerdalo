'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!user) return null;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${user.name}`}
        className="flex items-center gap-2 rounded-full p-0.5 text-sm text-zinc-600 hover:text-zinc-900"
      >
        <Avatar name={user.name} size="md" decorative />
        <span className="hidden max-w-[10rem] truncate pr-2 sm:inline">{user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-60 rounded-lg border border-zinc-200 bg-white p-1 shadow-md" style={{ animation: 'dialog-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
          <div className="border-b border-zinc-100 px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <button role="menuitem" autoFocus onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
            <LogOut {...icon} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const { user } = useAuth();
  const path = usePathname();
  const items = [
    { href: '/', label: 'Tablero' },
    { href: '/calendar', label: 'Calendario' },
  ];
  if (user?.role === 'admin') {
    items.push(
      { href: '/admin/users', label: 'Usuarios' },
      { href: '/admin/task-types', label: 'Tipos' },
      { href: '/admin/contacts', label: 'Contactos' },
      { href: '/admin/logs', label: 'Logs' },
    );
  }
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-8">
          <Link href="/" className="shrink-0 rounded-md" aria-label="Acuérdalo, ir al tablero"><Logo /></Link>
          <nav aria-label="Principal" className="no-scrollbar -mx-1 flex min-w-0 max-md:[mask-image:linear-gradient(to_right,black_88%,transparent)] items-center gap-1 overflow-x-auto px-1 py-1">
            {items.map((i) => {
              const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
                >
                  {i.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
