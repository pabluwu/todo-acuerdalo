'use client';

import { useState } from 'react';
import { EmailListInput } from '@/components/EmailListInput';
import { Field } from '@/components/Field';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import type { User } from '@/lib/types';

export default function Page() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [emails, setEmails] = useState<string[]>(user?.copyEmails ?? []);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const dirty = emails.join() !== (user.copyEmails ?? []).join();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api<User>('/users/me/copy-emails', { method: 'PATCH', body: { copyEmails: emails } });
      setUser(updated);
      setEmails(updated.copyEmails);
      toast('Copias de correo actualizadas', 'success');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Mi cuenta</h1>
      <section className="space-y-3">
        <h2 className="section-label">Copia de correos</h2>
        <p className="max-w-2xl text-sm text-zinc-600">Estos correos recibirán una copia de todas las notificaciones que te enviemos.</p>
        <form onSubmit={save} className="max-w-xl space-y-4">
          <Field label="Correos en copia" hint="Presiona Enter o coma para agregar. Máximo 10.">
            {(p) => <EmailListInput id={p.id} value={emails} onChange={setEmails} ownEmail={user.email} />}
          </Field>
          <button type="submit" className="btn-accent" disabled={busy || !dirty}>Guardar</button>
        </form>
      </section>
    </div>
  );
}
