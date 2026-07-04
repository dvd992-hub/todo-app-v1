# To-Do App

A clean, fully client-side task manager built with vanilla HTML, CSS, and JavaScript.
No frameworks. No build tools. No server required.

---

## Project structure

```
todo-app/
│
├── index.html            Main HTML page + edit modal
│
├── css/
│   └── style.css         All styles; CSS custom properties for theming
│
├── js/
│   ├── i18n.js           Translations module (EN / IT)
│   └── script.js         Application logic, rendering, storage
│
├── assets/
│   └── favicon/
│       ├── favicon.svg   SVG favicon (green rounded square + checkmark)
│       └── favicon.ico   ICO favicon — multi-size (16, 32, 48, 64, 128, 256 px)
│
└── README.md             This file
```

---

## Getting started

1. Download all files keeping the folder structure intact
2. Open `index.html` in any modern browser
3. Done — no installation, no server, no internet required after first load

> **Icons** are loaded from the jsDelivr CDN ([Tabler Icons](https://tabler.io/icons)).
> The first visit needs an internet connection; after that the browser caches them.

---

## Features

### Theme — Light / Dark / System

Three buttons in the top-right corner control the colour scheme:

| Icon | Mode   | Behaviour                              |
|------|--------|----------------------------------------|
| 🖥   | System | Follows the OS preference automatically |
| ☀️   | Light  | Forces the light theme                  |
| 🌙   | Dark   | Forces the dark theme                   |

The choice is persisted in `localStorage` (`todo_theme`) and restored on every visit.
Theme switching uses CSS custom properties (`--color-*`) re-defined on `[data-theme="dark"]`,
so the change is instant and flicker-free.
The app also reacts live to OS-level theme changes while in *System* mode.

---

### Language — English / Italian

A **EN / IT** toggle button sits in the header next to the theme switcher.

**How language detection works (hybrid approach):**

1. On first visit, `navigator.language` is read (e.g. `"it-IT"` → `"it"`)
2. If the detected locale is not supported, English is used as fallback
3. The user's manual choice is saved to `localStorage` (`todo_lang`)
4. On subsequent visits the saved preference takes precedence over the browser language

All UI strings (labels, badges, aria attributes, notification text, date format) switch
instantly without a page reload.
Translations live in `js/i18n.js` inside the `TRANSLATIONS` object — easy to extend
with new languages.

---

### Task types

| Type         | Behaviour                                                                                   |
|--------------|---------------------------------------------------------------------------------------------|
| **Daily**    | Stays in the list permanently. Completion resets at midnight. Ideal for habits.             |
| **One-time** | Disappears from the active list once completed. Ideal for single tasks.                     |

---

### Repeat modes (daily tasks only)

**Specific days**
Select one or more weekdays by clicking the Mon–Sun buttons.
Example: Gym on Monday, Wednesday, and Friday.

**Every N days**
Enter a number: the task is active every N days counted from a fixed epoch (1 January 2025).
This guarantees consistent scheduling across sessions regardless of when the task was created.
Example: with interval 2, the task is active on day 0, 2, 4, 6 …

Tasks not scheduled for today are shown in a dedicated *Not scheduled today* section
instead of disappearing.

---

### Time slots

Each task can have an optional start and end time (e.g. `07:00 – 08:00`).

- Tasks are **sorted by start time** within each section
- If the start time is **within the next 30 minutes**, the badge turns amber and the card
  gets a green border highlight
- Tasks without a time slot appear at the bottom of the section

---

### Browser notifications

Click the **Notifications** button in the header to request permission.

Once granted:
- Each task with a start time gets a configurable lead time: at start, 5 / 10 / 15 / 30 min before
- The notification body shows the task name and time slot
- If the task is completed before the notification fires, it is suppressed
- All timers are rescheduled on every UI update (with `clearTimeout` guards to prevent duplicates)

Button states:

| Colour  | Meaning                                         |
|---------|-------------------------------------------------|
| Default | Permission not yet requested                    |
| Green   | Notifications granted                           |
| Red     | Notifications blocked — unblock in browser settings |

> Notifications require the browser tab to be open. These are not push notifications.

---

### Editing tasks

Hovering over a task card reveals two icon buttons:

| Button     | Action                                                              |
|------------|---------------------------------------------------------------------|
| ✏️ Pencil  | Opens the edit modal, pre-filled with the task's current values    |
| 🗑 Trash   | Deletes the task immediately (also clears any pending notification) |

The edit modal lets you change every property:
- Text, type, priority
- Repeat mode, weekdays, interval
- Time slot, reminder offset

The completion **history is always preserved** — editing a task does not erase past data.

**Close the modal with:**
- *Cancel* button
- *×* button
- `Escape` key
- Click outside the panel

---

### History dots & streaks

Daily tasks display a row of 7 dots representing the last 7 days:

| Dot colour  | Meaning                      |
|-------------|------------------------------|
| Green       | Completed                    |
| Red         | Scheduled but missed         |
| Light grey  | Not scheduled that day       |

A **streak counter** (e.g. `5d`) appears next to the dots when 2 or more consecutive
days have been completed.

---

### Midnight reset

At midnight, the completion state of all daily tasks resets automatically.
The countdown chip in the header shows the time remaining to the next reset.
The reset works purely by key comparison (`todayKey()` changes at midnight) — no data
is deleted.

---

### Statistics

| Card        | Description                                          |
|-------------|------------------------------------------------------|
| Done today  | Total tasks completed today                          |
| Day streak  | Longest active streak among today's daily habits     |
| Completion  | Percentage of today's tasks completed                |

---

## Data persistence

All data is stored in the browser's `localStorage`:

| Key              | Contents                  |
|------------------|---------------------------|
| `todo_v5_tasks`  | Task array (JSON)         |
| `todo_theme`     | Saved theme preference    |
| `todo_lang`      | Saved language preference |

Data is local to the device and browser — nothing is sent to any server.

**To reset everything**, open the browser console and run:

```js
localStorage.removeItem('todo_v5_tasks');
localStorage.removeItem('todo_theme');
localStorage.removeItem('todo_lang');
```

---

## Favicon

The project ships two favicon formats for maximum compatibility:

```html
<link rel="icon" type="image/svg+xml" href="assets/favicon/favicon.svg" />
<link rel="icon" type="image/x-icon"  href="assets/favicon/favicon.ico" />
```

| File           | Format | Sizes                              | Used by                          |
|----------------|--------|------------------------------------|----------------------------------|
| `favicon.svg`  | SVG    | Scalable (vector)                  | Chrome, Firefox, Edge (modern)   |
| `favicon.ico`  | ICO    | 16, 32, 48, 64, 128, 256 px        | All browsers, OS taskbars, bookmarks |

Both show the same design: a green rounded square with a white checkmark.

---

## Browser compatibility

| Browser | Minimum version |
|---------|-----------------|
| Chrome  | 80+             |
| Firefox | 75+             |
| Safari  | 13+             |
| Edge    | 80+             |

> Browser notifications are not supported in Safari on iOS.
> The *System* theme mode requires `prefers-color-scheme` support (all modern browsers).

---

## Adding a new language

1. Open `js/i18n.js`
2. Add a new key inside `TRANSLATIONS` (copy the `en` block and translate all strings)
3. In `index.html`, update the language toggle `onclick` to cycle through the new locale
4. In `script.js → setLanguage()`, handle the new locale in the cycle

---

## Technical notes

| Topic              | Detail                                                                                   |
|--------------------|------------------------------------------------------------------------------------------|
| **No dependencies** | Pure HTML, CSS, JS — no npm, no bundler                                                 |
| **Theme system**   | CSS custom properties on `:root` / `[data-theme="dark"]`; `data-theme` set by JS on `<html>` |
| **i18n module**    | IIFE pattern; exposes `detectLocale`, `setLocale`, `t`, `getLocale`                     |
| **Daily reset**    | `todayKey()` returns `YYYY-MM-DD`; history stored as `{ date: true }`; no data deleted  |
| **Every N days**   | Fixed epoch (2025-01-01) ensures consistent day parity across all sessions               |
| **Notifications**  | `clearTimeout` before rescheduling prevents duplicates; completion re-checked at fire time |
| **Edit modal**     | Task `history` is never touched during edits; only mutable fields are updated            |
| **XSS protection** | User text always inserted via `textContent` or `escHtml()`, never via raw `innerHTML`   |
| **Favicon**        | SVG (vector, modern browsers) + ICO (6 sizes, universal fallback)                       |
