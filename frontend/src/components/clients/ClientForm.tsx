'use client';

import { useState } from 'react';
import { isEmail } from '@/lib/calendar';
import { isValidRut } from '@/lib/rut';
import type { Client } from '@/lib/types';
import { Field } from '../Field';

/** Valores del formulario: todo texto; vacío significa "sin dato". */
export interface ClientFormValues {
  name: string;
  rut: string;
  claveUnica: string;
  address: string;
  email: string;
  phone: string;
  occupation: string;
  maritalStatus: string;
  matter: string;
  defendantName: string;
  defendantRut: string;
  defendantAddress: string;
  defendantIncome: string;
  caseHistory: string;
}

export const EMPTY_CLIENT: ClientFormValues = {
  name: '', rut: '', claveUnica: '', address: '', email: '', phone: '', occupation: '', maritalStatus: '',
  matter: '', defendantName: '', defendantRut: '', defendantAddress: '', defendantIncome: '', caseHistory: '',
};

export function valuesOf(c: Client): ClientFormValues {
  const v = { ...EMPTY_CLIENT };
  for (const k of Object.keys(v) as (keyof ClientFormValues)[]) v[k] = c[k] ?? '';
  return v;
}

/** Cuerpo para la API: lo vacío viaja como `null` para poder borrar un dato. */
export function payloadOf(v: ClientFormValues) {
  const out: Record<string, string | null> = {};
  for (const k of Object.keys(v) as (keyof ClientFormValues)[]) {
    const t = k === 'caseHistory' ? v[k] : v[k].trim();
    out[k] = k === 'name' || k === 'caseHistory' ? t : t || null;
  }
  return out;
}

const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Conviviente civil', 'Separado/a', 'Divorciado/a', 'Viudo/a'];

type Errors = Partial<Record<keyof ClientFormValues, string>>;

function validate(v: ClientFormValues): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = 'Escribe el nombre del cliente.';
  if (v.rut.trim() && !isValidRut(v.rut)) e.rut = 'El RUT no es válido. Revisa el dígito verificador.';
  if (v.email.trim() && !isEmail(v.email.trim())) e.email = 'Escribe un correo válido, por ejemplo nombre@correo.cl.';
  if (v.defendantRut.trim() && !isValidRut(v.defendantRut)) e.defendantRut = 'El RUT no es válido. Revisa el dígito verificador.';
  return e;
}

/**
 * Ficha del cliente, compartida por «Nuevo cliente» y «Editar». No guarda por sí sola:
 * al enviar (si es válida) avisa al padre, que pide la confirmación.
 */
export function ClientForm({
  initial,
  submitLabel,
  error,
  onSubmit,
  onCancel,
}: {
  initial: ClientFormValues;
  submitLabel: string;
  /** Error devuelto por el servidor al guardar (p. ej. correo repetido) */
  error?: string;
  onSubmit: (v: ClientFormValues) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const bind = (k: keyof ClientFormValues) => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(v);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <section aria-labelledby="cf-cliente" className="space-y-4">
        <h2 id="cf-cliente" className="section-label">Cliente</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" error={errors.name} className="sm:col-span-2">
            {(p) => <input {...p} required autoFocus maxLength={200} className="w-full" {...bind('name')} />}
          </Field>
          <Field label="RUT" error={errors.rut} hint="Con o sin puntos y guion: 12.345.678-5">
            {(p) => <input {...p} maxLength={30} className="w-full" {...bind('rut')} />}
          </Field>
          <Field label="Clave Única" hint="Se guarda y se muestra en texto claro.">
            {(p) => <input {...p} type="text" autoComplete="off" maxLength={200} className="w-full" {...bind('claveUnica')} />}
          </Field>
          <Field label="Domicilio" className="sm:col-span-2">
            {(p) => <input {...p} maxLength={300} className="w-full" {...bind('address')} />}
          </Field>
          <Field label="Correo electrónico" error={errors.email} hint="No recibe avisos: sirve para identificarlo en el calendario.">
            {(p) => <input {...p} type="email" inputMode="email" maxLength={320} className="w-full" {...bind('email')} />}
          </Field>
          <Field label="Teléfono">
            {(p) => <input {...p} type="tel" inputMode="tel" maxLength={40} className="w-full" {...bind('phone')} />}
          </Field>
          <Field label="Profesión u oficio">
            {(p) => <input {...p} maxLength={150} className="w-full" {...bind('occupation')} />}
          </Field>
          <Field label="Estado civil">
            {(p) => (
              <>
                <input {...p} list="cf-estados-civiles" maxLength={40} className="w-full" {...bind('maritalStatus')} />
                <datalist id="cf-estados-civiles">{ESTADOS_CIVILES.map((s) => <option key={s} value={s} />)}</datalist>
              </>
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="cf-caso" className="space-y-4">
        <h2 id="cf-caso" className="section-label">Caso</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Materia, juicio o servicio">
            {(p) => <input {...p} maxLength={300} className="w-full" {...bind('matter')} />}
          </Field>
          <Field label="Historia del caso">
            {(p) => <textarea {...p} rows={8} maxLength={100000} className="w-full resize-y" {...bind('caseHistory')} />}
          </Field>
        </div>
      </section>

      <section aria-labelledby="cf-demandado" className="space-y-4">
        <h2 id="cf-demandado" className="section-label">Demandado</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre del demandado">
            {(p) => <input {...p} maxLength={200} className="w-full" {...bind('defendantName')} />}
          </Field>
          <Field label="RUT del demandado" error={errors.defendantRut}>
            {(p) => <input {...p} maxLength={30} className="w-full" {...bind('defendantRut')} />}
          </Field>
          <Field label="Domicilio del demandado" className="sm:col-span-2">
            {(p) => <input {...p} maxLength={300} className="w-full" {...bind('defendantAddress')} />}
          </Field>
          <Field label="Ingresos aproximados del demandado" hint="Texto libre, por ejemplo «$800.000 aprox.»">
            {(p) => <input {...p} maxLength={100} className="w-full" {...bind('defendantIncome')} />}
          </Field>
        </div>
      </section>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-red-700">Revisa los campos marcados antes de continuar.</p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="btn">Cancelar</button>}
        <button className="btn-accent">{submitLabel}</button>
      </div>
    </form>
  );
}
