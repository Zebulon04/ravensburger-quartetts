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
  if (window._pushNav) window._pushNav('lightbox', location.hash || '');
}
function closeLightbox() {
  document.getElementById('imgLightbox').classList.remove('open');
}

// ── BACK BUTTON (mobile history) ─────────────────────────
(function() {
  // Push a history entry using an explicit hash computed AFTER state mutation,
  // so we never accidentally capture the stale location.hash.
  function pushNav(label, explicitHash) {
    const hash = (explicitHash != null) ? explicitHash : (location.hash || '');
    history.pushState({ qNav: true, label }, '', location.pathname + location.search + hash);
  }

  // Ask the router to encode the current app state synchronously.
  // This is called AFTER mutating state (currentYear/currentColl/modal) so the
  // resulting hash correctly reflects the new navigation level.
  function navHash() {
    if (window._router && typeof window._router.encode === 'function') {
      return window._router.encode();
    }
    return location.hash || '';
  }

  window.addEventListener('popstate', () => {
    // Close any open overlays first (lightbox, modal) without pushing history
    if (document.getElementById('imgLightbox').classList.contains('open')) {
      closeLightbox();
    }
    if (document.getElementById('cardModal').classList.contains('open')) {
      closeModal();
    }
    // Restore app state to match the hash we just landed on.
    // restoreHash is the single source of truth for hash→state mapping.
    const hash = location.hash || '#home';
    if (hash === '#home' || hash === '#' || hash === '') {
      showSection('home');
    } else if (window._router && typeof window._router.restore === 'function') {
      window._router.restore(hash, true); // true = skipHistoryPush
    }
  });

  // Replace initial state so first popstate is catchable, preserving any existing hash.
  history.replaceState({ qNav: true, root: true }, '', location.pathname + location.search + (location.hash || ''));

  // Expose pusher for use by navigation functions
  window._pushNav = pushNav;
  // Expose hash encoder for callers that need the correct current hash
  window._navHash = navHash;
})();
renderEmpty();
updateHomeStats();

