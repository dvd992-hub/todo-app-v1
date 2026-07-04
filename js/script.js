/**
 * js/script.js
 *
 * To-Do App — main application logic.
 *
 * Responsibilities:
 *  - Task CRUD (add, toggle, edit, delete)
 *  - Daily reset logic (history-key based, resets at midnight)
 *  - Repeat modes: specific weekdays | every N days
 *  - Time slots (start–end) with "upcoming soon" detection
 *  - Browser notifications with configurable lead time
 *  - Theme management (light / dark / system) via CSS variables
 *  - Language switching (EN / IT) via i18n module
 *  - Full UI rendering (task list, stats, modal)
 *  - Data persistence via localStorage
 *
 * Dependencies: js/i18n.js (must be loaded before this file)
 */


/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */

/** CSS priority badge class names */
const PRIO_CLASS = { high: 'badge-prio-high', med: 'badge-prio-med', low: 'badge-prio-low' };

/**
 * Fixed epoch for "every N days" calculation.
 * Shared across all sessions so the same day is consistently
 * active or inactive regardless of when the task was created.
 */
const INTERVAL_EPOCH = new Date('2025-01-01');

/** localStorage keys */
const LS_TASKS  = 'todo_v5_tasks';
const LS_THEME  = 'todo_theme';
const LS_NOTIF  = 'todo_notif_enabled';


/* ─────────────────────────────────────────────────────────────
   GLOBAL STATE
───────────────────────────────────────────────────────────── */

/** Task type selected in the add form: 'daily' | 'once' */
let formTaskType   = 'daily';

/** Repeat mode selected in the add form: 'days' | 'interval' */
let formRepeatMode = 'days';

/** Weekday indices selected in the add form (0=Mon … 6=Sun) */
let formDays       = [];

/** Auto-incrementing ID counter */
let nextId         = 1;

/** Current browser notification permission state */
let notifPermission = Notification.permission;

/**
 * Whether the user has chosen to enable notifications.
 * Separate from notifPermission (browser-level grant) — this is the user toggle.
 * Notifications fire only when BOTH are true.
 */
let notifEnabled = localStorage.getItem(LS_NOTIF) !== 'false';

/**
 * Active notification timeouts: { taskId: timeoutId }
 * Kept so we can clearTimeout before rescheduling.
 */
let scheduledNotifs = {};

/** Current theme preference: 'system' | 'light' | 'dark' */
let currentTheme = 'system';

/** Repeat mode inside the edit modal */
let editRepeatMode = 'days';

/** Weekday indices selected inside the edit modal */
let editDays = [];


/* ─────────────────────────────────────────────────────────────
   TASK DATA MODEL
   Each task object has this shape:
   {
     id:          number,
     text:        string,
     type:        'daily' | 'once',
     prio:        'low' | 'med' | 'high',
     repeatMode:  'days' | 'interval',   // daily only
     days:        number[],              // weekday indices (repeatMode='days')
     interval:    number,                // N in "every N days" (repeatMode='interval')
     timeStart:   string,                // 'HH:MM' or ''
     timeEnd:     string,                // 'HH:MM' or ''
     notifOffset: number,                // minutes of lead time for notifications
     history:     { 'YYYY-MM-DD': true },// completion log (daily only)
     done:        boolean,               // once only
   }
───────────────────────────────────────────────────────────── */

/** Default tasks shown on first launch */
const DEFAULT_TASKS = [
  {
    id: 1, text: 'Gym',
    type: 'daily', prio: 'high',
    repeatMode: 'days', days: [0, 2, 4], interval: 1,
    timeStart: '07:00', timeEnd: '08:00', notifOffset: 10,
    history: {}
  },
  {
    id: 2, text: 'Study',
    type: 'daily', prio: 'high',
    repeatMode: 'interval', days: [], interval: 1,
    timeStart: '09:00', timeEnd: '11:00', notifOffset: 10,
    history: {}
  },
  {
    id: 3, text: 'Meditation',
    type: 'daily', prio: 'low',
    repeatMode: 'days', days: [0, 1, 2, 3, 4, 5, 6], interval: 1,
    timeStart: '07:00', timeEnd: '07:20', notifOffset: 5,
    history: {}
  },
  {
    id: 4, text: 'Buy milk',
    type: 'once', prio: 'low',
    repeatMode: 'days', days: [], interval: 1,
    timeStart: '', timeEnd: '', notifOffset: 10,
    done: false, history: {}
  },
];

let tasks = loadTasks() || DEFAULT_TASKS;
nextId    = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;


/* ─────────────────────────────────────────────────────────────
   PERSISTENCE
───────────────────────────────────────────────────────────── */

/** Loads tasks from localStorage. Returns null on error or if empty. */
function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_TASKS);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[todo] Failed to load tasks:', e);
    return null;
  }
}

/** Saves the current tasks array to localStorage. */
function saveTasks() {
  try {
    localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.warn('[todo] Failed to save tasks:', e);
  }
}


/* ─────────────────────────────────────────────────────────────
   THEME
───────────────────────────────────────────────────────────── */

/**
 * Applies a theme by setting data-theme on <html>.
 * In 'system' mode, reads the OS preference via matchMedia.
 *
 * @param {'light'|'dark'|'system'} theme
 */
function applyTheme(theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/**
 * Switches the theme, persists the choice, and updates the toggle buttons.
 *
 * @param {'light'|'dark'|'system'} theme
 * @param {HTMLElement} btn - the button that was clicked
 */
function setTheme(theme, btn) {
  currentTheme = theme;
  localStorage.setItem(LS_THEME, theme);
  applyTheme(theme);
  document.querySelectorAll('.theme-toggle button')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/**
 * Reads the saved theme preference and applies it on startup.
 * Also marks the correct toggle button as active.
 */
function initTheme() {
  const saved = localStorage.getItem(LS_THEME) || 'system';
  currentTheme = saved;
  applyTheme(saved);
  const map = { system: 'btn-theme-system', light: 'btn-theme-light', dark: 'btn-theme-dark' };
  document.querySelectorAll('.theme-toggle button')
          .forEach(b => b.classList.remove('active'));
  document.getElementById(map[saved])?.classList.add('active');
}

/* React to OS-level theme changes when in 'system' mode */
window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (currentTheme === 'system') applyTheme('system');
      });


/* ─────────────────────────────────────────────────────────────
   LANGUAGE
───────────────────────────────────────────────────────────── */

/**
 * Switches the UI language.
 * Saves the preference, updates the toggle button label,
 * re-renders all dynamic strings, and updates static HTML strings.
 *
 * @param {string} locale - 'en' | 'it'
 */
function setLanguage(locale) {
  i18n.setLocale(locale);
  updateStaticStrings();
  updateLangBtn();
  render();
}

/**
 * Updates all static HTML strings that are not re-rendered by render().
 * Called on startup and on every language switch.
 */
function updateStaticStrings() {
  const t = i18n.t.bind(i18n);

  /* Page title */
  document.title = t('appTitle');
  const h1 = document.querySelector('.hdr h1');
  if (h1) h1.textContent = t('appTitle');

  /* Theme button titles */
  document.getElementById('btn-theme-system')?.setAttribute('title', t('themeSystem'));
  document.getElementById('btn-theme-light')?.setAttribute('title',  t('themeLight'));
  document.getElementById('btn-theme-dark')?.setAttribute('title',   t('themeDark'));

  /* Notification button */
  updateNotifBtn();

  /* Form labels */
  setTextById('label-type',     t('formType'));
  setTextById('label-priority', t('formPriority'));
  setTextById('label-repeat',   t('formRepeat'));
  setTextById('label-time',     t('formTime'));
  setTextById('label-reminder', t('formReminder'));
  setTextById('label-time-sep', t('formTimeSep'));
  setTextById('label-edit-type',     t('formType'));
  setTextById('label-edit-priority', t('formPriority'));
  setTextById('label-edit-repeat',   t('formRepeat'));
  setTextById('label-edit-time',     t('formTime'));
  setTextById('label-edit-reminder', t('formReminder'));
  setTextById('label-edit-time-sep', t('formTimeSep'));

  /* Form — input placeholder */
  const inp = document.getElementById('new-task');
  if (inp) inp.placeholder = t('formPlaceholder');
  const editInp = document.getElementById('edit-text');
  if (editInp) editInp.placeholder = t('formPlaceholder');

  /* Form — type toggle buttons */
  setHtmlById('btn-type-daily', `<i class="ti ti-repeat" aria-hidden="true"></i>${t('typeDaily')}`);
  setHtmlById('btn-type-once',  `<i class="ti ti-calendar-event" aria-hidden="true"></i>${t('typeOnce')}`);
  setHtmlById('btn-edit-type-daily', `<i class="ti ti-repeat" aria-hidden="true"></i>${t('typeDaily')}`);
  setHtmlById('btn-edit-type-once',  `<i class="ti ti-calendar-event" aria-hidden="true"></i>${t('typeOnce')}`);

  /* Form — repeat mode buttons */
  setTextById('btn-repeat-days',     t('repeatSpecific'));
  setTextById('btn-repeat-interval', t('repeatInterval'));
  setTextById('btn-edit-repeat-days',     t('repeatSpecific'));
  setTextById('btn-edit-repeat-interval', t('repeatInterval'));

  /* Form — day buttons (both add form and edit modal) */
  const days = t('days');
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.textContent = days[parseInt(btn.dataset.d)];
  });

  /* Form — interval labels */
  document.querySelectorAll('.interval-every').forEach(el => el.textContent = t('intervalEvery'));
  document.querySelectorAll('.interval-days').forEach(el  => el.textContent = t('intervalDays'));

  /* Form — priority select options */
  updateSelectOptions('prio-sel', [
    { value: 'low', label: t('prioLow')  },
    { value: 'med', label: t('prioMed')  },
    { value: 'high', label: t('prioHigh') },
  ]);
  updateSelectOptions('edit-prio', [
    { value: 'low', label: t('prioLow')  },
    { value: 'med', label: t('prioMed')  },
    { value: 'high', label: t('prioHigh') },
  ]);

  /* Form — reminder select options */
  const reminderOpts = [
    { value: '0',  label: t('reminderAt')  },
    { value: '5',  label: t('reminder5')   },
    { value: '10', label: t('reminder10')  },
    { value: '15', label: t('reminder15')  },
    { value: '30', label: t('reminder30')  },
  ];
  updateSelectOptions('notif-offset', reminderOpts);
  updateSelectOptions('edit-notif-offset', reminderOpts);

  /* Form — add button */
  setHtmlById('btn-add', `<i class="ti ti-plus" aria-hidden="true"></i> ${t('formAddBtn')}`);

  /* Stats labels */
  setTextById('stat-lbl-done',   t('statDone'));
  setTextById('stat-lbl-streak', t('statStreak'));
  setTextById('stat-lbl-pct',    t('statPct'));

  /* Modal */
  setTextById('modal-title',  t('modalTitle'));
  setTextById('btn-modal-cancel', t('modalCancel'));
  setHtmlById('btn-modal-save', `<i class="ti ti-check" aria-hidden="true"></i> ${t('modalSave')}`);
  document.getElementById('btn-modal-close')?.setAttribute('aria-label', t('modalClose'));
}

/** Updates the language toggle button to show the OTHER available language */
function updateLangBtn() {
  const btn  = document.getElementById('btn-lang');
  if (!btn) return;
  const next = i18n.getLocale() === 'en' ? 'IT' : 'EN';
  btn.textContent = next;
  btn.setAttribute('title', i18n.t('langToggleTitle'));
}

/** Helper: sets textContent safely */
function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Helper: sets innerHTML safely (for elements containing icons) */
function setHtmlById(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/**
 * Updates a <select> element's option labels while preserving the current value.
 * @param {string} id - select element ID
 * @param {{ value: string, label: string }[]} options
 */
function updateSelectOptions(id, options) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = options
    .map(o => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${escHtml(o.label)}</option>`)
    .join('');
}


/* ─────────────────────────────────────────────────────────────
   DATE / TIME UTILITIES
───────────────────────────────────────────────────────────── */

/** Returns today's date as 'YYYY-MM-DD' (used as history key) */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns today's weekday index normalised to Mon=0 … Sun=6.
 * (JS native: Sun=0, Mon=1 — we shift so Mon=0)
 */
function todayDow() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

/**
 * Converts 'HH:MM' to minutes since midnight.
 * Returns null for empty or invalid strings.
 * e.g. '09:30' → 570
 */
function timeToMin(s) {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Returns current time as minutes since midnight */
function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Formats 'HH:MM' for display (passthrough, kept for future locale use) */
function formatTime(s) {
  if (!s) return '';
  const [h, m] = s.split(':');
  return `${h}:${m}`;
}

/**
 * Escapes HTML special characters to prevent XSS
 * when inserting user-supplied text into the DOM.
 */
function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}


/* ─────────────────────────────────────────────────────────────
   TASK LOGIC
───────────────────────────────────────────────────────────── */

/**
 * Returns true if the task is scheduled for today.
 *
 * - once:               always active until completed
 * - daily + days:       active if today's weekday is in task.days
 *                       (empty days array = every day)
 * - daily + interval:   active if days since EPOCH is divisible by interval
 */
function isActiveToday(task) {
  if (task.type === 'once') return !task.done;

  if (task.repeatMode === 'days') {
    return task.days.length === 0 || task.days.includes(todayDow());
  }

  if (task.repeatMode === 'interval') {
    const today    = new Date(todayKey());
    const diffDays = Math.floor((today - INTERVAL_EPOCH) / 86_400_000);
    return diffDays % task.interval === 0;
  }

  return true;
}

/** Returns true if the task has been completed today */
function isDoneToday(task) {
  if (task.type === 'once') return !!task.done;
  return !!task.history[todayKey()];
}

/**
 * Returns true if the task's start time is within the next 30 minutes.
 * Used to highlight the card and show the "soon" badge.
 */
function isUpcomingSoon(task) {
  if (!task.timeStart) return false;
  const diff = timeToMin(task.timeStart) - nowMin();
  return diff > 0 && diff <= 30;
}

/**
 * Calculates the consecutive-day streak for a daily task.
 * Walks backwards from yesterday; adds 1 if also completed today.
 *
 * @param {object} task
 * @returns {number}
 */
function getStreak(task) {
  if (task.type === 'once') return 0;

  let streak = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1);

  while (streak < 365) {
    const k = d.toISOString().slice(0, 10);
    if (task.history[k]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  if (task.history[todayKey()]) streak++;
  return streak;
}

/**
 * Returns an array of 7 state strings for the last 7 days (oldest → today).
 * 'ok'   → completed
 * 'miss' → scheduled but not completed
 * 'skip' → not scheduled that day
 *
 * @param {object} task
 * @returns {('ok'|'miss'|'skip')[]}
 */
function getLast7(task) {
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k   = d.toISOString().slice(0, 10);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;

    /* Was the task scheduled on this past day? */
    let scheduled = true;
    if (task.repeatMode === 'days' && task.days.length > 0) {
      scheduled = task.days.includes(dow);
    }
    if (task.repeatMode === 'interval') {
      const diffDays = Math.floor((d - INTERVAL_EPOCH) / 86_400_000);
      scheduled = diffDays % task.interval === 0;
    }

    if (!scheduled) {
      result.push('skip');
    } else if (i === 0) {
      result.push(isDoneToday(task) ? 'ok' : 'miss');
    } else {
      result.push(task.history?.[k] ? 'ok' : 'miss');
    }
  }

  return result;
}


/* ─────────────────────────────────────────────────────────────
   TASK ACTIONS
───────────────────────────────────────────────────────────── */

/**
 * Toggles today's completion state for a task.
 * - once:  flips task.done
 * - daily: flips task.history[todayKey()]
 */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (task.type === 'once') {
    task.done = !task.done;
  } else {
    const k = todayKey();
    task.history[k] = !task.history[k];
  }

  saveTasks();
  render();
}

/**
 * Permanently removes a task.
 * Also clears any pending notification timeout for it.
 */
function deleteTask(id) {
  if (scheduledNotifs[id]) {
    clearTimeout(scheduledNotifs[id]);
    delete scheduledNotifs[id];
  }
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

/** Reads the add form and creates a new task at the top of the list */
function addTask() {
  const input = document.getElementById('new-task');
  const text  = input.value.trim();
  if (!text) return;

  const newTask = {
    id:          nextId++,
    text,
    type:        formTaskType,
    prio:        document.getElementById('prio-sel').value,
    repeatMode:  formRepeatMode,
    days:        [...formDays].sort(),
    interval:    parseInt(document.getElementById('interval-val').value) || 1,
    timeStart:   document.getElementById('time-start').value,
    timeEnd:     document.getElementById('time-end').value,
    notifOffset: parseInt(document.getElementById('notif-offset').value) || 0,
    history:     {},
  };

  if (formTaskType === 'once') newTask.done = false;

  tasks.unshift(newTask);
  input.value = '';
  saveTasks();
  render();
}


/* ─────────────────────────────────────────────────────────────
   ADD FORM — UI INTERACTIONS
───────────────────────────────────────────────────────────── */

/** Switches the task type in the add form */
function setFormType(type, btn) {
  formTaskType = type;
  document.querySelectorAll('#form-type-toggle button')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('repeat-panel')
          .classList.toggle('show', type === 'daily');
}

/** Switches the repeat mode in the add form */
function setFormRepeatMode(mode, btn) {
  formRepeatMode = mode;
  document.querySelectorAll('#form-repeat-mode button')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rp-days').style.display     = mode === 'days'     ? '' : 'none';
  document.getElementById('rp-interval').style.display = mode === 'interval' ? '' : 'none';
}

/* Day button click handler — add form */
document.querySelectorAll('#form-days-row .day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = parseInt(btn.dataset.d);
    if (formDays.includes(d)) {
      formDays = formDays.filter(x => x !== d);
      btn.classList.remove('sel');
    } else {
      formDays.push(d);
      btn.classList.add('sel');
    }
  });
});

/* Add task on Enter key */
document.getElementById('new-task')
        .addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

/* Show/hide reminder row when start time changes */
document.getElementById('time-start').addEventListener('change', () => {
  updateNotifRows();
});


/* ─────────────────────────────────────────────────────────────
   EDIT MODAL
───────────────────────────────────────────────────────────── */

/**
 * Opens the edit modal pre-filled with the task's current values.
 * @param {number} id - task ID to edit
 */
function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  /* Populate simple fields */
  document.getElementById('edit-id').value              = id;
  document.getElementById('edit-text').value            = task.text;
  document.getElementById('edit-prio').value            = task.prio;
  document.getElementById('edit-time-start').value      = task.timeStart || '';
  document.getElementById('edit-time-end').value        = task.timeEnd   || '';
  document.getElementById('edit-interval').value        = task.interval  || 1;
  document.getElementById('edit-notif-offset').value    = task.notifOffset || 10;

  /* Type toggle */
  document.querySelectorAll('#edit-type-toggle button')
          .forEach((b, i) => b.classList.toggle('active',
            (i === 0 && task.type === 'daily') || (i === 1 && task.type === 'once')
          ));

  /* Repeat panel visibility */
  document.getElementById('edit-repeat-panel').style.display =
    task.type === 'daily' ? '' : 'none';

  /* Repeat mode */
  editRepeatMode = task.repeatMode || 'days';
  editDays       = [...(task.days || [])];

  document.querySelectorAll('#edit-repeat-mode button')
          .forEach((b, i) => b.classList.toggle('active',
            (i === 0 && editRepeatMode === 'days') ||
            (i === 1 && editRepeatMode === 'interval')
          ));

  document.getElementById('edit-rp-days').style.display     = editRepeatMode === 'days'     ? '' : 'none';
  document.getElementById('edit-rp-interval').style.display = editRepeatMode === 'interval' ? '' : 'none';

  /* Day buttons in modal */
  document.querySelectorAll('#edit-days-row .day-btn').forEach(btn => {
    btn.classList.toggle('sel', editDays.includes(parseInt(btn.dataset.d)));
  });

  /* Reminder row */
  document.getElementById('edit-notif-row').style.display =
    (notifPermission === 'granted' && notifEnabled && task.timeStart) ? '' : 'none';

  /* Show modal and focus text field */
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('edit-text').focus();
}

/** Closes the edit modal */
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

/** Closes the modal when clicking on the backdrop (outside the panel) */
function closeModalOutside(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

/* Close modal with Escape key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/** Switches the task type inside the edit modal */
function setEditType(type, btn) {
  document.querySelectorAll('#edit-type-toggle button')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('edit-repeat-panel').style.display =
    type === 'daily' ? '' : 'none';
}

/** Switches the repeat mode inside the edit modal */
function setEditRepeatMode(mode, btn) {
  editRepeatMode = mode;
  document.querySelectorAll('#edit-repeat-mode button')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('edit-rp-days').style.display     = mode === 'days'     ? '' : 'none';
  document.getElementById('edit-rp-interval').style.display = mode === 'interval' ? '' : 'none';
}

/* Day button click handler — edit modal */
document.querySelectorAll('#edit-days-row .day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = parseInt(btn.dataset.d);
    if (editDays.includes(d)) {
      editDays = editDays.filter(x => x !== d);
      btn.classList.remove('sel');
    } else {
      editDays.push(d);
      btn.classList.add('sel');
    }
  });
});

/**
 * Reads the modal form values and updates the task object.
 * The completion history is always preserved.
 */
function saveEdit() {
  const id   = parseInt(document.getElementById('edit-id').value);
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const text = document.getElementById('edit-text').value.trim();
  if (!text) return;

  /* Determine new type from the active button index */
  const activeBtnIdx = [...document.querySelectorAll('#edit-type-toggle button')]
                         .findIndex(b => b.classList.contains('active'));
  const newType = activeBtnIdx === 0 ? 'daily' : 'once';

  /* Update all fields */
  task.text        = text;
  task.prio        = document.getElementById('edit-prio').value;
  task.timeStart   = document.getElementById('edit-time-start').value;
  task.timeEnd     = document.getElementById('edit-time-end').value;
  task.notifOffset = parseInt(document.getElementById('edit-notif-offset').value) || 0;

  if (newType === 'daily') {
    task.type       = 'daily';
    task.repeatMode = editRepeatMode;
    task.days       = [...editDays].sort();
    task.interval   = parseInt(document.getElementById('edit-interval').value) || 1;
    delete task.done;
    if (!task.history) task.history = {};
  } else {
    task.type = 'once';
    if (task.done === undefined) task.done = false;
  }

  saveTasks();
  closeModal();
  render();
}


/* ─────────────────────────────────────────────────────────────
   BROWSER NOTIFICATIONS
───────────────────────────────────────────────────────────── */

/**
 * Main handler for the notification button click.
 *
 * Behaviour matrix:
 *  - Permission not yet requested → ask the browser, enable if granted
 *  - Permission granted + enabled  → disable (user toggle off)
 *  - Permission granted + disabled → enable (user toggle on)
 *  - Permission denied             → inform the user (nothing we can do)
 */
function requestNotifications() {
  if (!('Notification' in window)) {
    alert(i18n.t('notifUnsupported'));
    return;
  }

  if (notifPermission === 'denied') {
    alert(i18n.t('notifDeniedHint'));
    return;
  }

  if (notifPermission === 'granted') {
    /* Toggle the user-level switch */
    notifEnabled = !notifEnabled;
    localStorage.setItem(LS_NOTIF, String(notifEnabled));
    updateNotifBtn();
    updateNotifRows();
    scheduleAllNotifs();
    return;
  }

  /* Permission not yet requested — ask the browser */
  Notification.requestPermission().then(permission => {
    notifPermission = permission;

    if (permission === 'granted') {
      notifEnabled = true;
      localStorage.setItem(LS_NOTIF, 'true');
      updateNotifRows();
      scheduleAllNotifs();
    }

    updateNotifBtn();
  });
}

/**
 * Shows or hides the reminder <select> rows in both the add form
 * and the edit modal based on the current notification state.
 */
function updateNotifRows() {
  const active = notifPermission === 'granted' && notifEnabled;

  const hasAddTime  = !!document.getElementById('time-start').value;
  const hasEditTime = !!document.getElementById('edit-time-start')?.value;

  document.getElementById('notif-row').style.display =
    (active && hasAddTime) ? '' : 'none';

  const editRow = document.getElementById('edit-notif-row');
  if (editRow) editRow.style.display = (active && hasEditTime) ? '' : 'none';
}

/**
 * Updates the notification button appearance to reflect the combined state
 * of browser permission + user toggle.
 *
 * States:
 *  granted + enabled  → green  "Notifications on"
 *  granted + disabled → default (muted) "Notifications off"
 *  denied             → red    "Blocked"
 *  default            → default "Enable notifications"
 */
function updateNotifBtn() {
  const btn = document.getElementById('btn-notif');
  const lbl = document.getElementById('notif-label');
  if (!btn || !lbl) return;

  if (notifPermission === 'granted' && notifEnabled) {
    btn.className   = 'icon-btn granted';
    lbl.textContent = i18n.t('notifGranted');
  } else if (notifPermission === 'granted' && !notifEnabled) {
    btn.className   = 'icon-btn';
    lbl.textContent = i18n.t('notifDisabled');
  } else if (notifPermission === 'denied') {
    btn.className   = 'icon-btn denied';
    lbl.textContent = i18n.t('notifDenied');
  } else {
    btn.className   = 'icon-btn';
    lbl.textContent = i18n.t('notifEnable');
  }
}

/**
 * Schedules browser notifications for all tasks that have a start time,
 * are active today, and have not yet been completed.
 *
 * Always clears existing timeouts first to prevent duplicates.
 */
function scheduleAllNotifs() {
  Object.values(scheduledNotifs).forEach(id => clearTimeout(id));
  scheduledNotifs = {};

  if (notifPermission !== 'granted' || !notifEnabled) return;

  const now = nowMin();

  tasks.forEach(task => {
    if (!task.timeStart || isDoneToday(task) || !isActiveToday(task)) return;

    const fireAtMin = timeToMin(task.timeStart) - (task.notifOffset || 0);
    const diffMs    = (fireAtMin - now) * 60_000;

    if (diffMs > 0) {
      scheduledNotifs[task.id] = setTimeout(() => {
        /* Re-check at fire time: user may have completed it meanwhile */
        if (!isDoneToday(task)) {
          new Notification(i18n.t('notifTitle'), {
            body: `${task.text} — ${formatTime(task.timeStart)}${task.timeEnd ? ' – ' + formatTime(task.timeEnd) : ''}`,
            tag:  `todo-${task.id}`, /* prevents duplicate notifications */
          });
        }
      }, diffMs);
    }
  });
}


/* ─────────────────────────────────────────────────────────────
   COUNTDOWN
───────────────────────────────────────────────────────────── */

/**
 * Updates the countdown chip showing time remaining until midnight reset.
 * Called every second via setInterval.
 */
function updateCountdown() {
  const now      = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);

  const diff = midnight - now;
  const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((diff % 60_000)    / 1_000)).padStart(2, '0');

  const el = document.getElementById('countdown');
  if (el) el.textContent = `${i18n.t('resetLabel')} ${h}:${m}:${s}`;
}


/* ─────────────────────────────────────────────────────────────
   RENDERING
───────────────────────────────────────────────────────────── */

/**
 * Full UI re-render. Called on every state change and every minute.
 * Rebuilds the task list, updates stats, reschedules notifications.
 */
function render() {
  const t = i18n.t.bind(i18n);

  /* Update date string */
  const dateEl = document.getElementById('date-str');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(
      i18n.getLocale() === 'it' ? 'it-IT' : 'en-US',
      { weekday: 'long', day: 'numeric', month: 'long' }
    );
  }

  /* Partition tasks into four sections */
  const daily    = tasks.filter(tk => tk.type === 'daily' &&  isActiveToday(tk));
  const once     = tasks.filter(tk => tk.type === 'once'  && !tk.done);
  const onceDone = tasks.filter(tk => tk.type === 'once'  &&  tk.done);
  const inactive = tasks.filter(tk => tk.type === 'daily' && !isActiveToday(tk));

  const container = document.getElementById('list-container');
  container.innerHTML = '';

  const totalCount = daily.length + once.length + onceDone.length + inactive.length;
  const emptyEl = document.getElementById('empty-state');
  if (emptyEl) emptyEl.style.display = totalCount === 0 ? '' : 'none';

  /**
   * Appends a labelled section to the container.
   * @param {string}   icon  - Tabler icon class (e.g. 'ti-repeat')
   * @param {string}   label - section heading text
   * @param {object[]} list  - tasks for this section
   * @param {boolean}  sort  - whether to sort by start time
   */
  function appendSection(icon, label, list, sort) {
    if (!list.length) return;

    const heading = document.createElement('div');
    heading.className = 'section-label';
    heading.innerHTML = `<i class="ti ${icon}" aria-hidden="true"></i>${escHtml(label)}`;
    container.appendChild(heading);

    const ul = document.createElement('div');
    ul.className = 'task-list';

    if (sort) {
      /* Timed tasks first, then untimed (9999 = no time → sort last) */
      list.sort((a, b) => (timeToMin(a.timeStart) ?? 9999) - (timeToMin(b.timeStart) ?? 9999));
    }

    list.forEach(tk => ul.appendChild(buildTaskCard(tk)));
    container.appendChild(ul);
  }

  appendSection('ti-repeat',        t('sectionToday'),    daily,    true);
  appendSection('ti-calendar-event', t('sectionTodo'),    once,     false);
  appendSection('ti-check',          t('sectionDone'),    onceDone, false);
  appendSection('ti-calendar-off',   t('sectionInactive'),inactive, false);

  /* Update stats bar */
  const doneCount  = daily.filter(isDoneToday).length + onceDone.length;
  const totalToday = daily.length + once.length + onceDone.length;
  const pct        = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;

  const progEl = document.getElementById('prog');
  if (progEl) progEl.style.width = pct + '%';
  setTextById('stat-done',   String(doneCount));
  setTextById('stat-pct',    pct + '%');

  const maxStreak = daily.length ? Math.max(...daily.map(getStreak)) : 0;
  setTextById('stat-streak', String(maxStreak));

  scheduleAllNotifs();
}

/**
 * Builds and returns the DOM element for a single task card.
 * @param {object} task
 * @returns {HTMLElement}
 */
function buildTaskCard(task) {
  const t    = i18n.t.bind(i18n);
  const done = isDoneToday(task);
  const soon = isUpcomingSoon(task) && !done;

  const card = document.createElement('div');
  card.className = 'task' + (done ? ' done' : '') + (soon ? ' upcoming' : '');

  /* ── Completion circle ── */
  const circle = document.createElement('div');
  circle.className = 'task-check' + (done ? ' checked' : '');
  circle.setAttribute('role', 'checkbox');
  circle.setAttribute('aria-checked', String(done));
  circle.setAttribute('aria-label', t('ariaCheck'));
  circle.onclick = () => toggleTask(task.id);
  if (done) circle.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i>';

  /* ── Body: text + meta badges ── */
  const body = document.createElement('div');
  body.className = 'task-body';

  const textEl = document.createElement('div');
  textEl.className   = 'task-text';
  textEl.textContent = task.text;

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  /* Priority badge */
  meta.appendChild(makeBadge(PRIO_CLASS[task.prio], getPrioLabel(task.prio)));

  if (task.type === 'daily') {

    /* Type badge */
    meta.appendChild(makeBadge('badge-daily',
      `<i class="ti ti-repeat" aria-hidden="true"></i>${escHtml(t('badgeDaily'))}`, true));

    /* Repeat info */
    if (task.repeatMode === 'days' && task.days.length > 0) {
      const dayNames = task.days.map(d => t('days')[d]).join(' · ');
      meta.appendChild(makeTextChip(dayNames));
    } else if (task.repeatMode === 'interval') {
      meta.appendChild(makeTextChip(`${t('badgeEvery')} ${task.interval} ${t('badgeDays')}`));
    }

    /* Last-7-days history dots */
    const dotWrap = document.createElement('div');
    dotWrap.className = 'streak-wrap';
    getLast7(task).forEach(state => {
      const dot = document.createElement('div');
      dot.className = `streak-dot ${state}`;
      dot.title     = state === 'ok'   ? t('dotCompleted')
                    : state === 'miss' ? t('dotMissed')
                    :                    t('dotSkipped');
      dotWrap.appendChild(dot);
    });
    meta.appendChild(dotWrap);

    /* Streak count (only shown if > 1) */
    const streak = getStreak(task);
    if (streak > 1) {
      meta.appendChild(makeTextChip(`${streak}${t('streakDays')}`));
    }

  } else {
    /* One-time badge */
    meta.appendChild(makeBadge('badge-once',
      `<i class="ti ti-calendar-event" aria-hidden="true"></i>${escHtml(t('badgeOnce'))}`, true));
  }

  /* Time slot badge */
  if (task.timeStart) {
    const label = task.timeEnd
      ? `${formatTime(task.timeStart)} ${t('formTimeSep')} ${formatTime(task.timeEnd)}`
      : formatTime(task.timeStart);
    const cls   = soon ? 'badge-soon' : 'badge-time';
    const icon  = soon ? 'ti-alarm'   : 'ti-clock';
    meta.appendChild(makeBadge(cls, `<i class="ti ${icon}" aria-hidden="true"></i>${escHtml(label)}`, true));
  }

  body.appendChild(textEl);
  body.appendChild(meta);

  /* ── Action buttons (edit + delete) — visible on hover via CSS ── */
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.className  = 'task-action-btn edit';
  editBtn.innerHTML  = '<i class="ti ti-edit" aria-hidden="true"></i>';
  editBtn.setAttribute('aria-label', t('ariaEdit'));
  editBtn.onclick    = () => openEdit(task.id);

  const delBtn = document.createElement('button');
  delBtn.className = 'task-action-btn delete';
  delBtn.innerHTML = '<i class="ti ti-trash" aria-hidden="true"></i>';
  delBtn.setAttribute('aria-label', t('ariaDelete'));
  delBtn.onclick   = () => deleteTask(task.id);

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  card.appendChild(circle);
  card.appendChild(body);
  card.appendChild(actions);

  return card;
}

/** Creates a badge <span> element */
function makeBadge(className, content, isHtml = false) {
  const span = document.createElement('span');
  span.className = `badge ${className}`;
  if (isHtml) span.innerHTML  = content;
  else        span.textContent = content;
  return span;
}

/** Creates a plain-text inline chip (for day names, streaks, etc.) */
function makeTextChip(text) {
  const span = document.createElement('span');
  span.className   = 'text-chip';
  span.textContent = text;
  return span;
}

/** Returns the translated priority label for a prio key */
function getPrioLabel(prio) {
  const map = { high: 'prioHigh', med: 'prioMed', low: 'prioLow' };
  return i18n.t(map[prio] || 'prioLow');
}


/* ─────────────────────────────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────────────────────────────── */

/* 1. Apply theme before first render to avoid flash */
initTheme();

/* 2. Detect and apply language */
i18n.setLocale(i18n.detectLocale());
updateStaticStrings();
updateLangBtn();

/* 3. Sync notification button and reminder rows */
updateNotifBtn();
updateNotifRows();

/* 5. First render */
render();

/* 6. Start countdown timer */
updateCountdown();
setInterval(updateCountdown, 1_000);

/*
 * 7. Refresh UI every minute.
 *    This handles midnight reset (todayKey changes) and keeps
 *    the "upcoming soon" badge accurate.
 */
setInterval(render, 60_000);
