import { initials } from '@/lib/api';
import { PERSON_COLORS } from '@/lib/calendar';

/** Color estable por persona: el mismo nombre siempre cae en el mismo tono. */
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PERSON_COLORS[Math.abs(h) % PERSON_COLORS.length];
}

/** `decorative` cuando el nombre ya aparece como texto junto al avatar. */
export function Avatar({ name, size = 'sm', decorative = false }: { name: string; size?: 'sm' | 'md'; decorative?: boolean }) {
  const cls = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';
  return (
    <span
      title={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={`avatar ev-c-${colorFor(name)} inline-flex ${cls} shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white`}
    >
      <span aria-hidden>{initials(name)}</span>
      {!decorative && <span className="sr-only">{name}</span>}
    </span>
  );
}
