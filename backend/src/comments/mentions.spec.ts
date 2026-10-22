import { mentionEmail } from '../mail/templates';
import { normalizeMentionIds } from './mentions';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ME = '33333333-3333-4333-8333-333333333333';

describe('normalizeMentionIds', () => {
  it('acepta un string suelto', () => {
    expect(normalizeMentionIds(A, ME)).toEqual([A]);
  });
  it('acepta un array', () => {
    expect(normalizeMentionIds([A, B], ME)).toEqual([A, B]);
  });
  it('devuelve vacío sin valor', () => {
    expect(normalizeMentionIds(undefined, ME)).toEqual([]);
  });
  it('quita duplicados e inválidos', () => {
    expect(normalizeMentionIds([A, A.toUpperCase(), 'no-uuid', '', ' ' + B + ' '], ME)).toEqual([A, B]);
  });
  it('excluye al autor', () => {
    expect(normalizeMentionIds([ME, A], ME)).toEqual([A]);
  });
  it('limita a 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(normalizeMentionIds(many, ME)).toHaveLength(50);
  });
});

describe('mentionEmail', () => {
  it('escapa el HTML del comentario y arma asunto y enlace', () => {
    const { subject, html } = mentionEmail('https://app.test/', { id: 't1', title: 'Tarea <x>' }, 'Ana', {
      body: 'Hola <script>alert(1)</script> @Luis',
      attachmentNames: ['a&b.pdf'],
    });
    expect(subject).toBe('Ana te mencionó en: Tarea <x>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; @Luis');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('a&amp;b.pdf');
    expect(html).toContain('https://app.test/tasks/t1');
  });
});
