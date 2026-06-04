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
// Translations are loaded from languages/{lang}.json files.
// Each file is a flat JSON object: { "key": "translated string" }
// Strings with variables use {varName} placeholders, e.g. "Loading {name}…"
// Call t('key') for plain strings, t('key', { name: 'France' }) for interpolated ones.

let _translations = {};   // active language strings, populated by loadLang()
let currentLang = localStorage.getItem('qLang') || 'en';

// t('key')                     → plain lookup
// t('key', { year: 2005 })     → replaces {year} with 2005
function t(key, vars) {
  let str = _translations[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replaceAll('{' + k + '}', v);
    });
  }
  return str;
}

// Apply all data-i18n attributes and known dynamic placeholders
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  // Dynamic placeholders not covered by data-i18n
  const si = document.getElementById('searchInput');
  if (si) si.placeholder = t('searchCardName');
  const sii = document.getElementById('searchInfoInput');
  if (sii) sii.placeholder = t('searchCardInfo');
}

// Load a language file from languages/{lang}.json, then apply
async function loadLang(lang) {
  try {
    const res = await fetch(`languages/${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _translations = await res.json();
  } catch (e) {
    console.warn(`[i18n] Failed to load languages/${lang}.json:`, e);
    if (lang !== 'en') {
      // Fallback to English
      try {
        const res = await fetch('languages/en.json');
        _translations = await res.json();
      } catch (_) {}
    }
  }
  applyLang();
}

function setLang(lang, e) {
  if (e) e.stopPropagation();
  currentLang = lang;
  localStorage.setItem('qLang', lang);
  document.querySelectorAll('.theme-option[id^="lang-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('lang-' + lang);
  if (btn) btn.classList.add('active');
  loadLang(lang);
}

// Initialise on page load — load saved language (or English)
(function() {
  const saved = localStorage.getItem('qLang') || 'en';
  currentLang = saved;
  document.querySelectorAll('.theme-option[id^="lang-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('lang-' + saved);
  if (btn) btn.classList.add('active');
  // loadLang is async — translations arrive before user interaction in practice
  loadLang(saved);
})();

// ── KEYBOARD / INIT ───────────────────────────────────────
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
