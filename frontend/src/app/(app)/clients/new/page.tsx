'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ClientForm, EMPTY_CLIENT, payloadOf, type ClientFormValues } from '@/components/clients/ClientForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Client } from '@/lib/types';

export default function NewClientPage() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<ClientFormValues | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const client = await api<Client>('/clients', { method: 'POST', body: payloadOf(pending) });
      toast('Cliente registrado', 'success');
      router.push(`/clients/${client.id}`);
    } catch (err) {
      // el formulario conserva lo escrito: se muestra el motivo y se puede corregir
      setError((err as Error).message);
      setPending(null);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clients" className="btn-ghost -ml-3 mb-4"><ArrowLeft {...icon} /> Volver a los clientes</Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Nuevo cliente</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        <ClientForm initial={EMPTY_CLIENT} submitLabel="Registrar cliente" error={error} onSubmit={setPending} />
      </div>
      {pending && (
        <ConfirmDialog
          title={`¿Registrar a ${pending.name.trim()}?`}
          confirmLabel="Registrar"
          busyLabel="Registrando…"
          busy={busy}
          onConfirm={create}
          onCancel={() => setPending(null)}
        >
          Se creará su ficha y quedará disponible para todo el equipo, también al armar eventos del calendario.
        </ConfirmDialog>
      )}
    </div>
  );
}
