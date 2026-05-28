// ── THEME ─────────────────────────────────────────────────
function toggleThemePanel(e) {
  e.stopPropagation();
  document.getElementById('themePanel').classList.toggle('open');
}
function setTheme(name) {
  const html = document.documentElement;
  html.removeAttribute('data-theme');
  if (name !== 'default') html.setAttribute('data-theme', name);
  document.querySelectorAll('.theme-option[id^="t-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('t-' + name).classList.add('active');
  document.getElementById('themePanel').classList.remove('open');
  localStorage.setItem('qTheme', name);
}
// Close panel when clicking elsewhere
document.addEventListener('click', () => document.getElementById('themePanel').classList.remove('open'));
// Restore saved theme
(function() {
  const saved = localStorage.getItem('qTheme');
  if (saved && saved !== 'default') setTheme(saved);
})();

// ── i18n ──────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    settings:          'Settings',
    theme:             'Theme',
    language:          'Language',
    home:              'Home',
    database:          'Database',
    play:              'Play',
    contact:           'Contact',
    browseDatabase:    'Browse Database',
    playNow:           'Play Now',
    yearsCovered:      'Years Covered',
    cardSets:          'Card Sets',
    uniqueCards:       'Unique Cards',
    setsWord:          'sets',
    cardsWord:         'cards',
    loading:           'LOADING',
    searchPlaceholder: 'Search cards…',
    reportBug:         '🐛 Report Bug',
    all:               'All',
    homeBadge:         '🃏 The Complete Collection',
    homeBy:            'by Andreas',
    homeSubtitle:      'The most comprehensive digital database of Ravensburger Quartett cards — spanning 1997 to 2024. Explore, compare, and play.',
    databaseTitle:     'DATABASE',
    databaseSubtitle:  'Browse all Ravensburger Quartett sets by year and collection',
    reportTitle:       'REPORT',
    reviewTitle:       'REVIEW',
    reportTypeLabel:   'Report Type',
    reportTypeTypo:    'Typo',
    reportTypeBug:     'Bug',
    reportDescLabel:   'Description',
    reportDescPlaceholder: 'Describe the issue…',
    reportScopeLabel:  'Cards Affected',
    reportScopeCard:   'Current Card',
    reportScopeSet:    'Entire Set',
    reportNameLabel:   'Your Name',
    reportNameOptional:'optional',
    reportNamePlaceholder: 'Anonymous',
    reportCancel:      'Cancel',
    reportReview:      'Review →',
    reportEdit:        '← Edit',
    reportSend:        'Send Report',
    reportSending:     'Sending…',
    reportSuccess:     '✓ Report sent — thank you!',
    reportFailed:      'Failed to send. Please try again.',
    playComing:        'COMING SOON',
    playComingBadge:   'In Development',
    playComingDesc:    'Challenge friends or the AI with your favourite Quartett sets. Feature in development.',
    contactTitle:      'CONTACT',
    contactBadge:      'Get in Touch',
    contactDesc:       'Have a card set to contribute, a correction, or just want to say hello?',
    aboutTitle:        'ABOUT ME',
    aboutBadge:        'About the Project',
    aboutDesc:         'The story behind this archive — a personal journey through decades of collecting Ravensburger Quartett cards.',
  },
  de: {
    settings:          'Einstellungen',
    theme:             'Design',
    language:          'Sprache',
    home:              'Start',
    database:          'Datenbank',
    play:              'Spielen',
    contact:           'Kontakt',
    browseDatabase:    'Datenbank öffnen',
    playNow:           'Jetzt spielen',
    yearsCovered:      'Jahre',
    cardSets:          'Kartensets',
    uniqueCards:       'Karten',
    setsWord:          'Spiele',
    cardsWord:         'Karten',
    loading:           'LÄDT',
    searchPlaceholder: 'Karten suchen…',
    reportBug:         '🐛 Fehler melden',
    all:               'Alle',
    homeBadge:         '🃏 Die komplette Sammlung',
    homeBy:            'von Andreas',
    homeSubtitle:      'Die umfangreichste digitale Datenbank für Ravensburger Quartett-Karten — von 1997 bis 2024. Entdecken, vergleichen und spielen.',
    databaseTitle:     'DATENBANK',
    databaseSubtitle:  'Alle Ravensburger Quartett-Sets nach Jahr und Kollektion durchsuchen',
    reportTitle:       'MELDUNG',
    reviewTitle:       'ÜBERPRÜFUNG',
    reportTypeLabel:   'Meldungstyp',
    reportTypeTypo:    'Tippfehler',
    reportTypeBug:     'Fehler',
    reportDescLabel:   'Beschreibung',
    reportDescPlaceholder: 'Problem beschreiben…',
    reportScopeLabel:  'Betroffene Karten',
    reportScopeCard:   'Aktuelle Karte',
    reportScopeSet:    'Gesamtes Set',
    reportNameLabel:   'Dein Name',
    reportNameOptional:'optional',
    reportNamePlaceholder: 'Anonym',
    reportCancel:      'Abbrechen',
    reportReview:      'Prüfen →',
    reportEdit:        '← Bearbeiten',
    reportSend:        'Meldung senden',
    reportSending:     'Wird gesendet…',
    reportSuccess:     '✓ Meldung gesendet — Danke!',
    reportFailed:      'Fehler beim Senden. Bitte erneut versuchen.',
    playComing:        'DEMNÄCHST',
    playComingBadge:   'In Entwicklung',
    playComingDesc:    'Fordere Freunde oder die KI mit deinen Lieblings-Quartett-Sets heraus. Funktion in Entwicklung.',
    contactTitle:      'KONTAKT',
    contactBadge:      'Kontakt aufnehmen',
    contactDesc:       'Hast du ein Kartenset beizutragen, eine Korrektur oder möchtest einfach Hallo sagen?',
    aboutTitle:        'ÜBER MICH',
    aboutBadge:        'Über das Projekt',
    aboutDesc:         'Die Geschichte hinter diesem Archiv — eine persönliche Reise durch Jahrzehnte des Sammelns von Ravensburger Quartett-Karten.',
  }
};

let currentLang = localStorage.getItem('qLang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] || TRANSLATIONS.en)[key] || key;
}

function applyLang() {
  // Update all elements that have data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.tagName === 'OPTION') {
      el.textContent = t(key);
    } else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  // Search placeholder (input, no textContent)
  const si = document.getElementById('searchInput');
  if (si) si.placeholder = t('searchPlaceholder');
  // Loading stat numbers
  document.querySelectorAll('.stat-num.loading').forEach(el => el.textContent = t('loading'));
}

function setLang(lang, e) {
  if (e) e.stopPropagation();
  currentLang = lang;
  localStorage.setItem('qLang', lang);
  document.querySelectorAll('.theme-option[id^="lang-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('lang-' + lang);
  if (btn) btn.classList.add('active');
  applyLang();
}

// Apply saved language on load
(function() {
  const saved = localStorage.getItem('qLang');
  if (saved && saved !== 'en') {
    document.querySelectorAll('.theme-option[id^="lang-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('lang-' + saved);
    if (btn) btn.classList.add('active');
    currentLang = saved;
    applyLang();
  }
})();

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  const lbOpen    = document.getElementById('imgLightbox').classList.contains('open');
  const modalOpen = document.getElementById('cardModal').classList.contains('open');

  if (e.key === 'Escape') {
    if (lbOpen) { closeLightbox(); return; }
    closeModal(); return;
  }
  if (e.key === 'ArrowLeft')  { if (lbOpen || modalOpen) { modalNav(-1); e.preventDefault(); } }
  if (e.key === 'ArrowRight') { if (lbOpen || modalOpen) { modalNav(+1); e.preventDefault(); } }
});

// ── SWIPE (modal + lightbox) ──────────────────────────────
(function() {
  let _tx = 0, _ty = 0;
  const THRESHOLD = 50;

  document.addEventListener('touchstart', e => {
    const inModal = document.getElementById('cardModal').classList.contains('open');
    const inLb    = document.getElementById('imgLightbox').classList.contains('open');
    if (!inModal && !inLb) return;
    _tx = e.touches[0].clientX;
    _ty = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const inModal = document.getElementById('cardModal').classList.contains('open');
    const inLb    = document.getElementById('imgLightbox').classList.contains('open');
    if (!inModal && !inLb) return;
    const dx = e.changedTouches[0].clientX - _tx;
    const dy = e.changedTouches[0].clientY - _ty;
    // Horizontal swipe
    if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) modalNav(+1);
      else        modalNav(-1);
    }
  }, { passive: true });
})();

// ── LIGHTBOX ──────────────────────────────────────────────
function openLightbox(src) {
  const lb  = document.getElementById('imgLightbox');
  const img = document.getElementById('imgLightboxImg');
  img.src = src;
  lb.classList.add('open');
  if (window._pushNav) window._pushNav('lightbox');
}
function closeLightbox() {
  document.getElementById('imgLightbox').classList.remove('open');
}

// ── BACK BUTTON (mobile history) ─────────────────────────
(function() {
  function pushNav(label) {
    history.pushState({ qNav: true, label }, '', location.pathname + location.search);
  }

  window.addEventListener('popstate', () => {
    // Priority 1: lightbox open → close lightbox, stay in modal
    if (document.getElementById('imgLightbox').classList.contains('open')) {
      closeLightbox();
      pushNav('modal'); // re-push so next back closes modal
      return;
    }
    // Priority 2: modal open → close modal, stay in current collection
    if (document.getElementById('cardModal').classList.contains('open')) {
      closeModal();
      pushNav(currentColl || currentYear || 'db'); // re-push so next back goes up a level
      return;
    }
    // Priority 3: inside a collection → go to year
    if (currentColl && currentYear) {
      clearSearch();
      currentColl = null;
      renderSidebar();
      renderCollections(currentYear);
      setBC([{label:String(currentYear), year:currentYear}]);
      pushNav(String(currentYear));
      return;
    }
    // Priority 4: inside a year → go to all years
    if (currentYear) {
      clearSearch();
      currentYear = null;
      renderSidebar();
      renderYearsOverview();
      setBC([]);
      pushNav('db');
      return;
    }
    // Priority 5: database root → go to home
    if (document.getElementById('database').classList.contains('active')) {
      showSection('home');
      pushNav('home');
      return;
    }
    // Priority 6: home — allow browser to actually go back (exit page)
    // Don't push anything; let the browser handle it
  });

  // Replace initial state so first popstate is catchable
  history.replaceState({ qNav: true, root: true }, '', location.pathname + location.search);

  // Expose pusher for use by navigation functions
  window._pushNav = pushNav;
})();
renderEmpty();
updateHomeStats();

