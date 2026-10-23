/** Contacto externo reducido a lo que decide la sincronización. */
export interface SyncContact {
  id: string;
  clientId: string | null;
}

export type ContactSyncPlan =
  | { kind: 'update'; contactId: string; name: string; email: string | null }
  | { kind: 'adopt'; contactId: string; name: string; email: string }
  | { kind: 'create'; name: string; email: string | null }
  | { kind: 'conflict'; message: string };

/**
 * Decide cómo dejar sincronizado el contacto externo de un cliente (sin tocar la base):
 * - `linked`: el contacto ya vinculado a este cliente, si existe.
 * - `byEmail`: el contacto que ya tiene ese correo (con el nombre del cliente dueño, si lo tiene).
 * El correo de un contacto es único, así que un correo ajeno impide la sincronización.
 */
export function planContactSync(input: {
  clientId: string;
  name: string;
  email: string | null;
  linked: SyncContact | null;
  byEmail: (SyncContact & { clientName?: string | null }) | null;
}): ContactSyncPlan {
  const { clientId, name, email, linked, byEmail } = input;
  if (email && byEmail && byEmail.id !== linked?.id) {
    if (byEmail.clientId && byEmail.clientId !== clientId) {
      return { kind: 'conflict', message: `Ese correo ya pertenece al cliente ${byEmail.clientName ?? 'otro cliente'}` };
    }
    // un contacto suelto con ese correo solo se adopta si el cliente aún no tiene el suyo
    if (linked) return { kind: 'conflict', message: 'Ya existe un contacto externo con ese correo' };
    return { kind: 'adopt', contactId: byEmail.id, name, email };
  }
  return linked ? { kind: 'update', contactId: linked.id, name, email } : { kind: 'create', name, email };
}
