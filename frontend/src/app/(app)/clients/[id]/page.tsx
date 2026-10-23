'use client';

import { Suspense, use } from 'react';
import { ClientPage } from '@/components/clients/ClientPage';
import { PanelSkeleton } from '@/components/Skeletons';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl"><PanelSkeleton /></div>}>
      <ClientPage clientId={id} />
    </Suspense>
  );
}
