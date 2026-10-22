'use client';

import { Suspense, use } from 'react';
import { PanelSkeleton } from '@/components/Skeletons';
import { TaskPage } from '@/components/TaskPage';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl"><PanelSkeleton /></div>}>
      <TaskPage taskId={id} />
    </Suspense>
  );
}
