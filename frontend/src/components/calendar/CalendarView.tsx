'use client';

import type { DateSelectArg, DatesSetArg, EventContentArg, EventDropArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { CheckSquare, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  type CalView, addDaysStr, localDateStr, parseLocalDate, PERSON_COLORS, utcDateStr, utcDayIso,
} from '@/lib/calendar';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { useMobile } from '@/lib/useMediaQuery';
import type { CalendarEvent, ExternalContact, Task, TaskType, UserLite } from '@/lib/types';
import { Dialog } from '../Dialog';
import { AgendaSkeleton, CalendarSkeleton } from '../Skeletons';
import { TaskPanel } from '../TaskPanel';
import { CalendarFilters } from './CalendarFilters';
import { AgendaView, weekStartOf } from './AgendaView';
import { EventDetail } from './EventDetail';
import { EventDialog, type EventDraft } from './EventDialog';

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];
const LOCALES = [esLocale];
const FC_VIEWS = { timeGrid3Day: { type: 'timeGrid', duration: { days: 3 } } };
const TIME_FMT = { hour: '2-digit', minute: '2-digit', hour12: false } as const;
const BUSINESS_HOURS = { daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '19:00' };
const TITLE_MONTH = { month: 'long', year: 'numeric' } as const;
const TITLE_RANGE = { day: 'numeric', month: 'long', year: 'numeric' } as const;
const DAY_HEADER_FMT = { weekday: 'short' } as const;
const moreText = (a: { num: number }) => `+${a.num} más`;

const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const VIEWS: CalView[] = ['month', 'week', 'day'];
const VIEW_LABEL: Record<CalView, string> = { month: 'Mes', week: 'Semana', day: 'Día' };
const EMPTY_LABEL: Record<CalView, string> = { month: 'este mes', week: 'esta semana', day: 'este día' };

function fcViewName(view: CalView, mobile: boolean) {
  return view === 'month' ? 'dayGridMonth' : view === 'day' ? 'timeGridDay' : mobile ? 'timeGrid3Day' : 'timeGridWeek';
}
function viewFromFc(type: string): CalView {
  return type === 'dayGridMonth' ? 'month' : type === 'timeGridDay' ? 'day' : 'week';
}

export function CalendarView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const mobile = useMobile();
  const calRef = useRef<FullCalendar>(null);
  const reqId = useRef(0);

  // ---- estado en la URL ----
  const rawView = params.get('view');
  const view: CalView = VIEWS.includes(rawView as CalView) ? (rawView as CalView) : mobile ? 'day' : 'week';
  const dateParam = params.get('date');
  const today = localDateStr(new Date());
  const dateStr = parseLocalDate(dateParam) ? dateParam! : today;
  const userIds = useMemo(() => csv(params.get('users')), [params]);
  const contactIds = useMemo(() => csv(params.get('contacts')), [params]);
  const showTasks = params.get('tasks') === '1';
  const eventId = params.get('event');
  const taskId = params.get('task');
  const userKey = userIds.join(',');
  const contactKey = contactIds.join(',');

  const update = useCallback((patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    const qs = next.toString();
    const url = qs ? `/calendar?${qs}` : '/calendar';
    if (push) router.push(url, { scroll: false }); else router.replace(url, { scroll: false });
  }, [router]);

  // ---- datos ----
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [contacts, setContacts] = useState<ExternalContact[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [extra, setExtra] = useState<Record<string, CalendarEvent>>({});
  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const [title, setTitle] = useState('');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  const [creating, setCreating] = useState<EventDraft | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(dateStr);
  const [agendaDays, setAgendaDays] = useState(14);
  // valores iniciales congelados: FullCalendar reinicia sus fechas si estas opciones cambian
  const init = useRef<{ view: string; date: Date } | null>(null);
  if (mobile !== null && !init.current) init.current = { view: fcViewName(view, mobile), date: parseLocalDate(dateStr)! };

  useEffect(() => {
    api<UserLite[]>('/users').then(setUsers).catch(() => undefined);
    api<ExternalContact[]>('/contacts').then(setContacts).catch(() => undefined);
  }, [tick]);
  useEffect(() => {
    if (taskId && types.length === 0) api<TaskType[]>('/task-types').then(setTypes).catch(() => undefined);
  }, [taskId, types.length]);

  useEffect(() => {
    if (!range) return;
    const id = ++reqId.current;
    const q = new URLSearchParams({
      from: new Date(range.from.getTime() - 864e5).toISOString(),
      to: new Date(range.to.getTime() + 864e5).toISOString(),
    });
    if (userKey) q.set('userIds', userKey);
    if (contactKey) q.set('contactIds', contactKey);
    api<CalendarEvent[]>(`/events?${q}`)
      .then((r) => { if (id === reqId.current) { setEvents(r); setLoaded(true); } })
      .catch((e) => { if (id === reqId.current) { toast(e.message); setLoaded(true); } });
  }, [range, userKey, contactKey, tick, toast]);

  useEffect(() => {
    if (!showTasks) return;
    api<Task[]>('/tasks').then(setAllTasks).catch((e) => toast(e.message));
  }, [showTasks, tick, toast]);

  // ---- colores ----
  const colorByUser = useMemo(() => new Map(users.map((u, i) => [u.id, PERSON_COLORS[i % PERSON_COLORS.length]])), [users]);
  const personColor = useCallback((id: string) => colorByUser.get(id) ?? 'zinc', [colorByUser]);
  // con varias personas elegidas, cada evento toma el color de la primera que participa
  const colorOf = useCallback((e: CalendarEvent) => {
    if (userIds.length > 1) {
      const first = userIds.find((id) => e.participants.some((p) => p.id === id) || e.createdBy?.id === id);
      if (first) return personColor(first);
    }
    return e.color || 'accent';
  }, [userIds, personColor]);

  const canEdit = useCallback((e: CalendarEvent) => !!user && (user.role === 'admin' || e.createdBy?.id === user.id), [user]);

  // ---- tareas con fecha límite en el rango ----
  const tasksInRange = useMemo(() => {
    if (!showTasks || !range) return [];
    return allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if (d < range.from || d >= range.to) return false;
      return userIds.length === 0 || t.assignees.some((a) => userIds.includes(a.id));
    });
  }, [showTasks, allTasks, range, userIds]);

  const fcEvents = useMemo(() => {
    const evs = events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.allDay ? utcDateStr(e.startAt) : e.startAt,
      end: e.allDay ? utcDateStr(e.endAt) : e.endAt,
      allDay: e.allDay,
      editable: canEdit(e),
      classNames: [`ev-c-${colorOf(e)}`],
      extendedProps: { kind: 'event', ev: e },
    }));
    const tasks = tasksInRange.map((t) => ({
      id: `task:${t.id}`,
      title: t.title,
      start: localDateStr(new Date(t.dueDate!)),
      allDay: true,
      editable: false,
      classNames: ['ev-task', ...(t.status === 'completed' ? ['ev-task-done'] : new Date(t.dueDate!) < new Date() ? ['ev-task-overdue'] : [])],
      extendedProps: { kind: 'task', taskId: t.id },
    }));
    return [...evs, ...tasks];
  }, [events, tasksInRange, canEdit, colorOf]);

  // ---- sincronía FullCalendar <-> URL ----
  function onDatesSet(arg: DatesSetArg) {
    setTitle(arg.view.title);
    setRange((r) => (r && r.from.getTime() === arg.start.getTime() && r.to.getTime() === arg.end.getTime() ? r : { from: arg.start, to: arg.end }));
    const v = viewFromFc(arg.view.type);
    const d = localDateStr(arg.view.calendar.getDate());
    const cur = new URLSearchParams(window.location.search);
    if (cur.get('view') !== v || cur.get('date') !== d) update({ view: v, date: d });
    setSelectedDay((prev) => {
      const p = parseLocalDate(prev);
      return p && p >= arg.view.currentStart && p < arg.view.currentEnd ? prev : (d >= localDateStr(arg.view.currentStart) && d < localDateStr(arg.view.currentEnd) ? d : localDateStr(arg.view.currentStart));
    });
  }

  useEffect(() => {
    const cal = calRef.current?.getApi();
    if (!cal || mobile === null) return;
    const want = fcViewName(view, mobile);
    if (cal.view.type !== want) cal.changeView(want, parseLocalDate(dateStr)!);
    else if (localDateStr(cal.getDate()) !== dateStr) cal.gotoDate(parseLocalDate(dateStr)!);
  }, [view, dateStr, mobile]);

  // en móvil no hay FullCalendar: la agenda carga desde el lunes de la semana hasta N días después del elegido
  useEffect(() => {
    if (!mobile) return;
    const from = parseLocalDate(weekStartOf(dateStr))!;
    const to = parseLocalDate(addDaysStr(dateStr, agendaDays))!;
    setRange((r) => (r && r.from.getTime() === from.getTime() && r.to.getTime() === to.getTime() ? r : { from, to }));
    setTitle(parseLocalDate(dateStr)!.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
  }, [mobile, dateStr, agendaDays]);

  const go = (dir: 'prev' | 'next' | 'today') => {
    const cal = calRef.current?.getApi();
    if (!cal) return;
    if (dir === 'prev') cal.prev(); else if (dir === 'next') cal.next(); else cal.today();
  };

  // ---- interacciones ----
  function onSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect();
    let { start, end, allDay } = arg;
    if (arg.view.type === 'dayGridMonth' && allDay && end.getTime() - start.getTime() <= 864e5 + 3600_000) {
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0);
      end = new Date(start.getTime() + 3600_000);
      allDay = false;
    }
    setCreating({ start, end, allDay });
  }

  function openEvent(id: string | null) {
    update({ event: id }, id !== null);
  }
  function openTask(id: string | null) {
    update({ task: id }, id !== null);
  }

  async function persistTime(info: EventDropArg | EventResizeDoneArg) {
    const prev = info.event.extendedProps.ev as CalendarEvent;
    const s = info.event.start!;
    const allDay = info.event.allDay;
    const e = info.event.end ?? (allDay ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1) : new Date(s.getTime() + 3600_000));
    const startAt = allDay ? utcDayIso(s) : s.toISOString();
    const endAt = allDay ? utcDayIso(e) : e.toISOString();
    setEvents((list) => list.map((x) => (x.id === prev.id ? { ...x, startAt, endAt, allDay } : x)));
    try {
      const saved = await api<CalendarEvent>(`/events/${prev.id}/time`, { method: 'PATCH', body: { startAt, endAt, allDay } });
      setEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) {
      info.revert();
      setEvents((list) => list.map((x) => (x.id === prev.id ? prev : x)));
      toast((err as Error).message);
    }
  }

  function onSaved(saved: CalendarEvent) {
    setCreating(null);
    setEditing(null);
    setEvents((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]));
    setExtra((x) => ({ ...x, [saved.id]: saved }));
    toast(editing ? 'Evento actualizado' : 'Evento creado', 'success');
    reload();
  }

  async function removeEvent(id: string) {
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      setEvents((list) => list.filter((x) => x.id !== id));
      openEvent(null);
      toast('Evento eliminado', 'success');
    } catch (err) {
      toast((err as Error).message);
    }
  }

  // el detalle sale de la lista cargada o, si el enlace apunta fuera del rango, de la API
  const detail = eventId ? events.find((e) => e.id === eventId) ?? extra[eventId] ?? null : null;
  useEffect(() => {
    if (!eventId || events.some((e) => e.id === eventId) || extra[eventId]) return;
    api<CalendarEvent>(`/events/${eventId}`)
      .then((e) => setExtra((x) => ({ ...x, [e.id]: e })))
      .catch((e) => { toast(e.message); openEvent(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, events]);

  // ---- render de eventos ----
  function renderEvent(arg: EventContentArg) {
    const x = arg.event.extendedProps;
    const vt = arg.view.type;
    if (x.kind === 'task') {
      return (
        <div className="cal-ev-row" title="Tarea con fecha límite">
          <CheckSquare size={12} strokeWidth={1.5} aria-hidden className="shrink-0" />
          <span className="cal-ev-title truncate">{arg.event.title}</span>
        </div>
      );
    }
    if (vt === 'dayGridMonth') {
      return (
        <div className="cal-ev-row">
          {arg.event.allDay ? <span className="cal-dot" /> : <><span className="cal-dot" /><span className="cal-ev-time">{arg.timeText}</span></>}
          <span className="cal-ev-title truncate">{arg.event.title}</span>
        </div>
      );
    }
    if (arg.event.allDay) {
      return <div className="cal-ev-row"><span className="cal-ev-title truncate">{arg.event.title}</span></div>;
    }
    const loc = x.location as string;
    return (
      <div className="cal-ev">
        <div className="cal-ev-title">{arg.event.title}</div>
        <div className="cal-ev-meta">{arg.timeText}{loc ? ` · ${loc}` : ''}</div>
      </div>
    );
  }

  const filterCount = userIds.length + contactIds.length + (showTasks ? 1 : 0);
  const emptyRange = loaded && range && events.length === 0 && tasksInRange.length === 0;

  const filters = user && (
    <CalendarFilters
      users={users}
      meId={user.id}
      colorOf={personColor}
      selectedUsers={userIds}
      onUsers={(ids) => update({ users: ids.join(',') })}
      contacts={contacts}
      selectedContacts={contactIds}
      onContacts={(ids) => update({ contacts: ids.join(',') })}
      showTasks={showTasks}
      onShowTasks={(on) => update({ tasks: on ? '1' : null })}
    />
  );

  if (mobile === null || !user) return mobile ? <AgendaSkeleton /> : <CalendarSkeleton />;

  const filterButton = (
    <button type="button" className={`btn md:hidden ${filterCount ? '' : 'btn-icon'}`} onClick={() => setFiltersOpen(true)} aria-label={filterCount ? `Filtros, ${filterCount} activos` : 'Filtros'}>
      <SlidersHorizontal {...icon} />
      {filterCount > 0 && <span className="pill-count">{filterCount}</span>}
    </button>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
      <h1 className="sr-only">Calendario</h1>
      <aside aria-label="Filtros del calendario" className="hidden md:block">{filters}</aside>

      {mobile ? (
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 aria-live="polite" className="min-w-0 truncate text-xl font-semibold tracking-tight first-letter:uppercase">{title}</h2>
            <div className="flex shrink-0 items-center gap-2">
              {dateStr !== today && <button type="button" className="btn" onClick={() => update({ date: null })}>Hoy</button>}
              {filterButton}
            </div>
          </div>
          <AgendaView
            selectedDay={dateStr}
            days={agendaDays}
            events={events}
            tasks={tasksInRange}
            loaded={loaded}
            colorOf={colorOf}
            onSelectDay={(d) => { setAgendaDays(14); update({ date: d === today ? null : d }); }}
            onMore={() => setAgendaDays((n) => n + 14)}
            onOpenEvent={(id) => openEvent(id)}
            onOpenTask={(id) => openTask(id)}
            onCreate={(d) => setCreating(defaultSlot(d))}
          />
          <button type="button" className="fab" aria-label="Nuevo evento" onClick={() => setCreating(defaultSlot(dateStr))}>
            <Plus size={24} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="min-w-0">
          {/* Barra de herramientas */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button type="button" className="btn" onClick={() => go('today')}>Hoy</button>
              <button type="button" className="btn-ghost btn-icon" aria-label="Periodo anterior" onClick={() => go('prev')}><ChevronLeft {...icon} /></button>
              <button type="button" className="btn-ghost btn-icon" aria-label="Periodo siguiente" onClick={() => go('next')}><ChevronRight {...icon} /></button>
              <h2 aria-live="polite" className="ml-1 min-w-0 truncate text-lg font-semibold tracking-tight first-letter:uppercase">{title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div role="group" aria-label="Vista" className="seg">
                {VIEWS.map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => update({ view: v })}>{VIEW_LABEL[v]}</button>)}
              </div>
              <button type="button" className="btn-accent" onClick={() => setCreating(defaultSlot(selectedDay))}>
                <Plus {...icon} /> Nuevo evento
              </button>
            </div>
          </div>

          {emptyRange && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-zinc-300 bg-white/60 px-4 py-2.5 text-sm">
              <span className="text-zinc-600">{filterCount ? 'Sin eventos para esta selección' : `Sin eventos ${EMPTY_LABEL[view]}`}</span>
              <button type="button" className="btn btn-sm" onClick={() => setCreating(defaultSlot(selectedDay))}><Plus {...icon} /> Crear evento</button>
            </div>
          )}

          <div role="region" aria-label="Calendario" aria-busy={!loaded} className="cal-shell card-surface relative h-[calc(100dvh-13rem)] min-h-[32rem] overflow-hidden">
            <FullCalendar
              ref={calRef}
              plugins={PLUGINS}
              locales={LOCALES}
              locale="es"
              timeZone="local"
              firstDay={1}
              initialView={init.current!.view}
              initialDate={init.current!.date}
              views={FC_VIEWS}
              headerToolbar={false}
              dayHeaderFormat={DAY_HEADER_FMT}
              height="100%"
              expandRows
              fixedWeekCount={false}
              events={fcEvents}
              eventDisplay="block"
              forceEventDuration
              displayEventEnd={false}
              eventTimeFormat={TIME_FMT}
              titleFormat={view === 'month' ? TITLE_MONTH : TITLE_RANGE}
              slotLabelFormat={TIME_FMT}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              scrollTime="08:00:00"
              scrollTimeReset={false}
              nowIndicator
              allDayContent="Todo el día"
              businessHours={BUSINESS_HOURS}
              eventShortHeight={34}
              eventMinHeight={22}
              dayMaxEvents
              moreLinkContent={moreText}
              navLinks
              navLinkDayClick="timeGridDay"
              editable
              eventInteractive
              selectable
              selectMirror
              dayHeaderContent={(a) => (
                <div className={`cal-head ${a.view.type === 'dayGridMonth' ? 'cal-head-month' : ''}`}>
                  <span className="cal-head-dow">{a.text.replace('.', '')}</span>
                  {a.view.type !== 'dayGridMonth' && <span className="cal-head-num">{a.date.getDate()}</span>}
                </div>
              )}
              eventContent={renderEvent}
              eventClick={(info) => {
                info.jsEvent.preventDefault();
                const x = info.event.extendedProps;
                if (x.kind === 'task') openTask(x.taskId as string); else openEvent(info.event.id);
              }}
              eventDrop={persistTime}
              eventResize={persistTime}
              select={onSelect}
              datesSet={onDatesSet}
            />
            {!loaded && <div className="absolute inset-0 z-10 bg-white/70" aria-hidden><div className="skeleton m-6 h-8 w-48" /></div>}
          </div>
        </div>
      )}

      {filtersOpen && (
        <Dialog variant="bottom" labelledBy="filters-title" onClose={() => setFiltersOpen(false)}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3">
            <h2 id="filters-title" className="text-base font-semibold tracking-tight">Filtros</h2>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
          </div>
          <div className="px-5 py-5">{filters}</div>
          <div className="sticky bottom-0 flex gap-2 border-t border-zinc-100 bg-white px-5 py-3">
            {filterCount > 0 && <button type="button" className="btn" onClick={() => update({ users: null, contacts: null, tasks: null })}>Limpiar</button>}
            <button type="button" className="btn-accent flex-1" onClick={() => setFiltersOpen(false)}>Ver calendario</button>
          </div>
        </Dialog>
      )}

      {eventId && (
        <EventDetail
          event={detail}
          colorKey={detail ? colorOf(detail) : 'accent'}
          canEdit={!!detail && canEdit(detail)}
          onClose={() => openEvent(null)}
          onEdit={() => detail && setEditing(detail)}
          onDelete={() => removeEvent(eventId)}
        />
      )}
      {(creating || editing) && (
        <EventDialog
          users={users}
          event={editing}
          draft={creating}
          onClose={() => { setCreating(null); setEditing(null); }}
          onSaved={onSaved}
        />
      )}
      {taskId && (
        <TaskPanel
          taskId={taskId}
          users={users}
          types={types}
          onClose={() => openTask(null)}
          onChanged={(t) => setAllTasks((list) => list.map((x) => (x.id === t.id ? t : x)))}
          onDeleted={(id) => { setAllTasks((list) => list.filter((t) => t.id !== id)); openTask(null); }}
        />
      )}
    </div>
  );
}

/** Franja por defecto para "Nuevo evento": el día elegido, de 9:00 a 10:00 (o la próxima hora si es hoy). */
function defaultSlot(day: string): EventDraft {
  const d = parseLocalDate(day) ?? new Date();
  const now = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0);
  if (localDateStr(d) === localDateStr(now)) {
    start.setHours(Math.min(now.getHours() + 1, 22), 0, 0, 0);
  }
  return { start, end: new Date(start.getTime() + 3600_000), allDay: false };
}
