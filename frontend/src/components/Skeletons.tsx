const BOARD_GHOSTS = [2, 3, 1];
const COLUMN_TINTS = ['bg-stone-100/80', 'bg-indigo-50/80', 'bg-emerald-50/80'];

export function BoardSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-3 items-start gap-4 lg:gap-5">
      {BOARD_GHOSTS.map((n, c) => (
        <div key={c} className={`rounded-2xl p-2 ${COLUMN_TINTS[c]}`}>
          <div className="flex items-center gap-2 px-2 pb-3 pt-1.5">
            <div className="skeleton h-4 w-4 rounded-full" />
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="card-surface space-y-3 p-3.5">
                <div className="skeleton h-4 w-4/5" />
                <div className="flex items-center justify-between">
                  <div className="skeleton h-4 w-16" />
                  <div className="skeleton h-6 w-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      {[3, 2].map((n, g) => (
        <div key={g} className="card-surface overflow-hidden">
          <div className={`flex items-center gap-2 px-4 py-3 ${COLUMN_TINTS[g]}`}>
            <div className="skeleton h-4 w-4 rounded-full" />
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="skeleton h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/5" />
                  <div className="skeleton h-3 w-24 md:hidden" />
                </div>
                <div className="skeleton h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgendaSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => <div key={i} className="skeleton h-14" />)}
      </div>
      {[2, 1].map((n, d) => (
        <div key={d} className="space-y-2">
          <div className="skeleton h-4 w-32" />
          {Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-14 w-full" />)}
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div aria-hidden className="space-y-8 px-6 py-6 sm:px-8">
      <div className="space-y-3">
        <div className="skeleton h-7 w-3/4" />
        <div className="skeleton h-20 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3 w-14" />
            <div className="skeleton h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton hidden h-4 w-48 md:block" />
          <div className="skeleton ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton h-9 w-52" />
      </div>
      <div className="card-surface grid h-[28rem] grid-cols-7 gap-px overflow-hidden bg-zinc-100">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="space-y-3 bg-white p-3">
            <div className="skeleton mx-auto h-4 w-8" />
            {i % 3 !== 1 && <div className="skeleton h-10 w-full" />}
            {i % 2 === 0 && <div className="skeleton h-16 w-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}
