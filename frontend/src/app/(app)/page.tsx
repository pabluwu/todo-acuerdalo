import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Board } from '@/components/Board';
import { BoardSkeleton, ListSkeleton } from '@/components/Skeletons';

export const metadata: Metadata = { title: 'Tablero' };

export default function HomePage() {
  return (
    <Suspense fallback={<><div className="md:hidden"><ListSkeleton /></div><div className="hidden md:block"><BoardSkeleton /></div></>}>
      <Board />
    </Suspense>
  );
}
