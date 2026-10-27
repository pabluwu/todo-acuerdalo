'use client';

import type { DatesSetArg, DayCellMountArg, EventContentArg, EventDropArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, List, Megaphone, Plus, UserCheck, Columns3 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { addDaysStr, localDateStr, pad, parseLocalDate } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import { FORMAT_META, PUB_STATUSES, pubMeta, pubStatus, pubTime } from '@/lib/publications';
import { useToast } from '@/lib/toast';
import { useMobile } from '@/lib/useMediaQuery';
import type { ClientSummary, PublicationFormat, PublicationSummary } from '@/lib/types';
import { FilterPill } from '../FilterPill';
import { AgendaSkeleton, CalendarSkeleton } from '../Skeletons';
import { weekStartOf } from '../calendar/AgendaView';
import { ApprovalBar } from './PubBits';
import { PublicationAgenda } from './PublicationAgenda';
import { PublicationDialog } from './PublicationDialog';
import { PublicationRail } from './PublicationRail';

type View = 'mes' | 'flujo' | 'lista';
const VIEWS: View[] = ['mes', 'flujo', 'lista'];
const VIEW_META: Record<View, { label: string; icon: typeof List }> = {
  mes: { label: 'Mes', icon: CalendarDays },
  flujo: { label: 'Flujo', icon: Columns3 },
  lista: { label: 'Lista', icon: List },
};
const PLUGINS = [dayGridPlugin, interactionPlugin];
const LOCALES = [esLocale];
const TIME_FMT = { hour: '2-digit', minute: '2-digit', hour12: false } as const;
const DAY_HEADER_FMT = { weekday: 'short' } as const;
const moreText = (a: { num: number }) => `+${a.num} más`;
const PLUS_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
const FORMAT_OPTIONS = [
  { id: 'video', label: 'Video' },
  { id: 'post', label: 'Post' },
];

const monthOf = (d: string) => d.slice(0, 7);
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function PublicationsView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const mobile = useMobile();
  const reqId = useRef(0);

  // ---- estado en la URL ----
  const today = localDateStr(new Date());
  const rawView = params.get('view');
  const view: View = VIEWS.includes(rawView as View) ? (rawView as View) : 'mes';
  const dateParam = params.get('date') ?? '';
  const month = /^\d{4}-\d{2}/.test(dateParam) && parseLocalDate(`${dateParam.slice(0, 7)}-01`) ? dateParam.slice(0, 7) : monthOf(today);
  const selectedDay = parseLocalDate(dateParam) ? dateParam : month === monthOf(today) ? today : `${month}-01`;
  const format = params.get('format') === 'video' || params.get('format') === 'post' ? (params.get('format') as PublicationFormat) : '';
  const clientId = params.get('client') ?? '';
  const pendingMine = params.get('pending') === '1';
  // en móvil «Mes» y «Lista» son la misma agenda
  const agenda = mobile ? view !== 'flujo' : view === 'lista';

  const update = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `/publicaciones?${qs}` : '/publicaciones', { scroll: false });
  }, [router]);

  // ---- datos ----
  const [items, setItems] = useState<PublicationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [tick, setTick] = useState(0);
  const [agendaDays, setAgendaDays] = useState(14);
  const [creating, setCreating] = useState<{ date?: string } | null>(null);

  useEffect(() => { api<ClientSummary[]>('/clients').then(setClients).catch(() => undefined); }, []);

  const range = useMemo(() => {
    if (mobile && view !== 'flujo') {
      return { from: parseLocalDate(weekStartOf(selectedDay))!, to: parseLocalDate(addDaysStr(selectedDay, agendaDays))! };
    }
    const first = parseLocalDate(`${month}-01`)!;
    return { from: new Date(first.getFullYear(), first.getMonth(), first.getDate() - 7), to: new Date(first.getFullYear(), first.getMonth() + 1, 8) };
  }, [mobile, view, selectedDay, agendaDays, month]);
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();

  useEffect(() => {
    if (mobile === null) return;
    const id = ++reqId.current;
    const q = new URLSearchParams({ from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() });
    if (format) q.set('format', format);
    if (clientId) q.set('clientId', clientId);
    if (pendingMine) q.set('pendingMine', '1');
    api<PublicationSummary[]>(`/publications?${q}`)
      .then((r) => { if (id === reqId.current) { setItems(r); setLoaded(true); } })
      .catch((e) => { if (id === reqId.current) { toast(e.message); setLoaded(true); } });
  }, [mobile, fromMs, toMs, format, clientId, pendingMine, tick, toast]);

  // lo visible: en escritorio (lista y flujo) solo el mes elegido
  const shown = useMemo(() => {
    if (mobile || view === 'mes') return items;
    return items.filter((p) => monthOf(localDateStr(new Date(p.scheduledAt))) === month);
  }, [items, mobile, view, month]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of shown) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [shown]);

  function open(date?: string) { setCreating({ date }); }

  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, label: c.name })), [clients]);
  const filterCount = (format ? 1 : 0) + (clientId ? 1 : 0) + (pendingMine ? 1 : 0);

  // ---- calendario (escritorio) ----
  const createRef = useRef(open);
  createRef.current = open;
  const monthTitle = parseLocalDate(`${month}-01`)!.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const fcEvents = useMemo(() => items.map((p) => ({
    id: p.id,
    title: p.title,
    start: p.scheduledAt,
    allDay: false,
    editable: p.status !== 'publicada' && p.status !== 'cancelada',
    classNames: [`pub-c-${p.status}`],
    extendedProps: { pub: p },
  })), [items]);

  function renderEvent(arg: EventContentArg) {
    const p = arg.event.extendedProps.pub as PublicationSummary;
    const s = pubStatus(p.status);
    const F = FORMAT_META[p.format].icon;
    return (
      <div className="pub-ev" title={`${p.title} · ${s.label}`}>
        <span className="pub-ev-line">
          <s.icon size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="sr-only">{s.label}: </span>
          <span className="pub-title cal-ev-title truncate">{p.title}</span>
        </span>
        <span className="pub-ev-line pub-ev-sub">
          <F size={12} strokeWidth={1.5} aria-hidden className="shrink-0" />
          <span className="truncate">{FORMAT_META[p.format].label} · {pubTime(p)}</span>
        </span>
      </div>
    );
  }

  async function onDrop(info: EventDropArg) {
    const prev = info.event.extendedProps.pub as PublicationSummary;
    const at = info.event.start!.toISOString();
    setItems((list) => list.map((x) => (x.id === prev.id ? { ...x, scheduledAt: at } : x)));
    try {
      await api(`/publications/${prev.id}`, { method: 'PATCH', body: { scheduledAt: at } });
      toast('Publicación reprogramada', 'success');
    } catch (err) {
      info.revert();
      setItems((list) => list.map((x) => (x.id === prev.id ? prev : x)));
      toast((err as Error).message);
    }
  }

  function onDayMount(arg: DayCellMountArg) {
    const top = arg.el.querySelector('.fc-daygrid-day-top');
    if (!top) return;
    const day = localDateStr(arg.date);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pub-add';
    b.setAttribute('aria-label', `Nueva publicación el ${arg.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`);
    b.innerHTML = PLUS_SVG;
    b.addEventListener('click', (e) => { e.stopPropagation(); createRef.current(day); });
    top.appendChild(b);
  }

  function onDatesSet(arg: DatesSetArg) {
    // el título lo gobierna la URL; esto solo evita que FullCalendar se salga del mes elegido
    void arg;
  }

  if (mobile === null) return <CalendarSkeleton />;

  const empty = loaded && shown.length === 0;

  // ---- piezas ----
  const filtersRow = (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      <FilterPill icon={Megaphone} label="Formato" options={FORMAT_OPTIONS} value={format} onChange={(v) => update({ format: v })} sheet={!!mobile} />
      <FilterPill icon={BriefcaseBusiness} label="Cliente" options={clientOptions} value={clientId} onChange={(v) => update({ client: v })} sheet={!!mobile} />
      <button type="button" className="pill" aria-pressed={pendingMine} onClick={() => update({ pending: pendingMine ? null : '1' })}>
        <UserCheck {...icon} /> Esperan mi aprobación
      </button>
      <span aria-hidden className="mx-1 hidden h-5 w-px bg-zinc-200 md:block" />
      <ul aria-label="Publicaciones por estado" className="hidden flex-wrap items-center gap-2 md:flex">
        {PUB_STATUSES.map((s) => (
          <li key={s.id} className={`pub-chip pub-c-${s.id} inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium`}>
            <s.icon size={14} strokeWidth={1.75} aria-hidden /> {s.label}
            <span className="tabular-nums opacity-80">{counts[s.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const segView = (views: View[]) => (
    <div role="group" aria-label="Vista" className={`seg ${mobile ? 'w-full' : ''}`}>
      {views.map((v) => {
        const M = VIEW_META[v];
        const on = view === v || (mobile && v === 'lista' && view === 'mes');
        return <button key={v} type="button" aria-pressed={on} onClick={() => update({ view: v === 'mes' ? null : v })}><M.icon {...icon} /> {M.label}</button>;
      })}
    </div>
  );

  const goMonth = (n: number | 'today') => update({ date: n === 'today' ? null : shiftMonth(month, n) });

  const emptyBanner = empty && !agenda && (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-zinc-300 bg-white/60 px-4 py-2.5 text-sm">
      <span className="text-zinc-600">{filterCount ? 'Sin publicaciones para esta selección' : 'Sin publicaciones planificadas este mes'}</span>
      <button type="button" className="btn btn-sm" onClick={() => open()}><Plus {...icon} /> Nueva publicación</button>
    </div>
  );

  const main = mobile ? (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 aria-live="polite" className="min-w-0 truncate text-xl font-semibold tracking-tight first-letter:uppercase">{monthTitle}</h2>
        {(view === 'flujo' ? month !== monthOf(today) : selectedDay !== today) && <button type="button" className="btn" onClick={() => update({ date: null })}>Hoy</button>}
        {view === 'flujo' && (
          <div className="flex gap-1">
            <button type="button" className="btn-ghost btn-icon" aria-label="Mes anterior" onClick={() => goMonth(-1)}><ChevronLeft {...icon} /></button>
            <button type="button" className="btn-ghost btn-icon" aria-label="Mes siguiente" onClick={() => goMonth(1)}><ChevronRight {...icon} /></button>
          </div>
        )}
      </div>
      <div className="mb-3">{segView(['lista', 'flujo'])}</div>
      <div className="mb-4">{filtersRow}</div>
      {view === 'flujo' ? (
        <>{emptyBanner}<FlowBoard items={shown} /></>
      ) : (
        <PublicationAgenda
          items={items}
          loaded={loaded}
          strip
          selectedDay={selectedDay}
          days={agendaDays}
          onSelectDay={(d) => { setAgendaDays(14); update({ date: d === today ? null : d }); }}
          onMore={() => setAgendaDays((n) => n + 14)}
          onCreate={(d) => open(d ?? selectedDay)}
        />
      )}
      <button type="button" className="fab" aria-label="Nueva publicación" onClick={() => open(view === 'flujo' ? undefined : selectedDay)}>
        <Plus size={24} strokeWidth={2} aria-hidden />
      </button>
    </div>
  ) : (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 aria-live="polite" className="min-w-0 truncate text-xl font-semibold tracking-tight first-letter:uppercase">{monthTitle}</h1>
          <button type="button" className="btn-ghost btn-icon" aria-label="Mes anterior" onClick={() => goMonth(-1)}><ChevronLeft {...icon} /></button>
          <button type="button" className="btn-ghost btn-icon" aria-label="Mes siguiente" onClick={() => goMonth(1)}><ChevronRight {...icon} /></button>
          <button type="button" className="btn" onClick={() => goMonth('today')}>Hoy</button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {segView(VIEWS)}
          <button type="button" className="btn-accent" onClick={() => open()}><Plus {...icon} /> Nueva publicación</button>
        </div>
      </div>
      <div className="mb-4">{filtersRow}</div>
      {emptyBanner}
      {view === 'mes' && (
        <div role="region" aria-label="Calendario de publicaciones" aria-busy={!loaded} className="cal-shell pub-shell card-surface relative overflow-hidden">
          <FullCalendar
            key={month}
            plugins={PLUGINS}
            locales={LOCALES}
            locale="es"
            timeZone="local"
            firstDay={1}
            initialView="dayGridMonth"
            initialDate={parseLocalDate(`${month}-01`)!}
            headerToolbar={false}
            dayHeaderFormat={DAY_HEADER_FMT}
            height="auto"
            fixedWeekCount={false}
            showNonCurrentDates
            events={fcEvents}
            eventDisplay="block"
            eventTimeFormat={TIME_FMT}
            dayMaxEvents={3}
            moreLinkContent={moreText}
            editable
            eventInteractive
            dayHeaderContent={(a) => (
              <div className="cal-head cal-head-month"><span className="cal-head-dow">{a.text.replace('.', '')}</span></div>
            )}
            eventContent={renderEvent}
            eventClick={(info) => { info.jsEvent.preventDefault(); router.push(`/publicaciones/${info.event.id}`); }}
            eventDrop={onDrop}
            dateClick={(arg: DateClickArg) => open(localDateStr(arg.date))}
            dayCellDidMount={onDayMount}
            datesSet={onDatesSet}
          />
          {!loaded && <div className="absolute inset-0 z-10 bg-white/70" aria-hidden><div className="skeleton m-6 h-8 w-48" /></div>}
        </div>
      )}
      {view === 'flujo' && <FlowBoard items={shown} />}
      {view === 'lista' && <PublicationAgenda items={shown} loaded={loaded} onCreate={(d) => open(d)} />}
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
      <h1 className="sr-only">Publicaciones</h1>
      {loaded || !mobile ? main : <AgendaSkeleton />}
      {!mobile && <PublicationRail tick={tick} />}
      {creating && (
        <PublicationDialog
          initialDate={creating.date}
          initialClientId={clientId || undefined}
          onClose={() => setCreating(null)}
          onSaved={(p) => { setCreating(null); setTick((t) => t + 1); toast('Idea creada', 'success'); router.push(`/publicaciones/${p.id}`); }}
        />
      )}
    </div>
  );
}

/** Flujo: una columna por estado, con el aspecto del tablero de tareas. */
function FlowBoard({ items }: { items: PublicationSummary[] }) {
  const sorted = [...items].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
      {PUB_STATUSES.map((s) => {
        const col = sorted.filter((p) => p.status === s.id);
        return (
          <section key={s.id} aria-labelledby={`flow-${s.id}`} className={`flex w-[75vw] max-w-64 shrink-0 snap-start flex-col rounded-2xl p-2 sm:w-64 lg:w-auto lg:max-w-none lg:min-w-0 ${s.tint}`}>
            <header className="flex items-center gap-2 px-2 pb-3 pt-1.5">
              <s.icon size={16} strokeWidth={2} aria-hidden className={s.fg} />
              <h2 id={`flow-${s.id}`} className="text-sm font-semibold text-zinc-800">{s.label}</h2>
              <span className="ml-auto rounded-full bg-white px-2 text-xs font-medium leading-5 tabular-nums text-zinc-600 ring-1 ring-zinc-200">{col.length}</span>
            </header>
            <ul className="min-h-[8rem] flex-1 space-y-2">
              {col.map((p) => {
                const F = FORMAT_META[p.format].icon;
                return (
                  <li key={p.id}>
                    <Link href={`/publicaciones/${p.id}`} className="card-surface card-surface-interactive block space-y-1.5 p-3">
                      <span className={`block text-sm font-medium ${p.status === 'cancelada' ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>{p.title}</span>
                      <span className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-600">
                        <F size={12} strokeWidth={1.5} aria-hidden />
                        {new Date(p.scheduledAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {pubMeta(p)}
                      </span>
                      {p.client && <span className="block truncate text-xs text-zinc-500">{p.client.name}</span>}
                      {p.latestVersion && (p.status === 'edicion' || p.status === 'por_publicar') && <ApprovalBar approvals={p.approvals} total={p.reviewersCount} />}
                    </Link>
                  </li>
                );
              })}
              {col.length === 0 && <li className="rounded-lg border border-dashed border-zinc-300/80 px-3 py-8 text-center text-xs text-zinc-500">Sin publicaciones</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

