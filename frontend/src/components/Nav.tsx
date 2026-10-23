'use client';

import {
  BriefcaseBusiness, CalendarDays, ChevronDown, Contact, LayoutDashboard, LogOut, NotebookPen, ScrollText, Shield, Tags, UserRound, Users, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { useDismiss } from '@/lib/useDismiss';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

interface NavItem { href: string; label: string; icon: LucideIcon }

const MAIN: NavItem[] = [
  { href: '/', label: 'Tablero', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/notes', label: 'Notas', icon: NotebookPen },
  { href: '/clients', label: 'Clientes', icon: BriefcaseBusiness },
];
const ADMIN: NavItem[] = [
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/task-types', label: 'Tipos de tarea', icon: Tags },
  { href: '/admin/contacts', label: 'Contactos', icon: Contact },
  { href: '/admin/logs', label: 'Registro', icon: ScrollText },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

/** Menú desplegable compartido por "Administración" y el menú de cuenta. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close, btn);
  return { open, setOpen, close, ref, btn };
}

function MenuLinks({ items, path, onPick }: { items: NavItem[]; path: string; onPick: () => void }) {
  return items.map((i, n) => (
    <Link
      key={i.href}
      href={i.href}
      role="menuitem"
      autoFocus={n === 0}
      onClick={onPick}
      aria-current={isActive(path, i.href) ? 'page' : undefined}
      className="menu-item"
    >
      <i.icon {...icon} className={isActive(path, i.href) ? 'text-accent' : 'text-zinc-500'} /> {i.label}
    </Link>
  ));
}

function AdminMenu({ path }: { path: string }) {
  const m = useMenu();
  const active = path.startsWith('/admin');
  return (
    <div ref={m.ref} className="relative hidden md:block">
      <button
        ref={m.btn}
        type="button"
        onClick={() => m.setOpen(!m.open)}
        aria-haspopup="menu"
        aria-expanded={m.open}
        className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${active ? 'bg-accent-soft font-medium text-indigo-900' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
      >
        <Shield {...icon} className={active ? 'text-accent' : ''} /> Administración
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={`transition-transform ${m.open ? 'rotate-180' : ''}`} />
      </button>
      {m.open && (
        <div role="menu" className="popover w-56">
          <MenuLinks items={ADMIN} path={path} onPick={m.close} />
        </div>
      )}
    </div>
  );
}

function UserMenu({ path }: { path: string }) {
  const { user, logout } = useAuth();
  const m = useMenu();
  if (!user) return null;
  const admin = user.role === 'admin';
  return (
    <div ref={m.ref} className="relative shrink-0">
      <button
        ref={m.btn}
        type="button"
        onClick={() => m.setOpen(!m.open)}
        aria-haspopup="menu"
        aria-expanded={m.open}
        aria-label={`Menú de ${user.name}`}
        className="flex items-center gap-2 rounded-full p-0.5 text-sm text-zinc-600 hover:text-zinc-900"
      >
        <Avatar name={user.name} size="md" decorative />
        <span className="hidden max-w-[10rem] truncate lg:inline">{user.name}</span>
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className="mr-1 hidden lg:block" />
      </button>
      {m.open && (
        <div role="menu" className="popover left-auto right-0 w-64">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={user.name} size="md" decorative />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
          {admin && (
            <div className="mt-1 border-t border-zinc-100 pt-1 md:hidden">
              <p className="section-label px-2.5 pb-1 pt-2">Administración</p>
              <MenuLinks items={ADMIN} path={path} onPick={m.close} />
            </div>
          )}
          <div className="mt-1 border-t border-zinc-100 pt-1">
            <Link
              href="/account"
              role="menuitem"
              autoFocus={!admin}
              onClick={m.close}
              aria-current={isActive(path, '/account') ? 'page' : undefined}
              className="menu-item"
            >
              <UserRound {...icon} className={isActive(path, '/account') ? 'text-accent' : 'text-zinc-500'} /> Mi cuenta
            </Link>
            <button role="menuitem" onClick={logout} className="menu-item">
              <LogOut {...icon} className="text-zinc-500" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const { user } = useAuth();
  const path = usePathname();
  // solicitudes de acceso a mis notas privadas, pendientes de resolver
  const [pending, setPending] = useState(0);
  useEffect(() => {
    api<{ count: number }>('/notes/access-requests/pending/count').then((r) => setPending(r.count)).catch(() => undefined);
  }, [path]);
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <Link href="/" className="shrink-0 rounded-md" aria-label="Acuérdalo, ir al tablero">
            <Logo compact />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1">
            {MAIN.map((i) => {
              const active = isActive(path, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${active ? 'bg-accent-soft font-medium text-indigo-900' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
                >
                  <i.icon {...icon} className={active ? 'text-accent' : ''} />
                  {i.label}
                  {i.href === '/notes' && pending > 0 && (
                    <span className="pill-count" aria-label={`${pending} solicitudes de acceso pendientes`}>{pending}</span>
                  )}
                </Link>
              );
            })}
            {user?.role === 'admin' && <AdminMenu path={path} />}
          </nav>
        </div>
        <UserMenu path={path} />
      </div>
    </header>
  );
}
