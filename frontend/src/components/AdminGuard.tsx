'use client';

import { useAuth } from '@/lib/auth-context';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <p className="text-sm text-zinc-600">Esta sección es solo para administradores.</p>;
  return <>{children}</>;
}
