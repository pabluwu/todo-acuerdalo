'use client';

import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { icon } from '@/lib/icons';
import { useDismiss } from '@/lib/useDismiss';
import { Dialog } from './Dialog';

export interface PillOption { id: string; label: string; lead?: React.ReactNode }

/**
 * Filtro de valor único como pill: muestra el valor elegido y una × para quitarlo.
 * En escritorio abre un popover; en móvil, una hoja inferior (el carril de filtros hace scroll y recortaría el popover).
 */
export function FilterPill({
  icon: Icon,
  label,
  options,
  value,
  onChange,
  sheet,
  clearable = true,
  align = 'left',
}: {
  icon: LucideIcon;
  label: string;
  options: PillOption[];
  value: string;
  onChange: (v: string) => void;
  sheet: boolean;
  clearable?: boolean;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open && !sheet, close, btn);

  const selected = options.find((o) => o.id === value);
  const active = clearable && !!selected;
  const pick = (id: string) => { onChange(id); setOpen(false); btn.current?.focus(); };

  const list = (
    <div role="menu" aria-label={label} className="max-h-72 overflow-y-auto">
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="menuitemradio"
          aria-checked={o.id === value}
          autoFocus={o.id === value || (!selected && i === 0)}
          onClick={() => pick(o.id)}
          className="menu-item max-md:py-3"
        >
          {o.lead}
          <span className="min-w-0 flex-1 truncate">{o.label}</span>
          {o.id === value && <Check {...icon} className="text-accent" />}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <span data-active={active} className={`pill ${active ? 'pr-1' : ''}`}>
        <button
          ref={btn}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="-my-1 inline-flex items-center gap-1.5 rounded-full py-1 outline-offset-4"
        >
          <Icon {...icon} />
          {selected && (active || !clearable) ? <span className="max-w-[9rem] truncate"><span className="sr-only">{label}: </span>{selected.label}</span> : label}
          {!active && <ChevronDown size={14} strokeWidth={1.5} aria-hidden />}
        </button>
        {active && (
          <button type="button" onClick={() => onChange('')} aria-label={`Quitar filtro ${label.toLowerCase()}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-indigo-200/60">
            <X size={14} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </span>
      {open && !sheet && <div className={`popover ${align === 'right' ? 'left-auto right-0' : ''}`}>{list}</div>}
      {open && sheet && (
        <Dialog variant="bottom" labelledBy={titleId} onClose={close}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold tracking-tight"><Icon {...icon} className="text-accent" /> {label}</h2>
            <button type="button" onClick={close} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
          </div>
          <div className="p-2 pb-4">{list}</div>
        </Dialog>
      )}
    </div>
  );
}
