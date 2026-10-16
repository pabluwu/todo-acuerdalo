'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { icon } from '@/lib/icons';

export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={`w-full pr-10 ${props.className ?? ''}`} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={shown}
        className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-zinc-500 hover:text-zinc-900"
      >
        {shown ? <EyeOff {...icon} /> : <Eye {...icon} />}
      </button>
    </div>
  );
}
