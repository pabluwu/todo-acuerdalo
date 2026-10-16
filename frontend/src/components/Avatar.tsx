import { initials } from '@/lib/api';

/** `decorative` cuando el nombre ya aparece como texto junto al avatar. */
export function Avatar({ name, size = 'sm', decorative = false }: { name: string; size?: 'sm' | 'md'; decorative?: boolean }) {
  const cls = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  return (
    <span
      title={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={`inline-flex ${cls} shrink-0 items-center justify-center rounded-full bg-zinc-100 font-medium text-zinc-600 ring-2 ring-white`}
    >
      <span aria-hidden>{initials(name)}</span>
      {!decorative && <span className="sr-only">{name}</span>}
    </span>
  );
}
