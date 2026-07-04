/**
 * js/i18n.js
 *
 * Internationalization module.
 * Contains all UI strings for supported languages (English, Italian).
 * Usage: i18n.t('key') returns the string for the current language.
 *
 * Supported locales: 'en', 'it'
 * Default fallback:  'en'
 */

const TRANSLATIONS = {

  /* ── English ────────────────────────────────────────────── */
  en: {
    /* Page title */
    appTitle:          'My Tasks',

    /* Header */
    resetLabel:        'Reset',
    notifEnable:       'Notifications',
    notifGranted:      'Notifications on',
    notifDisabled:     'Notifications off',
    notifDenied:       'Blocked',
    notifDeniedHint:   'Notifications are blocked by the browser. Please enable them in your browser settings.',
    notifUnsupported:  'Notifications not supported by this browser.',

    /* Theme tooltip labels */
    themeSystem:       'Follow system',
    themeLight:        'Light mode',
    themeDark:         'Dark mode',

    /* Language toggle */
    langToggleTitle:   'Switch language',

    /* Form — labels */
    formPlaceholder:   'New task…',
    formType:          'Type',
    formPriority:      'Priority',
    formRepeat:        'Repeat',
    formTime:          'Time',
    formReminder:      'Reminder',
    formAddBtn:        'Add task',
    formTimeSep:       '–',

    /* Form — type options */
    typeDaily:         'Daily',
    typeOnce:          'One-time',

    /* Form — repeat mode options */
    repeatSpecific:    'Specific days',
    repeatInterval:    'Every N days',

    /* Form — day abbreviations (Mon=0 … Sun=6) */
    days:              ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],

    /* Form — interval */
    intervalEvery:     'Every',
    intervalDays:      'days',

    /* Form — priority options */
    prioLow:           'Low',
    prioMed:           'Medium',
    prioHigh:          'High',

    /* Form — reminder options */
    reminderAt:        'At start time',
    reminder5:         '5 min before',
    reminder10:        '10 min before',
    reminder15:        '15 min before',
    reminder30:        '30 min before',

    /* Section labels */
    sectionToday:      'Today\'s habits',
    sectionTodo:       'To do',
    sectionDone:       'Completed',
    sectionInactive:   'Not scheduled today',

    /* Task card — badge labels */
    badgeDaily:        'Daily',
    badgeOnce:         'One-time',
    badgeEvery:        'every',
    badgeDays:         'd',

    /* Task card — aria labels */
    ariaCheck:         'Mark as completed',
    ariaEdit:          'Edit task',
    ariaDelete:        'Delete task',

    /* Task card — dot tooltips */
    dotCompleted:      'Completed',
    dotMissed:         'Missed',
    dotSkipped:        'Not scheduled',

    /* Upcoming badge */
    badgeSoon:         'Soon',

    /* Streak suffix */
    streakDays:        'd',

    /* Empty state */
    emptyState:        'No tasks yet. Add one above!',

    /* Stats labels */
    statDone:          'Done today',
    statStreak:        'Day streak',
    statPct:           'Completion',

    /* Notification */
    notifTitle:        'Upcoming task',

    /* Edit modal */
    modalTitle:        'Edit task',
    modalCancel:       'Cancel',
    modalSave:         'Save changes',
    modalClose:        'Close',
  },

  /* ── Italian ────────────────────────────────────────────── */
  it: {
    appTitle:          'Le mie attività',

    resetLabel:        'Reset',
    notifEnable:       'Notifiche',
    notifGranted:      'Notifiche attive',
    notifDisabled:     'Notifiche disattive',
    notifDenied:       'Bloccate',
    notifDeniedHint:   'Le notifiche sono bloccate dal browser. Abilitale nelle impostazioni del browser.',
    notifUnsupported:  'Il tuo browser non supporta le notifiche.',

    themeSystem:       'Segui sistema',
    themeLight:        'Tema chiaro',
    themeDark:         'Tema scuro',

    langToggleTitle:   'Cambia lingua',

    formPlaceholder:   'Nuova attività…',
    formType:          'Tipo',
    formPriority:      'Priorità',
    formRepeat:        'Ripeti',
    formTime:          'Orario',
    formReminder:      'Promemoria',
    formAddBtn:        'Aggiungi',
    formTimeSep:       '–',

    typeDaily:         'Giornaliera',
    typeOnce:          'Una volta',

    repeatSpecific:    'Giorni specifici',
    repeatInterval:    'Ogni N giorni',

    days:              ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'],

    intervalEvery:     'Ogni',
    intervalDays:      'giorni',

    prioLow:           'Bassa',
    prioMed:           'Media',
    prioHigh:          'Alta',

    reminderAt:        'All\'orario',
    reminder5:         '5 min prima',
    reminder10:        '10 min prima',
    reminder15:        '15 min prima',
    reminder30:        '30 min prima',

    sectionToday:      'Abitudini di oggi',
    sectionTodo:       'Da fare',
    sectionDone:       'Completate',
    sectionInactive:   'Non previste oggi',

    badgeDaily:        'Giornaliera',
    badgeOnce:         'Una volta',
    badgeEvery:        'ogni',
    badgeDays:         'gg',

    ariaCheck:         'Segna come completata',
    ariaEdit:          'Modifica attività',
    ariaDelete:        'Elimina attività',

    dotCompleted:      'Completata',
    dotMissed:         'Saltata',
    dotSkipped:        'Non prevista',

    badgeSoon:         'In arrivo',

    streakDays:        'd',

    emptyState:        'Nessuna attività. Aggiungine una!',

    statDone:          'Fatte oggi',
    statStreak:        'Streak giorni',
    statPct:           'Completamento',

    notifTitle:        'Attività in arrivo',

    modalTitle:        'Modifica attività',
    modalCancel:       'Annulla',
    modalSave:         'Salva modifiche',
    modalClose:        'Chiudi',
  },
};

/* ── i18n public API ─────────────────────────────────────── */

const i18n = (() => {
  /** Currently active locale */
  let currentLocale = 'en';

  /**
   * Detects the best locale to use on first load:
   * 1. Check localStorage for a saved preference
   * 2. Fall back to navigator.language (e.g. "it-IT" → "it")
   * 3. Fall back to "en" if the detected locale is unsupported
   */
  function detectLocale() {
    const saved = localStorage.getItem('todo_lang');
    if (saved && TRANSLATIONS[saved]) return saved;

    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return TRANSLATIONS[browser] ? browser : 'en';
  }

  /**
   * Sets the active locale, saves it, and updates the <html lang> attribute.
   * Does NOT re-render the UI — callers are responsible for that.
   *
   * @param {string} locale - 'en' | 'it'
   */
  function setLocale(locale) {
    if (!TRANSLATIONS[locale]) return;
    currentLocale = locale;
    localStorage.setItem('todo_lang', locale);
    document.documentElement.setAttribute('lang', locale);
  }

  /**
   * Returns the translation string for the given key.
   * Falls back to English if the key is missing in the current locale.
   *
   * @param {string} key - key from TRANSLATIONS
   * @returns {string|Array}
   */
  function t(key) {
    return TRANSLATIONS[currentLocale]?.[key]
        ?? TRANSLATIONS['en']?.[key]
        ?? key;
  }

  /** Returns the active locale code */
  function getLocale() { return currentLocale; }

  return { detectLocale, setLocale, t, getLocale };
})();
