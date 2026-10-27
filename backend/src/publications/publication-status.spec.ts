import {
  allApproved, approvalCounts, canDecide, canUploadVersion, normalizePlatforms, reconcileStatus, reorderIds,
  statusAfterUpload, transition, validateVersionFiles,
} from './publication-status';

const rev = (userId: string, isActive = true) => ({ userId, isActive });
const dec = (userId: string, decision: 'aprobada' | 'cambios' = 'aprobada') => ({ userId, decision });

describe('approvalCounts / allApproved', () => {
  it('cuenta solo aprobaciones de revisores activos', () => {
    const reviewers = [rev('a'), rev('b'), rev('c', false)];
    expect(approvalCounts(reviewers, [dec('a'), dec('c')])).toEqual({ approved: 1, total: 2 });
  });

  it('"cambios" no cuenta como aprobación', () => {
    expect(approvalCounts([rev('a'), rev('b')], [dec('a'), dec('b', 'cambios')])).toEqual({ approved: 1, total: 2 });
  });

  it('ignora decisiones de quien ya no es revisor', () => {
    expect(approvalCounts([rev('a')], [dec('x')])).toEqual({ approved: 0, total: 1 });
  });

  it('todos aprobaron', () => {
    expect(allApproved([rev('a'), rev('b')], [dec('a'), dec('b')])).toBe(true);
  });

  it('falta alguien', () => {
    expect(allApproved([rev('a'), rev('b')], [dec('a')])).toBe(false);
  });

  it('sin revisores activos nunca está aprobado', () => {
    expect(allApproved([], [])).toBe(false);
    expect(allApproved([rev('a', false)], [dec('a')])).toBe(false);
  });

  it('un revisor inactivo no bloquea', () => {
    expect(allApproved([rev('a'), rev('b', false)], [dec('a')])).toBe(true);
  });
});

describe('statusAfterUpload / canUploadVersion / canDecide', () => {
  it('la primera versión saca de idea', () => {
    expect(statusAfterUpload('idea')).toBe('edicion');
    expect(statusAfterUpload('edicion')).toBe('edicion');
  });

  it('solo se sube en idea o edición', () => {
    expect(canUploadVersion('idea')).toBe(true);
    expect(canUploadVersion('edicion')).toBe(true);
    expect(canUploadVersion('por_publicar')).toBe(false);
    expect(canUploadVersion('publicada')).toBe(false);
    expect(canUploadVersion('cancelada')).toBe(false);
  });

  it('solo se decide en edición', () => {
    expect(canDecide('edicion')).toBe(true);
    expect(canDecide('idea')).toBe(false);
    expect(canDecide('por_publicar')).toBe(false);
  });
});

describe('reconcileStatus', () => {
  const base = { hasVersion: true, reviewers: [rev('a'), rev('b')], latestDecisions: [dec('a'), dec('b')] };

  it('edición con todos aprobados pasa a por publicar', () => {
    expect(reconcileStatus('edicion', base)).toBe('por_publicar');
  });

  it('edición con aprobaciones incompletas se queda', () => {
    expect(reconcileStatus('edicion', { ...base, latestDecisions: [dec('a')] })).toBe('edicion');
  });

  it('sin versión no avanza', () => {
    expect(reconcileStatus('edicion', { ...base, hasVersion: false })).toBe('edicion');
  });

  it('sin revisores activos no avanza', () => {
    expect(reconcileStatus('edicion', { ...base, reviewers: [] })).toBe('edicion');
  });

  it('al desactivar al único pendiente avanza', () => {
    expect(reconcileStatus('edicion', { ...base, reviewers: [rev('a'), rev('b', false)], latestDecisions: [dec('a')] })).toBe('por_publicar');
  });

  it('otros estados no cambian', () => {
    for (const s of ['idea', 'por_publicar', 'publicada', 'cancelada'] as const) expect(reconcileStatus(s, base)).toBe(s);
  });
});

describe('transition', () => {
  it('publicar solo desde por publicar y fija la fecha', () => {
    expect(transition('por_publicar', 'publish', null)).toMatchObject({ ok: true, status: 'publicada', setPublishedAt: true });
    for (const s of ['idea', 'edicion', 'publicada', 'cancelada'] as const) expect(transition(s, 'publish', null).ok).toBe(false);
  });

  it('cancelar desde cualquier estado menos cancelada, guardando el origen', () => {
    for (const s of ['idea', 'edicion', 'por_publicar', 'publicada'] as const) {
      expect(transition(s, 'cancel', null)).toMatchObject({ ok: true, status: 'cancelada', cancelledFrom: s });
    }
    expect(transition('cancelada', 'cancel', 'idea').ok).toBe(false);
  });

  it('reactivar vuelve al estado de origen y lo limpia', () => {
    expect(transition('cancelada', 'restore', 'edicion')).toMatchObject({ ok: true, status: 'edicion', cancelledFrom: null });
    expect(transition('cancelada', 'restore', 'por_publicar')).toMatchObject({ ok: true, status: 'por_publicar' });
  });

  it('reactivar sin origen válido cae en idea', () => {
    expect(transition('cancelada', 'restore', null)).toMatchObject({ ok: true, status: 'idea' });
    expect(transition('cancelada', 'restore', 'cancelada')).toMatchObject({ ok: true, status: 'idea' });
    expect(transition('cancelada', 'restore', 'basura')).toMatchObject({ ok: true, status: 'idea' });
  });

  it('reactivar solo desde cancelada', () => {
    expect(transition('edicion', 'restore', null).ok).toBe(false);
  });

  it('reabrir solo desde por publicar y limpia aprobaciones', () => {
    expect(transition('por_publicar', 'reopen', null)).toMatchObject({ ok: true, status: 'edicion', clearApprovals: true });
    for (const s of ['idea', 'edicion', 'publicada', 'cancelada'] as const) expect(transition(s, 'reopen', null).ok).toBe(false);
  });

  it('los rechazos traen mensaje en español', () => {
    const r = transition('idea', 'publish', null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Por publicar/);
  });
});

describe('normalizePlatforms', () => {
  it('por defecto: video en ambas, post en instagram', () => {
    expect(normalizePlatforms('video', undefined)).toEqual(['tiktok', 'reels']);
    expect(normalizePlatforms('post', null)).toEqual(['instagram']);
  });

  it('subconjuntos válidos, sin duplicados y en orden estable', () => {
    expect(normalizePlatforms('video', ['reels'])).toEqual(['reels']);
    expect(normalizePlatforms('post', ['facebook', 'instagram', 'facebook'])).toEqual(['instagram', 'facebook']);
  });

  it('rechaza vacío o de otro formato', () => {
    expect(normalizePlatforms('video', [])).toBeNull();
    expect(normalizePlatforms('video', ['instagram'])).toBeNull();
    expect(normalizePlatforms('post', ['tiktok'])).toBeNull();
  });
});

describe('validateVersionFiles', () => {
  const img = { mimeType: 'image/png' };
  const vid = { mimeType: 'video/mp4' };

  it('video: exactamente un archivo de video', () => {
    expect(validateVersionFiles('video', [vid])).toBeNull();
    expect(validateVersionFiles('video', [])).not.toBeNull();
    expect(validateVersionFiles('video', [vid, vid])).not.toBeNull();
    expect(validateVersionFiles('video', [img])).not.toBeNull();
  });

  it('post: de 1 a 20 imágenes', () => {
    expect(validateVersionFiles('post', [img])).toBeNull();
    expect(validateVersionFiles('post', Array(20).fill(img))).toBeNull();
    expect(validateVersionFiles('post', Array(21).fill(img))).not.toBeNull();
    expect(validateVersionFiles('post', [])).not.toBeNull();
    expect(validateVersionFiles('post', [img, vid])).not.toBeNull();
  });
});

describe('reorderIds', () => {
  it('acepta una permutación', () => {
    expect(reorderIds(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('rechaza faltantes, extras y repetidos', () => {
    expect(reorderIds(['a', 'b'], ['a'])).toBeNull();
    expect(reorderIds(['a', 'b'], ['a', 'x'])).toBeNull();
    expect(reorderIds(['a', 'b'], ['a', 'a'])).toBeNull();
  });
});
