import { slugify, storageKey } from './storage-key';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

describe('slugify', () => {
  it('quita tildes, pasa a minúsculas y une con guiones', () => {
    expect(slugify('Acta Reunión Nº 3 (versión final)')).toBe('acta-reunion-n-3-version-final');
  });

  it('recorta sin dejar guiones en los extremos', () => {
    expect(slugify('  ¡Hola!  ')).toBe('hola');
    expect(slugify('a'.repeat(59) + ' b', 60)).toBe('a'.repeat(59));
  });
});

describe('storageKey', () => {
  it('arma prefijo, uuid, nombre legible y extensión', () => {
    expect(storageKey('clientes/abc', 'Contrato Arriendo.PDF')).toMatch(new RegExp(`^clientes/abc/${UUID}-contrato-arriendo\\.pdf$`));
  });

  it('sin nombre aprovechable queda solo el uuid', () => {
    expect(storageKey('notas/n1', '日本.png')).toMatch(new RegExp(`^notas/n1/${UUID}\\.png$`));
    expect(storageKey('tareas/t1', 'sin-extension')).toMatch(new RegExp(`^tareas/t1/${UUID}-sin-extension$`));
  });

  it('dos subidas del mismo archivo no chocan', () => {
    expect(storageKey('x', 'a.txt')).not.toBe(storageKey('x', 'a.txt'));
  });
});
