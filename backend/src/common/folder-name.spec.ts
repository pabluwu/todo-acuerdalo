import { validateFolderName } from './folder-name';

describe('validateFolderName', () => {
  it('recorta los espacios y acepta nombres con tildes, números y puntos', () => {
    expect(validateFolderName('  Escritos 2026  ')).toEqual({ name: 'Escritos 2026' });
    expect(validateFolderName('Demanda año.1')).toEqual({ name: 'Demanda año.1' });
  });

  it('rechaza vacío, solo espacios y valores que no son texto', () => {
    expect(validateFolderName('').error).toBeDefined();
    expect(validateFolderName('   ').error).toBeDefined();
    expect(validateFolderName(undefined).error).toBeDefined();
    expect(validateFolderName(42).error).toBeDefined();
  });

  it('rechaza más de 150 caracteres, pero acepta exactamente 150', () => {
    expect(validateFolderName('a'.repeat(150)).name).toHaveLength(150);
    expect(validateFolderName('a'.repeat(151)).error).toMatch(/150/);
  });

  it('el máximo es configurable (nombres de archivo)', () => {
    expect(validateFolderName('a'.repeat(300), 300).name).toHaveLength(300);
    expect(validateFolderName('a'.repeat(301), 300).error).toBeDefined();
  });

  it('rechaza barras y contrabarras', () => {
    expect(validateFolderName('a/b').error).toBeDefined();
    expect(validateFolderName('a\\b').error).toBeDefined();
  });

  it('rechaza . y ..', () => {
    expect(validateFolderName('.').error).toBeDefined();
    expect(validateFolderName(' .. ').error).toBeDefined();
  });
});
