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

// Resolve a languages/ path relative to the HTML document, not the current URL.
// This fixes failures when the page is served from a sub-path.
function _langUrl(lang) {
  const base = document.querySelector('base[href]')?.href
    || (location.origin + location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1));
  return new URL(`languages/${lang}.json`, base).href;
}

// Load a language file from languages/{lang}.json, then apply.
// Returns a Promise so callers can await it.
async function loadLang(lang) {
  try {
    const res = await fetch(_langUrl(lang));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _translations = await res.json();
  } catch (e) {
    console.warn(`[i18n] Failed to load languages/${lang}.json:`, e);
    if (lang !== 'en') {
      // Fallback to English
      try {
        const res = await fetch(_langUrl('en'));
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
// We expose a promise so any code that needs translations to be ready can await it.
let _langReady;
(function() {
  const saved = localStorage.getItem('qLang') || 'en';
  currentLang = saved;
  document.querySelectorAll('.theme-option[id^="lang-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('lang-' + saved);
  if (btn) btn.classList.add('active');
  // Await the fetch so applyLang() runs only after _translations is populated.
  _langReady = loadLang(saved);
})();

// ── START IN DATABASE ─────────────────────────────────────
function toggleStartInDatabase(val) {
  if (val) localStorage.setItem('qStartInDatabase', '1');
  else localStorage.removeItem('qStartInDatabase');
}

// Init checkbox state + apply setting on load
(function() {
  const el = document.getElementById('startInDbCheck');
  if (el && localStorage.getItem('qStartInDatabase')) el.checked = true;
})();
