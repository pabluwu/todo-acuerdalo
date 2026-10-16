const BOARD_GHOSTS = [2, 3, 1];

export function BoardSkeleton() {
  return (
    <div aria-hidden className="flex snap-x gap-6 overflow-hidden md:grid md:grid-cols-3">
      {BOARD_GHOSTS.map((n, c) => (
        <div key={c} className="w-[85vw] shrink-0 md:w-auto">
          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="skeleton h-2 w-2 rounded-full" />
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="space-y-2.5 rounded-xl bg-zinc-100/60 p-2">
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
