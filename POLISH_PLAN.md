# Polish plan: Acuérdalo frontend

Mode: **Operate** (app UI: kanban, task panel, admin). Polish = refinement. Keep the incumbent world: zinc neutrals, Inter, thin borders, single indigo accent (`accent` in tailwind.config.ts), Spanish copy. Don't redesign; don't change factual copy except where noted.

## P1: Functional defects
1. **Fecha límite saves on every keystroke** (`TaskPanel.tsx` datetime-local `onChange` → PATCH → notification email per keystroke). Hold local state; commit on blur/Enter only if the value changed; add a "Quitar fecha" clear affordance.
2. **Dialogs lack semantics.** TaskPanel and NewTaskDialog: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus moved in on open, focus trapped, focus returned to the triggering card on close, Escape closes the top-most layer only (NewTaskDialog currently ignores Escape). Lock body scroll while open. Extract one shared `Dialog`/`Sheet` primitive rather than duplicating.
3. **Cards not keyboard-openable.** Configure the dnd-kit KeyboardSensor to start drag with Space only, so Enter opens the task. Give cards a visible `focus-visible` ring and an accessible name (title, priority, due state).
4. **Labels not associated** (`<label className="label">` without `htmlFor`) in TaskPanel, NewTaskDialog and admin forms. The inline title input needs an `aria-label`.
5. **Title inline edit shifts text** (`focus:px-3`). Use constant padding with a negative margin so the text never moves; same for the description.

## P2: Missing states
6. **Loading:** replace "Cargando…" with skeletons that match the final layout (board columns with 2–3 ghost cards, panel fields, admin tables).
7. **Empty:** board with zero tasks overall gets a short first-run message with a "Crear la primera tarea" action. Filtered-to-empty gets "Ninguna tarea coincide con estos filtros" plus "Limpiar filtros". Per-column empty stays quiet.
8. **Feedback:** the toast system gets variants (error = red accent, success = neutral with a check), `role="status"`/`aria-live="polite"`, a dismiss button and a max stack of 3. The task panel header shows a quiet "Guardando… / Guardado" indicator after saves.
9. **Due-date semantics not color-only:** overdue shows the date in red plus a "Vencida" text tag; due within 24 h shows amber "Vence pronto". The priority dot gets sr-only text.
10. **Comments composer:** ⌘/Ctrl+Enter sends (show the hint), drag-and-drop files onto the composer with a drop-zone highlight, file chips with type icons, and multiple images in the thread shown as a tidy thumbnail grid.

## P3: Hierarchy, responsive, system drift
11. **Mobile board (≤768px):** columns become a horizontal scroll-snap row (each ~85vw) instead of a long vertical stack, with sticky column headers.
12. **Mobile nav:** the 4 links plus name and "Salir" overflow at 375px. Use a compact header: logo, horizontally scrollable links, and a user menu (initials avatar → name, "Cerrar sesión").
13. **FilterBar on mobile:** selects wrap full-width two-up, and "Nueva tarea" stays reachable.
14. **Column headers:** a small status indicator (neutral / accent / green) next to the label, and a `tabular-nums` count.
15. **Admin tables:** add a `<thead>` with column labels. On mobile the rows become stacked cards instead of a horizontally-scrolled table. Logs page: readable action labels (e.g. `task.move` → "Movió tarea"), relative time with absolute time on hover, monospace pretty-printed JSON in the expandable row.
16. **Login/register:** consistent with the app (same wordmark treatment, password visibility toggle, inline field errors). Register success state is a clear confirmation panel, not just text.
17. **Page titles:** `title.template = '%s · Acuérdalo'` with per-route titles (Tablero, Usuarios, Tipos de tarea, Registro de actividad, Iniciar sesión, Crear cuenta). Add a simple SVG favicon (accent square plus a check) in `app/icon.svg`.

## P4: Visual and motion consistency
18. **Single icon family:** add `lucide-react` (16px, 1.5 stroke) and replace the "×" glyphs and text-only affordances: close, attach (Paperclip), plus, calendar, log-out, trash, chevrons.
19. **Focus ring token:** a global `focus-visible:ring-2 ring-accent/30 ring-offset-1` on `.btn`, `.btn-accent`, inputs, nav links and cards. Inputs use a ring on focus, not just a border swap.
20. **Buttons:** a `.btn-ghost` and a `.btn-danger` variant replace the ad-hoc `!border-red-200` overrides. Same height (h-8 / h-9) across all buttons and selects.
21. **Motion:** the panel slides in (200ms ease-out, translate-x 16px plus fade), the dialog fades/scales from 0.98, the card hover gets a subtle shadow. Everything is disabled under `prefers-reduced-motion`. No decorative animation beyond that.
22. **Type:** `tabular-nums` on dates and counts, consistent section-label style (one `.section-label` component class for the uppercase xs labels), and text-balance on headings.

## P5: Cleanup
23. Remove dead code and unused imports, keep lint and build clean, no console output.

## Verification (bounded)
- Rebuild the frontend container. Capture one batched round of Playwright screenshots at 1440×900 and 390×844: login, register, board (empty + populated + filtered-empty), task panel with comments and attachments, new-task dialog, admin users/types/logs. Fix everything that shows up in one batch, run one confirmation round, then stop.
- Keyboard pass: tab to a card → Enter opens the panel → Escape closes and focus returns. Space starts a drag and the arrow keys move the card.
- Run the impeccable detector once over `frontend/src`.
- `npm run lint` and `npm run build` must pass.
