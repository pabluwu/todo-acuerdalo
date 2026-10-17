# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The in-house team of an agency (roughly 5–15 people, with 1–2 administrators) coordinating client work, publications and internal tasks. Members plan at a desk and check progress or mark advances from their phones away from the office, for example on site visits or in meetings. Administrators also approve accounts, manage task types and external contacts, and review the audit log.

## Product Purpose
Acuérdalo ("acuérdate de esto") keeps the team from losing track of commitments. A task or an event has clear owners, a date and a record of what changed, and everyone involved finds out without having to chase anyone. Success looks like this: nobody misses a due date or a meeting for lack of a notice, and anyone can see what's pending, what's in progress and what was completed.

## Positioning
A single internal tool that joins tasks (kanban/list) and a shared calendar, with notifications by email (and .ics for events) to everyone involved. It is built for the agency's own way of working: task types *Interna*, *Clientes* and *Publicaciones*, plus external contacts kept for follow-up. Open: how it is positioned against generic tools (Trello, Asana, Google Calendar) has not been defined.

## Operating Context
- Day to day: create and assign tasks, move them between *Sin iniciar · En proceso · Completada*, comment with attachments (a review thread), and filter by person, priority, type or due date.
- Shared calendar: events with internal participants, external contacts kept only for follow-up, optional reminders, and a task layer that shows due dates.
- Email is the notification channel: assignment, every change, due-date alerts (due soon / overdue), event reminders and cancellations.
- Mixed use: desktop for planning (kanban, week view), phone for checking and updating (task list, agenda).

## Capabilities and Constraints
- **Notify everyone involved:** every change to a task or event notifies the assignees or participants and the administrators, including the person who made the change if they are involved. Event emails carry an `.ics` invitation, and a cancellation sends `METHOD:CANCEL`.
- **External contacts never receive anything.** They exist only for follow-up and never appear as recipients or in the `.ics`.
- **Full audit trail:** every mutation is recorded in the `logs` table (actor, action, entity, before/after).
- **Spanish only (Chile):** the interface, emails and dates are in Spanish. There is no i18n.
- Access requires an account approved by an administrator. Roles: `admin` and `user`. Only the creator or an admin can edit or delete an event.
- Stack in place: Next.js 15 + Tailwind (frontend), NestJS + PostgreSQL (backend), Docker Compose, deployed by GitHub Actions to the team's own server (todo.acuerdalo.cl).
- Fixed terminology: *Tablero*, *Lista*, *Calendario*, *Tarea*, *Evento*, *Tipo de tarea*, *Contacto externo*, *Registro*, *Vencida*, *Vence pronto*.

## Brand Commitments
- Name: **Acuérdalo**, with a mark of an accent square plus a check (`frontend/src/app/icon.svg`, `components/Logo.tsx`).
- Voice: direct, friendly Spanish addressed as *tú*. Controls name their action ("Nueva tarea", "Crear evento", "Limpiar filtros").

## Evidence on Hand
There are no customers, testimonials or metrics, and none should be invented. The real content is the team's own tasks and events.

## Product Principles
1. **Nobody falls through the cracks:** every commitment has an owner, a date and an automatic notice. Notifying everyone involved is not up for negotiation.
2. **Status at a glance:** what's pending, what's overdue and what's coming up should be visible without digging.
3. **The phone is for acting, the desk is for planning:** every flow has to work with one hand on a phone (check, mark progress, see the agenda).
4. **Everything leaves a trace:** changes are auditable, and outsiders only ever appear as records.
5. **Internal and trustworthy before flashy:** this is an Operate tool for a small team, so clarity and consistency come before expression.

## Accessibility & Inclusion
No formal standard has been required. The existing practice is kept: full keyboard navigation (cards open with Enter and drag with Space), dialogs with focus management, due states that are not signaled by color alone, and `prefers-reduced-motion` respected.
