import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Registro de actividad' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
