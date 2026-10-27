'use client';

import { Suspense, use } from 'react';
import { PublicationPage } from '@/components/publications/PublicationPage';
import { PanelSkeleton } from '@/components/Skeletons';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl"><PanelSkeleton /></div>}>
      <PublicationPage id={id} />
    </Suspense>
  );
}
