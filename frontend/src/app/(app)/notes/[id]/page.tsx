'use client';

import { Suspense, use } from 'react';
import { NotePage } from '@/components/notes/NotePage';
import { PanelSkeleton } from '@/components/Skeletons';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl"><PanelSkeleton /></div>}>
      <NotePage noteId={id} />
    </Suspense>
  );
}
