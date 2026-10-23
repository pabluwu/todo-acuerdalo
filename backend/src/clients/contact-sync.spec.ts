import { planContactSync } from './contact-sync';

const base = { clientId: 'c1', name: 'Ana Pérez', email: 'ana@t.com' as string | null, linked: null, byEmail: null };

describe('planContactSync', () => {
  it('crea el contacto si el cliente no tiene uno ni el correo existe', () => {
    expect(planContactSync(base)).toEqual({ kind: 'create', name: 'Ana Pérez', email: 'ana@t.com' });
  });

  it('crea el contacto aunque el cliente no tenga correo', () => {
    expect(planContactSync({ ...base, email: null })).toEqual({ kind: 'create', name: 'Ana Pérez', email: null });
  });

  it('actualiza el contacto ya vinculado (nombre y correo)', () => {
    const linked = { id: 'x1', clientId: 'c1' };
    expect(planContactSync({ ...base, linked, byEmail: linked })).toEqual({ kind: 'update', contactId: 'x1', name: 'Ana Pérez', email: 'ana@t.com' });
    expect(planContactSync({ ...base, linked, email: 'nuevo@t.com' })).toEqual({ kind: 'update', contactId: 'x1', name: 'Ana Pérez', email: 'nuevo@t.com' });
  });

  it('al quitar el correo, el contacto vinculado queda sin correo', () => {
    const linked = { id: 'x1', clientId: 'c1' };
    expect(planContactSync({ ...base, email: null, linked })).toEqual({ kind: 'update', contactId: 'x1', name: 'Ana Pérez', email: null });
  });

  it('adopta un contacto suelto con el mismo correo', () => {
    const byEmail = { id: 'x2', clientId: null };
    expect(planContactSync({ ...base, byEmail })).toEqual({ kind: 'adopt', contactId: 'x2', name: 'Ana Pérez', email: 'ana@t.com' });
  });

  it('rechaza el correo de un contacto que pertenece a otro cliente', () => {
    const byEmail = { id: 'x3', clientId: 'c2', clientName: 'Luis Soto' };
    expect(planContactSync({ ...base, byEmail })).toEqual({ kind: 'conflict', message: 'Ese correo ya pertenece al cliente Luis Soto' });
  });

  it('rechaza el correo de otro cliente aunque el cliente ya tenga su contacto', () => {
    const byEmail = { id: 'x3', clientId: 'c2', clientName: 'Luis Soto' };
    const plan = planContactSync({ ...base, linked: { id: 'x1', clientId: 'c1' }, byEmail });
    expect(plan.kind).toBe('conflict');
  });

  it('no adopta un contacto suelto si el cliente ya tiene el suyo', () => {
    const plan = planContactSync({ ...base, linked: { id: 'x1', clientId: 'c1' }, byEmail: { id: 'x2', clientId: null } });
    expect(plan).toEqual({ kind: 'conflict', message: 'Ya existe un contacto externo con ese correo' });
  });
});
