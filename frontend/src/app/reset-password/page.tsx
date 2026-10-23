'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < 8) next.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (confirm !== password) next.confirm = 'Las contraseñas no coinciden.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      window.location.href = '/';
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
          <h1 className="text-xl font-semibold tracking-tight">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-zinc-600">Elige una contraseña nueva; entrarás a tu cuenta al guardarla.</p>
        </div>
        {!token ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            El enlace no es válido. <Link href="/forgot-password" className="underline">Pide uno nuevo</Link>.
          </p>
        ) : (
          <>
            <div className="space-y-4">
              <Field label="Contraseña nueva" hint="Mínimo 8 caracteres." error={errors.password}>
                {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
              </Field>
              <Field label="Repite la contraseña" error={errors.confirm}>
                {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
              </Field>
            </div>
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error} <Link href="/forgot-password" className="underline">Pedir otro enlace</Link>
              </p>
            )}
            <button className="btn-accent w-full" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
          </>
        )}
      </form>
    </main>
  );
}
