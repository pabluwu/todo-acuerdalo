'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'El nombre necesita al menos 2 caracteres.';
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Escribe un correo válido.';
    if (password.length < 8) next.password = 'La contraseña necesita al menos 8 caracteres.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/register', { method: 'POST', body: { name, email, password } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <Logo />
          <div role="status" className="rounded-xl border border-zinc-200 bg-white p-6">
            <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CircleCheck size={20} strokeWidth={1.5} aria-hidden />
            </span>
            <h1 className="text-xl font-semibold tracking-tight">Registro recibido</h1>
            <p className="mt-1.5 text-sm text-zinc-600">Tu cuenta quedará activa cuando un administrador la apruebe.</p>
          </div>
          <Link href="/login" className="btn w-full">Volver a iniciar sesión</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-6">
        <div>
          <Logo className="mb-8" />
          <h1 className="text-xl font-semibold tracking-tight">Crear cuenta</h1>
          <p className="mt-1 text-sm text-zinc-600">Un administrador revisará tu solicitud.</p>
        </div>
        <div className="space-y-4">
          <Field label="Nombre" error={errors.name}>
            {(p) => <input {...p} autoComplete="name" className="w-full" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Correo" error={errors.email}>
            {(p) => <input {...p} type="email" autoComplete="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres." error={errors.password}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </div>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button className="btn-accent w-full" disabled={busy}>{busy ? 'Enviando…' : 'Registrarme'}</button>
        <p className="text-center text-sm text-zinc-600">
          ¿Ya tienes cuenta? <Link href="/login" className="rounded text-accent hover:underline">Inicia sesión</Link>
        </p>
      </form>
    </main>
  );
}
