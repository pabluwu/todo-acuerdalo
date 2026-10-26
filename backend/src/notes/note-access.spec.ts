import { accessFor, canDeleteNote, canEditNote, canManageFolder, canMoveNote, folderFitsNote } from './note-access';

const common = { visibility: 'common' as const, ownerId: 'autor' };
const priv = { visibility: 'private' as const, ownerId: 'dueno' };

describe('accessFor', () => {
  it('en notas comunes el autor es owner y los demás editan', () => {
    expect(accessFor(common, 'autor')).toBe('owner');
    expect(accessFor(common, 'otro')).toBe('edit');
  });

  it('en notas privadas el dueño es owner', () => {
    expect(accessFor(priv, 'dueno')).toBe('owner');
  });

  it('en notas privadas se respeta el permiso compartido', () => {
    expect(accessFor(priv, 'ana', { permission: 'view' })).toBe('view');
    expect(accessFor(priv, 'ana', { permission: 'edit' })).toBe('edit');
  });

  it('en notas privadas sin permiso no hay acceso', () => {
    expect(accessFor(priv, 'ana')).toBe('none');
    expect(accessFor(priv, 'ana', null)).toBe('none');
  });

  it('una nota sin dueño (usuario eliminado) no da owner a nadie', () => {
    expect(accessFor({ visibility: 'private', ownerId: null }, 'ana')).toBe('none');
    expect(accessFor({ visibility: 'common', ownerId: null }, 'ana')).toBe('edit');
  });
});

describe('canDeleteNote', () => {
  it('en comunes borran el autor o un admin', () => {
    expect(canDeleteNote(common, 'autor', 'user')).toBe(true);
    expect(canDeleteNote(common, 'otro', 'admin')).toBe(true);
    expect(canDeleteNote(common, 'otro', 'user')).toBe(false);
  });

  it('en privadas borra solo el dueño, no un admin', () => {
    expect(canDeleteNote(priv, 'dueno', 'user')).toBe(true);
    expect(canDeleteNote(priv, 'admin1', 'admin')).toBe(false);
    expect(canDeleteNote(priv, 'ana', 'user')).toBe(false);
  });
});

describe('canEditNote', () => {
  it('permite editar a owner y edit, no a view ni none', () => {
    expect(canEditNote('owner')).toBe(true);
    expect(canEditNote('edit')).toBe(true);
    expect(canEditNote('view')).toBe(false);
    expect(canEditNote('none')).toBe(false);
  });
});

describe('carpetas de notas', () => {
  const commonFolder = { visibility: 'common' as const, ownerId: null };
  const myFolder = { visibility: 'private' as const, ownerId: 'dueno' };

  it('las carpetas comunes las administra cualquiera; las privadas solo su dueño', () => {
    expect(canManageFolder(commonFolder, 'ana')).toBe(true);
    expect(canManageFolder(myFolder, 'dueno')).toBe(true);
    expect(canManageFolder(myFolder, 'ana')).toBe(false);
  });

  it('mueve una nota común quien la edita; una privada, solo el dueño', () => {
    expect(canMoveNote(common, 'edit')).toBe(true);
    expect(canMoveNote(priv, 'owner')).toBe(true);
    expect(canMoveNote(priv, 'edit')).toBe(false);
    expect(canMoveNote(priv, 'view')).toBe(false);
  });

  it('una nota solo cabe en carpetas de su pestaña y, si es privada, de su dueño', () => {
    expect(folderFitsNote(commonFolder, common)).toBe(true);
    expect(folderFitsNote(commonFolder, priv)).toBe(false);
    expect(folderFitsNote(myFolder, priv)).toBe(true);
    expect(folderFitsNote(myFolder, common)).toBe(false);
    expect(folderFitsNote({ visibility: 'private', ownerId: 'ana' }, priv)).toBe(false);
    expect(folderFitsNote(myFolder, { visibility: 'private', ownerId: null })).toBe(false);
  });
});
