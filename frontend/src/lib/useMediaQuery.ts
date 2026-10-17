'use client';

import { useEffect, useState } from 'react';

/** `null` hasta montar: así el primer render del cliente coincide con el del servidor. */
export function useMediaQuery(query: string): boolean | null {
  const [m, setM] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return m;
}

export const useMobile = () => useMediaQuery('(max-width: 767px)');
