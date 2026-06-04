// ── URL ROUTER ────────────────────────────────────────────
// Deep-link every view state into the URL hash.
//
// Hash format:  #section[/year[/collection[/card]]][?q=name&iq=info]
//
// Examples:
//   #home
//   #database
//   #database/2003
//   #database/2003/Formel1
//   #database/2003/Formel1/2A
//   #database?q=ferrari
//   #database/2003?q=ferrari&iq=kimi

(function () {
  'use strict';

  // ── ENCODE: current app state → hash string ───────────────
  function encodeState() {
    const activeSection = ['home','database','play','contact'].find(id =>
      document.getElementById(id)?.classList.contains('active')
    ) || 'home';

    if (activeSection !== 'database') return '#' + activeSection;

    let hash = '#database';

    if (currentYear) hash += '/' + currentYear;
    if (currentColl) hash += '/' + encodeURIComponent(currentColl);

    // Card modal open → append card grade
    if (document.getElementById('cardModal')?.classList.contains('open')) {
      try {
        const card = _modalCards[_modalIdx];
        if (card?.card) hash += '/' + encodeURIComponent(card.card);
      } catch(e) {}
    }

    // Active search terms
    const p = new URLSearchParams();
    const q  = typeof searchTerm     === 'string' ? searchTerm.trim()     : '';
    const iq = typeof infoSearchTerm === 'string' ? infoSearchTerm.trim() : '';
    if (q)  p.set('q',  q);
    if (iq) p.set('iq', iq);
    const qs = p.toString();
    if (qs) hash += '?' + qs;

    return hash;
  }

  // ── PUSH: write encoded state to browser history ──────────
  let _debounce = null;
  function pushURL(replace = false) {
    const hash = encodeState();
    if (location.hash === hash) return;
    if (replace) history.replaceState({ qRouter: true }, '', hash);
    else         history.pushState   ({ qRouter: true }, '', hash);
  }

  // Debounced push — used by typing events so we don't push every keystroke
  function debouncedPush(ms = 600) {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => pushURL(false), ms);
  }

  // Immediate push — used by navigation clicks
  function immediatePush() {
    clearTimeout(_debounce);
    pushURL(false);
  }

  // Expose globally so other modules can trigger an update
  window._routerPush    = immediatePush;
  window._routerReplace = () => pushURL(true);

  // ── DECODE: hash string → restore state ──────────────────
  async function restoreHash(hash) {
    const raw = (hash || '').replace(/^#/, '').trim();
    if (!raw || raw === 'home') {
      _silentActivate('home');
      return;
    }

    const [pathPart, qsPart] = raw.split('?');
    const segs   = pathPart.split('/').filter(Boolean);
    const params = new URLSearchParams(qsPart || '');

    const section = segs[0] || 'home';
    const year    = segs[1] ? Number(segs[1]) : null;
    const coll    = segs[2] ? decodeURIComponent(segs[2]) : null;
    const cardId  = segs[3] ? decodeURIComponent(segs[3]) : null;
    const q       = params.get('q')  || '';
    const iq      = params.get('iq') || '';

    if (!['home','database','play','contact'].includes(section)) return;

    _silentActivate(section);
    if (section !== 'database') return;

    // If data not loaded yet, bail — finishLoad() will call us again
    if (!Object.keys(allData).length) return;

    // Navigate breadcrumb
    clearSearch();

    if (year) {
      currentYear = year;
      currentColl = null;
      renderSidebar();

      if (coll) {
        currentColl = coll;
        renderSidebar();

        const set = allData[`${year}::${coll}`];
        if (!set) { renderCollections(year); return; }

        // Hydrate stub
        if (set._stub || !set.cards) {
          try {
            const txt  = await fetchWithRetry(set._jsonUrl).then(r => r.text());
            set.cards  = JSON.parse(txt).cards;
            set._stub  = false;
          } catch(e) {}
        }

        renderCards(set);
        setBC([
          { label: String(year), year },
          { label: coll, setKey: `${year}::${coll}` }
        ]);

        if (cardId && set.cards) {
          const target = set.cards.find(c => c.card === cardId);
          if (target) setTimeout(() => openModal(target, set, set.cards), 80);
        }
      } else {
        if (q || iq) {
          _applySearch(q, iq);
        } else {
          renderCollections(year);
          setBC([{ label: String(year), year }]);
        }
      }
    } else {
      if (q || iq) {
        _applySearch(q, iq);
      } else {
        renderYearsOverview();
        setBC([]);
      }
    }
  }

  // Activate a section without side-effects (no game cleanup, no re-render)
  function _silentActivate(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.getElementById('nav-' + id)?.classList.add('active');
  }

  // Fill search inputs and trigger search
  function _applySearch(q, iq) {
    // Set input values
    const nameEl = document.getElementById('searchInput');
    const infoEl = document.getElementById('searchInfoInput');
    if (nameEl && q)  nameEl.value  = q;
    if (infoEl && iq) infoEl.value  = iq;

    // Update state variables directly (search.js reads these)
    if (q)  { searchTerm     = q;  }
    if (iq) { infoSearchTerm = iq; }

    // Trigger combined search
    if (typeof renderCombinedSearch === 'function') {
      renderCombinedSearch(q || null, iq || null);
    } else if (q && typeof handleSearch === 'function') {
      handleSearch(q);
    }
  }

  // ── HOOK: search inputs → push URL on typing ─────────────
  // We do this after DOMContentLoaded so the inputs exist
  window.addEventListener('DOMContentLoaded', () => {

    const nameInput = document.getElementById('searchInput');
    const infoInput = document.getElementById('searchInfoInput');

    if (nameInput) {
      nameInput.addEventListener('input', () => debouncedPush(500));
    }
    if (infoInput) {
      infoInput.addEventListener('input', () => debouncedPush(500));
    }

    // showSection → push URL
    const _origShow = window.showSection;
    if (typeof _origShow === 'function') {
      window.showSection = function(id) {
        _origShow(id);
        setTimeout(immediatePush, 20);
      };
    }

    // Sidebar year/collection clicks already call _pushNav — we replace that
    // with a real URL push below.

    // ── COPY LINK button inside card modal ────────────────
    const modal = document.getElementById('cardModal');
    if (modal) {
      new MutationObserver(() => {
        if (modal.classList.contains('open')) _injectModalCopyBtn();
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // ── Share button in toolbar ───────────────────────────
    const toolbar = document.querySelector('.db-toolbar');
    if (toolbar) {
      const shareBtn = document.createElement('button');
      shareBtn.id = 'dbShareBtn';
      shareBtn.className = 'sort-btn';
      shareBtn.title = 'Copy link to current view';
      shareBtn.innerHTML = '🔗 Share';
      shareBtn.style.cssText = 'margin-left:auto;flex-shrink:0;font-size:.75rem;padding:5px 10px;white-space:nowrap;';
      shareBtn.onclick = _shareCurrentView;
      toolbar.appendChild(shareBtn);
    }
  });

  // ── HOOK: openModal / closeModal → push URL immediately ──
  window.addEventListener('load', () => {
    const _origOpen  = window.openModal;
    const _origClose = window.closeModal;

    if (typeof _origOpen === 'function') {
      window.openModal = function(card, set, cardList) {
        _origOpen(card, set, cardList);
        setTimeout(immediatePush, 20);
      };
    }
    if (typeof _origClose === 'function') {
      window.closeModal = function() {
        _origClose();
        setTimeout(immediatePush, 20);
      };
    }

    // Replace _pushNav entirely — the old one pushed blank history entries;
    // we now manage history ourselves via the router.
    window._pushNav = function() {
      // No-op: router handles history through immediatePush / debouncedPush
      // This prevents double-pushing from the old ui.js back-button logic.
    };

    // Sidebar navigation functions call _pushNav; hook renderSidebar click targets instead
    // by wrapping the functions that actually change currentYear / currentColl.
    // Those are called from nav.js onclick handlers which also call _pushNav —
    // since _pushNav is now a no-op, we listen for the state changes via a
    // small polling trick OR we piggyback on renderSidebar itself.
    // Simplest: wrap renderCollections and renderCards since they always follow navigation.
    const _origRC   = window.renderCollections;
    const _origCards= window.renderCards;
    const _origYO   = window.renderYearsOverview;

    if (typeof _origRC === 'function') {
      window.renderCollections = function(year) {
        _origRC(year);
        setTimeout(immediatePush, 20);
      };
    }
    if (typeof _origCards === 'function') {
      window.renderCards = function(set) {
        _origCards(set);
        setTimeout(immediatePush, 20);
      };
    }
    if (typeof _origYO === 'function') {
      window.renderYearsOverview = function() {
        _origYO();
        setTimeout(immediatePush, 20);
      };
    }
  });

  // ── POPSTATE: browser back / forward ─────────────────────
  window.addEventListener('popstate', () => {
    // Restore state from the hash that the browser just navigated to
    restoreHash(location.hash);
  });

  // ── INITIAL PAGE LOAD ─────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    const initialHash = location.hash;

    // Replace the very first history entry with itself (makes it catchable)
    history.replaceState({ qRouter: true }, '', location.href);

    if (!initialHash || initialHash === '#' || initialHash === '#home') {
      // Nothing to restore
      return;
    }

    // Data may not be ready yet — store the hash and restore after load
    window._routerPendingHash = initialHash;

    // If data somehow already exists (e.g. dev hot-reload), restore now
    if (Object.keys(allData).length) {
      restoreHash(initialHash);
    }
    // Otherwise finishLoad() in loader.js calls window._routerRestore()
  });

  // Called by loader.js finishLoad() once data is ready
  window._routerRestore = function() {
    const hash = window._routerPendingHash || location.hash;
    window._routerPendingHash = null;
    if (hash && hash !== '#' && hash !== '#home') {
      restoreHash(hash);
    }
  };

  // ── COPY LINK helpers ─────────────────────────────────────
  function _injectModalCopyBtn() {
    const modal = document.getElementById('cardModal');
    if (!modal || modal.querySelector('#modalCopyLink')) return;

    const btn = document.createElement('button');
    btn.id = 'modalCopyLink';
    btn.title = 'Copy link to this card';
    btn.textContent = '🔗';
    btn.style.cssText = [
      'position:absolute','top:14px','right:52px',
      'background:rgba(255,255,255,.08)','border:1px solid rgba(255,255,255,.15)',
      'border-radius:8px','padding:5px 9px','font-size:.85rem','cursor:pointer',
      'color:var(--text-secondary)','z-index:10','transition:background .15s',
    ].join(';');
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,.16)';
    btn.onmouseout  = () => btn.style.background = 'rgba(255,255,255,.08)';
    btn.onclick = (e) => {
      e.stopPropagation();
      _copyURL();
      btn.textContent = '✓';
      btn.style.color = '#4caf50';
      setTimeout(() => { btn.textContent = '🔗'; btn.style.color = ''; }, 1800);
    };
    modal.appendChild(btn);
  }

  function _shareCurrentView() {
    const url = location.origin + location.pathname + encodeState();
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      _copyToClipboard(url);
      const btn = document.getElementById('dbShareBtn');
      if (btn) {
        btn.innerHTML = '✓ Copied';
        setTimeout(() => { btn.innerHTML = '🔗 Share'; }, 1800);
      }
    }
  }

  function _copyURL() {
    _copyToClipboard(location.origin + location.pathname + encodeState());
  }

  function _copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => prompt('Copy this link:', text));
    } else {
      prompt('Copy this link:', text);
    }
  }

  window._router = { encode: encodeState, restore: restoreHash, push: immediatePush };

})();
