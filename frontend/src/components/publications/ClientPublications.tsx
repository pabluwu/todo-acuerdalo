'use client';

import { Megaphone, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { PublicationSummary } from '@/lib/types';
import { EmptyState } from '../EmptyState';
import { ListSkeleton } from '../Skeletons';
import { PubRow } from './PubBits';
import { PublicationDialog } from './PublicationDialog';

/** Publicaciones del cliente, de la más próxima a la más lejana. */
export function ClientPublications({ clientId }: { clientId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<PublicationSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<PublicationSummary[]>(`/publications?clientId=${clientId}`)
      .then((r) => setItems([...r].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))))
      .catch((e) => { toast((e as Error).message); setItems([]); });
  }, [clientId, toast]);
  useEffect(load, [load]);

  const newButton = <button type="button" className="btn-accent" onClick={() => setCreating(true)}><Plus {...icon} /> Nueva publicación</button>;

  return (
    <div className="space-y-5">
      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Este cliente no tiene publicaciones" action={newButton}>
          Planifica un video o un post, súbelo a revisión y el equipo lo aprueba antes de publicar.
        </EmptyState>
      ) : (
        <>
          <div className="flex justify-end">{newButton}</div>
          <ul className="card-surface divide-y divide-zinc-100 overflow-hidden">
            {items.map((p) => <li key={p.id}><PubRow pub={p} showDate /></li>)}
          </ul>
        </>
      )}
      {creating && (
        <PublicationDialog
          initialClientId={clientId}
          onClose={() => setCreating(false)}
          onSaved={(p) => { setCreating(false); toast('Idea creada', 'success'); router.push(`/publicaciones/${p.id}`); }}
        />
      )}
    </div>
  );
}
