import { Suspense } from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarSkeleton } from '@/components/Skeletons';

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarView />
    </Suspense>
  );
}
