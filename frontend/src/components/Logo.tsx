import { Check } from 'lucide-react';

/** Marca: cuadrado de acento con check, igual que el favicon. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-accent ${className}`}>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent text-white">
        <Check size={13} strokeWidth={2.5} aria-hidden />
      </span>
      Acuérdalo
    </span>
  );
}
