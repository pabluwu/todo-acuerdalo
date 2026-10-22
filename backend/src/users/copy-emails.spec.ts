import { normalizeCopyEmails } from './copy-emails';

describe('normalizeCopyEmails', () => {
  it('recorta, pasa a minúsculas y quita duplicados', () => {
    expect(normalizeCopyEmails([' A@x.com', 'a@x.com', 'b@x.com '], 'me@x.com')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('quita el propio correo del usuario', () => {
    expect(normalizeCopyEmails(['ME@x.com', 'a@x.com'], 'me@x.com')).toEqual(['a@x.com']);
  });

  it('devuelve lista vacía si no hay correos', () => {
    expect(normalizeCopyEmails([], 'me@x.com')).toEqual([]);
  });
});
