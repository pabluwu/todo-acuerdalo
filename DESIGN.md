---
name: Acuérdalo
description: Team tasks without the noise. A kanban, a list and a shared calendar for an agency.
colors:
  indigo-acuerdalo: "#4f46e5"
  indigo-acuerdalo-deep: "#4338ca"
  indigo-mist: "#eef2ff"
  indigo-ink: "#312e81"
  lino-calido: "#fafaf9"
  stone-wash: "#f5f5f4"
  paper: "#ffffff"
  ink: "#18181b"
  ink-soft: "#52525b"
  ink-muted: "#71717a"
  hairline: "#e4e4e7"
  hairline-faint: "#f4f4f5"
  status-progress-tint: "#eef2ff"
  status-done: "#059669"
  status-done-tint: "#ecfdf5"
  priority-high: "#dc2626"
  priority-medium: "#d97706"
  overdue: "#b91c1c"
  overdue-tint: "#fef2f2"
  due-soon: "#92400e"
  due-soon-tint: "#fffbeb"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  body-strong:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.375
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.025em"
  meta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.8
    fontFeature: "tnum"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.indigo-acuerdalo}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.indigo-acuerdalo-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    height: "36px"
  filter-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "32px"
  filter-pill-active:
    backgroundColor: "{colors.indigo-mist}"
    textColor: "{colors.indigo-ink}"
  task-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px"
  kanban-column:
    backgroundColor: "{colors.stone-wash}"
    rounded: "{rounded.xl}"
    padding: "8px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.indigo-mist}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    height: "36px"
  fab:
    backgroundColor: "{colors.indigo-acuerdalo}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "56px"
---

# Design System: Acuérdalo

## Overview

**Creative North Star: "La libreta del equipo"**

Acuérdalo should feel like a notebook the whole team shares. The paper is warm and calm (Lino Cálido), the ink is a single indigo, and soft color tabs mark what state each thing is in. It is an Operate tool for a small agency team, so the notebook organizes work rather than decorating it. Every surface answers "what's pending, what's overdue, what's coming up" before it adds any personality.

The character is **friendly and precise**. Corners are soft, filters are rounded pills, and shadows are barely there. Nothing raises its voice except the primary action and anything that has gone overdue. The warmth comes from small, repeated decisions: avatars with a stable color per person, tinted columns by status, a drawn icon next to every label, and empty states that invite action instead of leaving a gap.

Density is medium. Desktop is for planning (kanban, week view), the phone is for acting (list, agenda, floating button). The system gets simpler on mobile; it doesn't just shrink.

**Key Characteristics:**
- Warm stone background with white paper surfaces and a single indigo accent.
- Color carries meaning (status, priority, urgency, person), never decoration.
- One icon family (lucide, 16px, 1.5 stroke) next to every label in navigation, filters and states.
- Pills and segmented controls for filtering and switching views; avatars with a color per person.
- Inter at small sizes, tabular numerals for dates and counters.

## Colors

The palette is warm paper with indigo ink, plus a semantic vocabulary for status and urgency that always comes with an icon or text.

### Primary
- **Índigo Acuérdalo** (`indigo-acuerdalo`): the only brand voice. Used for the primary action ("Nueva tarea", "Nuevo evento"), the floating button, the today marker, the "in progress" state, focus rings and the active state of navigation, pills and segmented controls.
- **Índigo profundo** (`indigo-acuerdalo-deep`): hover on the primary action.
- **Niebla índigo** (`indigo-mist`): the background of active elements (nav, pills, menu items, the in-progress column) and of empty-state icons.
- **Tinta índigo** (`indigo-ink`): text on Niebla índigo.

### Neutral
- **Lino Cálido** (`lino-calido`): the page background, warm stone rather than cold gray.
- **Piedra lavada** (`stone-wash`): the "not started" column, type badges and row hover.
- **Papel** (`paper`): cards, lists, the nav, popovers and dialogs.
- **Tinta** (`ink`): titles and primary text.
- **Tinta suave** (`ink-soft`) and **Tinta tenue** (`ink-muted`): secondary text, metadata and icons at rest.
- **Hilo** (`hairline`) and **Hilo tenue** (`hairline-faint`): borders and dividers.

### Semantic
- **Status:** not started uses neutral tones with an empty-circle icon. In progress uses indigo with a dashed circle. Completed uses green (`status-done`) on its tint with a circle-check.
- **Priority:** high is red (`priority-high`, double chevron up), medium is amber (`priority-medium`, equals sign), low is gray (double chevron down). Each sits in a small square of its soft tint.
- **Urgency:** overdue uses `overdue` on `overdue-tint` plus the text "Vencida". Due soon uses `due-soon` on `due-soon-tint` plus "Vence pronto".
- **Person and event colors:** eight agenda colors (indigo, emerald, amber, rose, sky, violet, orange, teal) defined as `ev-c-*` classes, each with background, border, text and dot variables. Avatars and calendar events use them.

### Named Rules
**The One Ink Rule.** Indigo is the only brand color. If an element is indigo, it is either the primary action or something active or current. It is never decoration.

**The Never Color Alone Rule.** Every status, priority and urgency is carried by color *and* an icon or text ("Vencida", "Vence pronto", a status icon). Color reinforces the meaning; it doesn't replace it.

## Typography

**Body Font:** Inter (with system-ui, sans-serif), loaded through `next/font` as `--font-inter`.

**Character:** one neutral, legible family that carries the whole hierarchy through size and weight. Dates and counters use tabular numerals so columns don't jump around.

### Hierarchy
- **Headline** (600, 24px on desktop / 20px on mobile, tight tracking): page titles ("Tareas", the calendar's month).
- **Title** (600, 16px): dialog, sheet and panel titles.
- **Body strong** (500, 14px): task and event titles in cards and lists.
- **Body** (400, 14px): general text, controls, menus.
- **Label** (500, 12px, uppercase with wide tracking): section labels (`.section-label`), for example "Personas" or "Administración".
- **Meta** (400, 11px, tabular): dates, type badges and counters inside cards.

### Named Rules
**The Tabular Rule.** Every date, time and counter uses `tabular-nums`.

## Layout

- The container is 1400px wide with a 16px gutter on mobile and 24px from `md` up.
- The nav is fixed (56px), on translucent paper.
- **Board:** a three-column kanban grid (16–20px gaps) on desktop, or a list. Under 768px only the list exists, with the filter rail in a single row that scrolls horizontally and a 56px floating button in the bottom-right corner.
- **Calendar:** a 240px filters column plus FullCalendar on desktop. On mobile, an agenda: a weekly strip inside a card, then days with sticky headers (offset under the nav) and lists of rows. Consecutive empty days collapse into one line.
- The breakpoint is `md` (768px), with `useMobile()` = `(max-width: 767px)`. On coarse pointers, buttons, pills and inputs grow to at least 40px tall.
- Rhythm: 24px between page blocks, 8px between cards, 12–16px between controls.

## Elevation & Depth

This is mostly a tonal system: depth comes from paper (white) sitting on linen (stone) and from tinted columns. Shadows are short and soft, and they grow only in response to state.

### Shadow Vocabulary
- **Paper rest** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.04)`): cards, lists, pills at rest.
- **Paper lift** (`box-shadow: 0 4px 12px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)`): an interactive card on hover.
- **Popover** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.08), 0 1px 3px rgb(0 0 0 / 0.06)`): dropdown menus and filter popovers.
- **Floating button** (`box-shadow: 0 8px 20px rgb(79 70 229 / 0.35), 0 2px 6px rgb(0 0 0 / 0.12)`): only the FAB.

### Named Rules
**The Paper on Linen Rule.** Hierarchy is resolved with tone (paper on linen, tinted columns) before reaching for a shadow. A shadow appears only on hover, on floating layers, or on the FAB.

## Shapes

Every corner is soft. The scale runs: 4px for badges, 6px for buttons and inputs, 8px for cards and nav items, 12px for popovers and dialogs, 16px for kanban columns, and fully round for pills, avatars, chips and the FAB. Borders are 1px hairlines. The logo is a 20px square with 5px corners and a white check.

## Components

### Buttons
- **Shape:** gently curved corners (6px), 36px tall (32px small, at least 40px on touch screens), with a 16px icon and a 6px gap before the label.
- **Primary:** Índigo Acuérdalo with white text, one per screen ("Nueva tarea", "Nuevo evento"). Hover goes to Índigo profundo.
- **Secondary:** paper with a hairline border and Tinta suave text. Hover goes to stone.
- **Ghost:** no border. Used for "Limpiar", the period arrows and close buttons.
- **Danger:** paper with a red border and red text, for deletes.
- **Focus:** a 2px indigo ring at 60% with a 1px offset, applied to everything interactive.

### Chips (filter pills)
- **Style:** a 32px rounded pill on paper with a hairline border, a gray 16px icon, the label and a chevron.
- **Active:** Niebla índigo background, Tinta índigo text, an indigo icon, and a built-in × that clears the filter. A pill with a value shows the value in place of the label ("Alta" instead of "Prioridad").
- **Quick filters** ("Mis tareas", "Vencidas", "Vencen pronto") are toggles with `aria-pressed`.
- **On mobile** the popover becomes a bottom sheet.

### Cards / Containers
- **Task card:** paper, 8px corners, 14px padding, Paper rest shadow and Paper lift on hover. It holds the priority in a tinted square, the title in body strong, a meta row (type badge with a tag icon, due date with urgency) and an avatar stack.
- **Kanban column:** the status tint (stone, indigo mist, green mist), 16px corners and 8px padding. The header shows the status icon, the label and a counter in a pill with a matching ring. An empty column shows a dashed "Arrastra una tarea aquí".
- **List:** groups by status on paper, with a tinted header that collapses (completed starts collapsed) and rows with a status button that advances the status with one tap.

### Inputs / Fields
- **Style:** paper, a hairline border, 6px corners, 36px tall.
- **Focus:** the border turns indigo and gets a 2px ring at 20%.
- **Error:** red border and ring with `aria-invalid`.

### Navigation
- **Style:** fixed translucent paper. Items get a 16px icon plus a label at 14px, 36px tall, with 8px corners.
- **Active:** Niebla índigo background with an indigo icon. Inactive items use Tinta suave and turn stone on hover.
- **Administration** lives in a dropdown with a shield icon. On mobile the logo shows only its mark, and the admin links go into the avatar menu along with "Cerrar sesión".

### Segmented control
A stone track with 2px padding. The active option sits on paper with a fine border and a soft shadow, and its icon turns indigo. It switches Tablero/Lista and Mes/Semana/Día.

### Avatar
Initials in weight 600 on the tint of the person's color (a stable hash of the name), with a 2px white ring. Sizes are 24px and 32px, stacked with a slight overlap.

### Empty states
An icon in a round tinted badge (indigo mist, or neutral when filtering), a title, one line of explanation, and an action ("Crear la primera tarea", "Limpiar filtros", "Crear evento").

## Do's and Don'ts

### Do:
- **Do** put a lucide icon (16px, 1.5 stroke) next to every navigation label, filter and status.
- **Do** pair every color with an icon or text (the Never Color Alone Rule).
- **Do** use `tabular-nums` on dates, times and counters.
- **Do** give every list or board an empty state with an action, never a bare "No hay datos".
- **Do** simplify on mobile: list instead of kanban, agenda instead of time grid, a floating button for creating, and bottom sheets for choosing.
- **Do** keep the copy in direct Spanish addressed as *tú*, with controls that name their action.

### Don't:
- **Don't** add a second accent color or use indigo as decoration (the One Ink Rule).
- **Don't** use a colored `border-left` thicker than 1px on cards or list rows. Mark color with a dot or a tinted square.
- **Don't** use emoji or Unicode glyphs in place of icons.
- **Don't** apply heavy or hard-offset shadows. Depth is tonal first (the Paper on Linen Rule).
- **Don't** go back to a cold gray background (`zinc-50`) for the page. The base is Lino Cálido.
