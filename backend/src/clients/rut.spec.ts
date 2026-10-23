import { isValidRut, normalizeRut } from './rut';

describe('normalizeRut', () => {
  it('quita puntos y espacios y deja el guion antes del dígito verificador', () => {
    expect(normalizeRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeRut(' 12345678 5 ')).toBe('12345678-5');
    expect(normalizeRut('123456785')).toBe('12345678-5');
  });

  it('pone la K en mayúscula', () => {
    expect(normalizeRut('6.000.000-k')).toBe('6000000-K');
  });

  it('no inventa guiones en textos demasiado cortos', () => {
    expect(normalizeRut('5')).toBe('5');
    expect(normalizeRut('')).toBe('');
  });
});

describe('isValidRut', () => {
  it('acepta RUT con dígito verificador correcto, con o sin formato', () => {
    expect(isValidRut('12345678-5')).toBe(true);
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('11.111.111-1')).toBe(true);
    expect(isValidRut('7.000.000-8')).toBe(true);
  });

  it('acepta dígito verificador K (en cualquier caja) y 0', () => {
    expect(isValidRut('6000000-K')).toBe(true);
    expect(isValidRut('6.000.000-k')).toBe(true);
    expect(isValidRut('6000005-0')).toBe(true);
  });

  it('rechaza dígito verificador incorrecto', () => {
    expect(isValidRut('12345678-9')).toBe(false);
    expect(isValidRut('11111111-2')).toBe(false);
  });

  it('rechaza textos que no son un RUT', () => {
    expect(isValidRut('')).toBe(false);
    expect(isValidRut('abc')).toBe(false);
    expect(isValidRut('-')).toBe(false);
    expect(isValidRut('123456789012-3')).toBe(false);
  });
});
