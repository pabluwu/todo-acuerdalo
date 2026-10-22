/** Limpia la lista de copias: recorta, pasa a minúsculas, quita duplicados y el propio correo del usuario. */
export function normalizeCopyEmails(emails: string[], ownEmail: string): string[] {
  const own = ownEmail.trim().toLowerCase();
  const seen = new Set<string>();
  for (const e of emails) {
    const v = e.trim().toLowerCase();
    if (v && v !== own) seen.add(v);
  }
  return [...seen];
}
