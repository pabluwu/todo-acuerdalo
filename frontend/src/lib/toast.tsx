'use client';

import { Check, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';
import { icon } from './icons';

type Variant = 'error' | 'success';
type Push = (msg: string, variant?: Variant) => void;

const ToastContext = createContext<Push>(() => {});
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msgs, setMsgs] = useState<{ id: number; text: string; variant: Variant }[]>([]);
  const dismiss = useCallback((id: number) => setMsgs((m) => m.filter((x) => x.id !== id)), []);
  // sin variante se asume error: casi todos los avisos son fallos de la API
  const push = useCallback<Push>((text, variant = 'error') => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m, { id, text, variant }].slice(-MAX_TOASTS));
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] left-1/2 md:bottom-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
      >
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-md border bg-white py-2.5 pl-3 pr-2 text-sm shadow-md ${m.variant === 'error' ? 'border-red-200 text-red-800' : 'border-zinc-200 text-zinc-800'}`}
            style={{ animation: 'toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <span className={`mt-0.5 shrink-0 ${m.variant === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
              {m.variant === 'error' ? <CircleAlert {...icon} /> : <Check {...icon} />}
            </span>
            <p className="min-w-0 flex-1 break-words">{m.text}</p>
            <button type="button" onClick={() => dismiss(m.id)} aria-label="Cerrar aviso" className="btn-ghost btn-icon btn-sm !h-6 !w-6 shrink-0 text-zinc-500">
              <X size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
