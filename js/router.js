// ── URL ROUTER ────────────────────────────────────────────
// Encodes the full app state into the URL hash so any view can be shared,
// bookmarked, or stepped through with browser back/forward.
//
// URL format:  #section[/year[/collection[/card]]][?q=search&iq=infoSearch]
//
// Examples:
//   #home
//   #database
//   #database/2003
//   #database/2003/Formel1
//   #database/2003/Formel1/2A
//   #database?q=ferrari
//   #database/2003?q=ferrari
//   #play
//   #contact

(function () {

  // ── WRITE: current state → URL hash ──────────────────────
  function encodeState() {
    const section = ['home', 'database', 'play', 'contact'].find(id =>
      document.getElementById(id)?.classList.contains('active')
    ) || 'home';

    if (section !== 'database') return '#' + section;

    let hash = '#database';
    if (currentYear) hash += '/' + currentYear;
    if (currentColl) hash += '/' + encodeURIComponent(currentColl);

    // Card modal open?
    if (document.getElementById('cardModal')?.classList.contains('open')) {
      const modalCard = _getModalCard();
      if (modalCard) hash += '/' + encodeURIComponent(modalCard);
    }

    // Search terms
    const params = new URLSearchParams();
    if (typeof searchTerm === 'string' && searchTerm.trim())
      params.set('q', searchTerm.trim());
    if (typeof infoSearchTerm === 'string' && infoSearchTerm.trim())
      params.set('iq', infoSearchTerm.trim());
    const qs = params.toString();
    if (qs) hash += '?' + qs;

    return hash;
  }

  // Helper: get the currently open modal card grade (e.g. "2A")
  function _getModalCard() {
    try {
      if (typeof _modalCards !== 'undefined' && typeof _modalIdx !== 'undefined') {
        const card = _modalCards[_modalIdx];
        return card?.card || null;
      }
    } catch (e) {}
    return null;
  }

  // Push current state to history
  function pushState(replace = false) {
    const hash = encodeState();
    if (location.hash === hash) return; // no change, don't pollute history
    if (replace) {
      history.replaceState({ qRouter: true }, '', hash);
    } else {
      history.pushState({ qRouter: true }, '', hash);
    }
  }

  // ── READ: URL hash → restore state ───────────────────────
  async function restoreFromHash(hash) {
    // Strip leading #
    const raw = (hash || location.hash || '').replace(/^#/, '');
    if (!raw) return false;

    // Split path from query string
    const [pathPart, qsPart] = raw.split('?');
    const segments = pathPart.split('/').map(s => decodeURIComponent(s));
    const params = new URLSearchParams(qsPart || '');

    const section = segments[0] || 'home';
    const year    = segments[1] ? Number(segments[1]) : null;
    const coll    = segments[2] || null;
    const card    = segments[3] || null;
    const q       = params.get('q') || '';
    const iq      = params.get('iq') || '';

    // Navigate to section first
    if (['home', 'database', 'play', 'contact'].includes(section)) {
      // Call showSection without re-pushing to history (we're restoring, not navigating)
      _silentShowSection(section);
    }

    if (section !== 'database') return true;

    // If no data loaded yet, nothing to restore — the load completion will call
    // restoreFromHash again via window._routerRestore()
    if (!Object.keys(allData).length) return false;

    // Navigate into year
    if (year) {
      currentYear = year;
      currentColl = null;
      renderSidebar();

      if (coll) {
        currentColl = coll;
        renderSidebar();
        const set = allData[`${year}::${coll}`];
        if (set) {
          // Load stub if needed
          if (set._stub || !set.cards) {
            try {
              const jsonText = await fetchWithRetry(set._jsonUrl).then(r => r.text());
              const parsed = JSON.parse(jsonText);
              set.cards = parsed.cards;
              set._stub = false;
            } catch (e) { /* show whatever we have */ }
          }

          renderCards(set);
          setBC([
            { label: String(year), year },
            { label: coll, setKey: `${year}::${coll}` }
          ]);

          // Open card modal
          if (card && set.cards) {
            const target = set.cards.find(c => c.card === card);
            if (target) {
              // Small delay so DOM is ready
              setTimeout(() => openModal(target, set, set.cards), 80);
            }
          }
        } else {
          renderCollections(year);
          setBC([{ label: String(year), year }]);
        }
      } else if (q || iq) {
        // Search within year
        _applySearch(q, iq);
      } else {
        renderCollections(year);
        setBC([{ label: String(year), year }]);
      }
    } else if (q || iq) {
      // Global search
      _applySearch(q, iq);
    } else {
      renderYearsOverview();
      setBC([]);
    }

    return true;
  }

  function _silentShowSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const section = document.getElementById(id);
    const navLink = document.getElementById('nav-' + id);
    if (section) section.classList.add('active');
    if (navLink) navLink.classList.add('active');
    // Skip the side-effects of showSection (game cleanup etc.) for router restore
  }

  function _applySearch(q, iq) {
    // Set the search input and trigger search
    const searchInput = document.getElementById('searchInput');
    const infoInput   = document.getElementById('infoSearchInput');
    if (searchInput && q) {
      searchInput.value = q;
      if (typeof handleSearch === 'function') handleSearch(q);
    }
    if (infoInput && iq) {
      infoInput.value = iq;
      if (typeof handleInfoSearch === 'function') handleInfoSearch(iq);
    }
    if (!q && iq && typeof handleInfoSearch === 'function') handleInfoSearch(iq);
    if (!iq && q && typeof handleSearch === 'function') handleSearch(q);
  }

  // ── HOOK: intercept all navigation to update URL ──────────
  // We wrap the existing _pushNav and also add a smarter updater

  // Debounced URL updater — called after any state change
  let _updateTimer = null;
  function scheduleUpdate(replace = false) {
    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(() => pushState(replace), 50);
  }

  // Expose so other modules can trigger URL update
  window._routerUpdate = scheduleUpdate;

  // Override _pushNav to also update the URL properly
  // (ui.js sets window._pushNav; we extend it here after ui.js loads)
  window.addEventListener('load', () => {
    const original_pushNav = window._pushNav;
    window._pushNav = function (label) {
      // Let the original push to history stack (for back button)
      if (original_pushNav) original_pushNav(label);
      // Also rewrite the hash to reflect current real state
      // Use replaceState on the *last* history entry (the one just pushed)
      setTimeout(() => {
        const hash = encodeState();
        // Replace the last entry (the blank one _pushNav just pushed) with the real hash
        history.replaceState({ qRouter: true }, '', hash);
      }, 10);
    };
  });

  // ── HOOK into showSection ─────────────────────────────────
  window.addEventListener('load', () => {
    const origShowSection = window.showSection;
    if (typeof origShowSection === 'function') {
      window.showSection = function (id) {
        origShowSection(id);
        scheduleUpdate(false);
      };
    }
  });

  // ── HOOK into openModal / closeModal ─────────────────────
  window.addEventListener('load', () => {
    const origOpen = window.openModal;
    if (typeof origOpen === 'function') {
      window.openModal = function (card, set, cardList) {
        origOpen(card, set, cardList);
        scheduleUpdate(false);
      };
    }
    const origClose = window.closeModal;
    if (typeof origClose === 'function') {
      window.closeModal = function () {
        origClose();
        scheduleUpdate(false);
      };
    }
  });

  // ── RESTORE on popstate (browser back/forward) ────────────
  window.addEventListener('popstate', (e) => {
    // The existing back-button logic in ui.js runs first.
    // After it's done, sync the URL to match what it rendered.
    setTimeout(() => {
      const hash = encodeState();
      if (location.hash !== hash) {
        history.replaceState({ qRouter: true }, '', hash);
      }
    }, 100);
  });

  // ── INITIAL LOAD: restore from URL hash ──────────────────
  window.addEventListener('DOMContentLoaded', () => {
    if (!location.hash || location.hash === '#' || location.hash === '#home') return;

    // If data is already loaded (e.g. hot reload), restore immediately
    if (Object.keys(allData).length) {
      restoreFromHash(location.hash);
      return;
    }

    // Otherwise wait for data to load — report.js calls loadEntireRepo on DOMContentLoaded.
    // We poll until allData is populated, then restore.
    window._routerRestore = () => restoreFromHash(location.hash);
  });

  // ── COPY LINK button ─────────────────────────────────────
  // Adds a small "🔗 Copy link" button to the card modal
  window.addEventListener('load', () => {
    const modal = document.getElementById('cardModal');
    if (!modal) return;

    // Insert copy-link button into modal header area
    const mHeader = modal.querySelector('.modal-header, .m-header, #mHeader');
    if (!mHeader) {
      // Inject into modal top via mutation on open
      const observer = new MutationObserver(() => {
        if (modal.classList.contains('open')) {
          injectCopyBtn();
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    function injectCopyBtn() {
      if (modal.querySelector('#modalCopyLink')) return;
      const btn = document.createElement('button');
      btn.id = 'modalCopyLink';
      btn.title = 'Copy link to this card';
      btn.innerHTML = '🔗';
      btn.style.cssText = `
        position:absolute;top:14px;right:52px;
        background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);
        border-radius:8px;padding:5px 9px;font-size:.85rem;cursor:pointer;
        color:var(--text-secondary);z-index:10;transition:background .15s;
      `;
      btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,.16)';
      btn.onmouseout  = () => btn.style.background = 'rgba(255,255,255,.08)';
      btn.onclick = (e) => {
        e.stopPropagation();
        const url = location.origin + location.pathname + encodeState();
        navigator.clipboard.writeText(url).then(() => {
          btn.innerHTML = '✓';
          btn.style.color = '#4caf50';
          setTimeout(() => { btn.innerHTML = '🔗'; btn.style.color = ''; }, 1800);
        }).catch(() => {
          // Fallback for older mobile browsers
          prompt('Copy this link:', url);
        });
      };
      modal.appendChild(btn);
    }
  });

  // ── SHARE BUTTON (database toolbar) ─────────────────────
  // Adds a small share/copy button to the database toolbar for sharing
  // current search or collection view
  window.addEventListener('load', () => {
    const toolbar = document.querySelector('.db-toolbar');
    if (!toolbar) return;

    const shareBtn = document.createElement('button');
    shareBtn.id = 'dbShareBtn';
    shareBtn.title = 'Copy link to current view';
    shareBtn.innerHTML = '🔗';
    shareBtn.className = 'sort-btn';
    shareBtn.style.cssText = 'margin-left:auto;flex-shrink:0;font-size:.8rem;padding:5px 10px;';
    shareBtn.onclick = () => {
      const url = location.origin + location.pathname + encodeState();
      if (navigator.share) {
        navigator.share({ url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url).then(() => {
          shareBtn.innerHTML = '✓';
          setTimeout(() => { shareBtn.innerHTML = '🔗'; }, 1800);
        }).catch(() => prompt('Copy this link:', url));
      }
    };
    toolbar.appendChild(shareBtn);
  });

  // Expose for other modules
  window._router = { encode: encodeState, restore: restoreFromHash, push: pushState };

})();
