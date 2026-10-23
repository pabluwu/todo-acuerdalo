// Misma lógica que backend/src/clients/rut.ts: validar en el formulario antes de enviar.
/**
 * RUT chileno. `normalizeRut` deja el formato canónico `12345678-5` (sin puntos,
 * con guion y K en mayúscula); `isValidRut` comprueba el dígito verificador (módulo 11).
 */
export function normalizeRut(input: string): string {
  const clean = input.replace(/[.\-\s]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

export function isValidRut(input: string): boolean {
  const rut = normalizeRut(input);
  const m = /^(\d{1,8})-([\dK])$/.exec(rut);
  if (!m) return false;
  let sum = 0;
  let factor = 2;
  for (let i = m[1].length - 1; i >= 0; i--) {
    sum += Number(m[1][i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  const dv = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest);
  return dv === m[2];
}
