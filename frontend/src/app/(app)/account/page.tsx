'use client';

import { useEffect, useState } from 'react';
import { EmailListInput } from '@/components/EmailListInput';
import { Field } from '@/components/Field';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';
import { useToast } from '@/lib/toast';
import type { User } from '@/lib/types';

function PushSection() {
  const toast = useToast();
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      if (next === 'on') toast('Notificaciones activadas en este dispositivo', 'success');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    await disablePush();
    setState(await getPushState());
    setBusy(false);
    toast('Notificaciones desactivadas en este dispositivo', 'success');
  }

  return (
    <section className="space-y-3">
      <h2 className="section-label">Notificaciones en este dispositivo</h2>
      <p className="max-w-2xl text-sm text-zinc-600">Recibe un aviso en este dispositivo cuando te asignen una tarea, te mencionen o cambie un evento. Cada dispositivo se activa por separado.</p>
      {state === 'loading' && <p className="text-sm text-zinc-500">Revisando…</p>}
      {state === 'unsupported' && <p className="max-w-2xl text-sm text-zinc-600">Este navegador no admite notificaciones push.</p>}
      {state === 'ios-install' && (
        <p className="max-w-2xl text-sm text-zinc-600">Para recibir notificaciones en iPhone, instala la app: Compartir → Agregar a inicio. Luego ábrela desde el ícono y vuelve aquí.</p>
      )}
      {state === 'denied' && (
        <p className="max-w-2xl text-sm text-zinc-600">Las notificaciones están bloqueadas para este sitio. Para activarlas, permítelas en la configuración del navegador (el candado junto a la dirección, o Ajustes del sitio) y recarga la página.</p>
      )}
      {state === 'off' && <button type="button" className="btn-accent" onClick={enable} disabled={busy}>Activar notificaciones</button>}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-zinc-700">Notificaciones activadas</span>
          <button type="button" className="btn" onClick={disable} disabled={busy}>Desactivar</button>
        </div>
      )}
    </section>
  );
}

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
      <PushSection />
    </div>
  );
}
