import { Suspense } from 'react';
import { PublicationsView } from '@/components/publications/PublicationsView';
import { CalendarSkeleton } from '@/components/Skeletons';

export default function PublicacionesPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <PublicationsView />
    </Suspense>
  );
}
