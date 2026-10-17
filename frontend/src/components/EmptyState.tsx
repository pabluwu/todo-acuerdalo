import type { LucideIcon } from 'lucide-react';

/** Estado vacío: ícono en un círculo tintado, título, explicación y una acción opcional. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = 'accent',
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'accent' | 'neutral';
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-8' : 'rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16'}`}>
      <span className={`mb-4 inline-flex items-center justify-center rounded-full ${compact ? 'h-10 w-10' : 'h-14 w-14'} ${tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-zinc-100 text-zinc-500'}`}>
        <Icon size={compact ? 18 : 24} strokeWidth={1.5} aria-hidden />
      </span>
      <p className={`font-medium text-zinc-900 ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-zinc-600">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
