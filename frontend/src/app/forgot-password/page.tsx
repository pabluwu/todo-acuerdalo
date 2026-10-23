'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = !email.trim() ? 'Escribe tu correo.' : !/^\S+@\S+\.\S+$/.test(email) ? 'Revisa el formato del correo.' : '';
    setEmailError(msg);
    if (msg) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      {sent ? (
        <div className="w-full max-w-sm space-y-6">
          <div>
            <Logo className="mb-8" />
            <h1 className="text-xl font-semibold tracking-tight">Revisa tu correo</h1>
            <p role="status" className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <MailCheck {...icon} className="mt-0.5 shrink-0" />
              Si el correo está registrado, te enviamos un enlace para definir una nueva contraseña. Expira en 1 hora.
            </p>
          </div>
          <Link href="/login" className="btn-accent w-full">Volver a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-6">
          <div>
            <Logo className="mb-8" />
            <h1 className="text-xl font-semibold tracking-tight">Recuperar contraseña</h1>
            <p className="mt-1 text-sm text-zinc-600">Te enviaremos un enlace para definir una nueva.</p>
          </div>
          <Field label="Correo" error={emailError}>
            {(p) => <input {...p} type="email" autoComplete="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <button className="btn-accent w-full" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
          <p className="text-center text-sm text-zinc-600">
            <Link href="/login" className="rounded text-accent hover:underline">Volver a iniciar sesión</Link>
          </p>
        </form>
      )}
    </main>
  );
}
