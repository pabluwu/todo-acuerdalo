import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Board } from '@/components/Board';
import { BoardSkeleton } from '@/components/Skeletons';

export const metadata: Metadata = { title: 'Tablero' };

export default function HomePage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board />
    </Suspense>
  );
}
