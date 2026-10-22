const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_MENTIONS = 50;

/** Normaliza los IDs etiquetados: multipart llega como string suelto o array. Solo UUID válidos, sin duplicados ni el propio autor. */
export function normalizeMentionIds(raw: string | string[] | undefined | null, actorId: string): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out = new Set<string>();
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const id = item.trim().toLowerCase();
    if (!UUID_RE.test(id) || id === actorId.toLowerCase()) continue;
    out.add(id);
    if (out.size >= MAX_MENTIONS) break;
  }
  return [...out];
}
