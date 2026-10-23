'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';
import { api } from '@/lib/api';

/** Solo rutas internas: evita redirecciones abiertas (//host, /\\host). */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/';
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const nextUrl = safeNext(useSearchParams().get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Escribe tu correo.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Revisa el formato del correo.';
    if (!password) next.password = 'Escribe tu contraseña.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } });
      window.location.href = nextUrl;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-6">
        <div>
          <Logo className="mb-8" />
          <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-zinc-600">Accede a tu tablero de tareas.</p>
        </div>
        <div className="space-y-4">
          <Field label="Correo" error={errors.email}>
            {(p) => <input {...p} type="email" autoComplete="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field
            label="Contraseña"
            error={errors.password}
            action={<Link href="/forgot-password" className="rounded text-xs text-accent hover:underline">¿Olvidaste tu contraseña?</Link>}
          >
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </div>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button className="btn-accent w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-center text-sm text-zinc-600">
          ¿No tienes cuenta? <Link href="/register" className="rounded text-accent hover:underline">Regístrate</Link>
        </p>
      </form>
    </main>
  );
}
