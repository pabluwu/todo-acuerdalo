'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { BoardSkeleton } from '@/components/Skeletons';
import type { User } from './types';

interface AuthState {
  user: User | null;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState>({ user: null, logout: async () => {}, setUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(async () => {
        // cookie inválida: se limpia para evitar bucles con el middleware
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }, [router]);

  if (loading || !user) {
    return (
      <div aria-busy="true">
        <div className="h-14 border-b border-zinc-200 bg-white" />
        <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6"><BoardSkeleton /></div>
      </div>
    );
  }
  return <AuthContext.Provider value={{ user, logout, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
