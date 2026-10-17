'use client';

import { type RefObject, useEffect } from 'react';

/** Cierra un menú o popover al hacer clic fuera o con Escape (devolviendo el foco al disparador). */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, trigger?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      trigger?.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, open, onClose, trigger]);
}
