import { parseRange } from './range';

describe('parseRange', () => {
  it('sin cabecera o ilegible devuelve null', () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange('', 100)).toBeNull();
    expect(parseRange('items=0-5', 100)).toBeNull();
    expect(parseRange('bytes=a-b', 100)).toBeNull();
    expect(parseRange('bytes=-', 100)).toBeNull();
    expect(parseRange('bytes=0-5,10-20', 100)).toBeNull();
  });

  it('rango cerrado', () => {
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=10-10', 100)).toEqual({ start: 10, end: 10 });
  });

  it('rango abierto hasta el final', () => {
    expect(parseRange('bytes=50-', 100)).toEqual({ start: 50, end: 99 });
  });

  it('sufijo: últimos N bytes', () => {
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=-0', 100)).toBe('unsatisfiable');
  });

  it('recorta el final al tamaño', () => {
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
  });

  it('inicio fuera del archivo es insatisfacible', () => {
    expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=200-300', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=0-5', 0)).toBe('unsatisfiable');
  });

  it('fin menor que inicio es inválido y se ignora', () => {
    expect(parseRange('bytes=10-5', 100)).toBeNull();
  });
});
