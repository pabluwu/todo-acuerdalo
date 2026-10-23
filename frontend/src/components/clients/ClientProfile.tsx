'use client';

import { Check, Copy, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, formatDate } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Client } from '@/lib/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { ClientForm, payloadOf, valuesOf, type ClientFormValues } from './ClientForm';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-3 sm:gap-4">
      <dt className="text-xs text-zinc-500 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-zinc-900 sm:col-span-2">
        {children || <span className="text-zinc-400">Sin dato</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="section-label">{title}</h2>
      <dl className="divide-y divide-zinc-100">{children}</dl>
    </section>
  );
}

/** Ficha en lectura; «Editar» abre el formulario y «Guardar» pide confirmación. */
export function ClientProfile({ client, onChange }: { client: Client; onChange: (c: Client) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<ClientFormValues | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      onChange(await api<Client>(`/clients/${client.id}`, { method: 'PATCH', body: payloadOf(pending) }));
      setEditing(false);
      toast('Ficha guardada', 'success');
    } catch (err) {
      setError((err as Error).message);
    }
    setPending(null);
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/clients/${client.id}`, { method: 'DELETE' });
      toast('Cliente eliminado', 'success');
      router.push('/clients');
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function copyClave() {
    if (!client.claveUnica) return;
    try {
      await navigator.clipboard.writeText(client.claveUnica);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('No se pudo copiar la clave');
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        <ClientForm
          initial={valuesOf(client)}
          submitLabel="Guardar"
          error={error}
          onSubmit={setPending}
          onCancel={() => { setEditing(false); setError(''); }}
        />
        {pending && (
          <ConfirmDialog
            title="¿Guardar los cambios?"
            confirmLabel="Guardar"
            busyLabel="Guardando…"
            busy={busy}
            onConfirm={save}
            onCancel={() => setPending(null)}
          >
            Se actualizará la ficha de {client.name}. Si cambiaste el nombre o el correo, también se verá así en el calendario.
          </ConfirmDialog>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Editada {formatDate(client.updatedAt)}{client.updatedBy ? ` por ${client.updatedBy.name}` : ''}
          </p>
          <button onClick={() => setEditing(true)} className="btn"><Pencil {...icon} /> Editar</button>
        </div>
        <div className="space-y-8">
          <Section title="Cliente">
            <Row label="Nombre">{client.name}</Row>
            <Row label="RUT">{client.rut}</Row>
            <Row label="Clave Única">
              {client.claveUnica && (
                <span className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px]">{client.claveUnica}</code>
                  <button type="button" onClick={copyClave} className="btn-ghost btn-sm" aria-label="Copiar la Clave Única">
                    {copied ? <Check {...icon} className="text-emerald-600" /> : <Copy {...icon} />} {copied ? 'Copiada' : 'Copiar'}
                  </button>
                </span>
              )}
            </Row>
            <Row label="Domicilio">{client.address}</Row>
            <Row label="Correo electrónico">{client.email && <a href={`mailto:${client.email}`} className="text-accent hover:underline">{client.email}</a>}</Row>
            <Row label="Teléfono">{client.phone && <a href={`tel:${client.phone}`} className="text-accent hover:underline">{client.phone}</a>}</Row>
            <Row label="Profesión u oficio">{client.occupation}</Row>
            <Row label="Estado civil">{client.maritalStatus}</Row>
          </Section>
          <Section title="Caso">
            <Row label="Materia, juicio o servicio">{client.matter}</Row>
            <Row label="Historia del caso">{client.caseHistory.trim() && <span className="whitespace-pre-wrap">{client.caseHistory}</span>}</Row>
          </Section>
          <Section title="Demandado">
            <Row label="Nombre">{client.defendantName}</Row>
            <Row label="RUT">{client.defendantRut}</Row>
            <Row label="Domicilio">{client.defendantAddress}</Row>
            <Row label="Ingresos aproximados">{client.defendantIncome}</Row>
          </Section>
        </div>
        <p className="mt-8 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
          Registrado {formatDate(client.createdAt)}{client.createdBy ? ` por ${client.createdBy.name}` : ''}.
        </p>
      </div>

      {user?.role === 'admin' && (
        <div className="mt-4 flex justify-end">
          <button onClick={() => setConfirmDelete(true)} className="btn-danger"><Trash2 {...icon} /> Eliminar cliente</button>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar este cliente?"
          tone="danger"
          confirmLabel="Eliminar cliente"
          busyLabel="Eliminando…"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        >
          «{client.name}» se eliminará para siempre, junto con todas sus notas y sus archivos. Seguirá apareciendo en los eventos pasados del calendario, pero ya sin ficha.
        </ConfirmDialog>
      )}
    </div>
  );
}
