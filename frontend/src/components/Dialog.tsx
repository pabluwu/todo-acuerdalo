'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const PANEL_CLASS = { modal: 'dialog-modal', sheet: 'dialog-sheet', bottom: 'dialog-bottom', form: 'dialog-form' } as const;

// Pila de capas abiertas: solo la superior responde a Escape y al foco.
const stack: symbol[] = [];
let lockCount = 0;

/**
 * Primitiva única para el modal centrado y el panel lateral:
 * role="dialog", foco dentro y atrapado, Escape en la capa superior,
 * bloqueo del scroll del fondo y foco devuelto a quien lo abrió.
 */
export function Dialog({
  variant = 'modal',
  labelledBy,
  onClose,
  children,
}: {
  variant?: 'modal' | 'sheet' | 'bottom' | 'form';
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // se captura durante el render, antes de que autoFocus mueva el foco
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = Symbol('dialog');
    stack.push(id);
    if (lockCount++ === 0) document.body.style.overflow = 'hidden';
    const node = ref.current!;
    if (!node.contains(document.activeElement)) node.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) { e.preventDefault(); node.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!node.contains(active) || active === node) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const returnTo = opener.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      if (--lockCount === 0) document.body.style.overflow = '';
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className={`dialog-backdrop ${
        variant === 'sheet' ? 'justify-end' : variant === 'bottom' ? 'items-end justify-center' : variant === 'form' ? 'justify-center max-sm:p-0 sm:items-center sm:px-4' : 'items-center justify-center px-4'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={PANEL_CLASS[variant]}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
