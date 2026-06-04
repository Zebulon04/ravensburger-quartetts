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
  if (window._pushNav) window._pushNav('lightbox');
}
function closeLightbox() {
  document.getElementById('imgLightbox').classList.remove('open');
}

// ── BACK BUTTON (mobile history) ─────────────────────────
(function() {
  // Push a history entry, preserving the current hash so the URL stays in sync.
  // We include the hash so that pushState never strips it from the address bar.
  function pushNav(label) {
    const hash = location.hash || '';
    history.pushState({ qNav: true, label }, '', location.pathname + location.search + hash);
  }

  // After each popstate navigation, let the router re-encode the new state into the hash.
  function syncAfterNav() {
    if (typeof window._routerSync === 'function') {
      requestAnimationFrame(window._routerSync);
    }
  }

  window.addEventListener('popstate', () => {
    // Priority 1: lightbox open → close lightbox, stay in modal
    if (document.getElementById('imgLightbox').classList.contains('open')) {
      closeLightbox();
      pushNav('modal'); // re-push so next back closes modal
      syncAfterNav();
      return;
    }
    // Priority 2: modal open → close modal, stay in current collection
    if (document.getElementById('cardModal').classList.contains('open')) {
      closeModal();
      pushNav(currentColl || currentYear || 'db'); // re-push so next back goes up a level
      syncAfterNav();
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
      syncAfterNav();
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
      syncAfterNav();
      return;
    }
    // Priority 5: database root → go to home
    if (document.getElementById('database').classList.contains('active')) {
      showSection('home');
      pushNav('home');
      syncAfterNav();
      return;
    }
    // Priority 6: home — allow browser to actually go back (exit page)
    // Don't push anything; let the browser handle it
  });

  // Replace initial state so first popstate is catchable, preserving any existing hash.
  history.replaceState({ qNav: true, root: true }, '', location.pathname + location.search + (location.hash || ''));

  // Expose pusher for use by navigation functions
  window._pushNav = pushNav;
})();
renderEmpty();
updateHomeStats();

