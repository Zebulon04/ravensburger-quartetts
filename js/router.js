// ── URL ROUTER ────────────────────────────────────────────
// Hash format:  #section[/year[/collection[/card]]][?q=name&iq=info]

(function () {
  'use strict';

  // When true, we are restoring from a popstate — suppress pushState calls
  // so the browser's forward stack is not corrupted.
  let _restoring = false;

  // ── ENCODE ────────────────────────────────────────────────
  function encodeState() {
    const activeSection = ['home','database','play','contact'].find(id =>
      document.getElementById(id)?.classList.contains('active')
    ) || 'home';

    if (activeSection !== 'database') return '#' + activeSection;

    let hash = '#database';

    // Read search terms straight from the DOM inputs — they are always up to date,
    // whereas the JS variables (searchTerm, infoSearchTerm) lag by one event tick.
    const qVal  = (document.getElementById('searchInput')?.value     || '').trim();
    const iqVal = (document.getElementById('searchInfoInput')?.value || '').trim();

    // Modal open?
    const modalOpen = document.getElementById('cardModal')?.classList.contains('open');
    if (modalOpen) {
      try {
        const card = _modalCards[_modalIdx];
        const set  = _modalSet;
        if (card?.card && set?.year && set?.collection) {
          // Always use the card's own year/collection — works for search-result modals too
          hash += '/' + set.year;
          hash += '/' + encodeURIComponent(set.collection);
          hash += '/' + encodeURIComponent(card.card);
          // Carry search context so back-arrow returns to the same search
          const p = new URLSearchParams();
          if (qVal)  p.set('q',  qVal);
          if (iqVal) p.set('iq', iqVal);
          const qs = p.toString();
          if (qs) hash += '?' + qs;
          return hash;
        }
      } catch(e) {}
    }

    // No modal — encode current nav position
    if (currentYear) hash += '/' + currentYear;
    if (currentColl) hash += '/' + encodeURIComponent(currentColl);

    const p = new URLSearchParams();
    if (qVal)  p.set('q',  qVal);
    if (iqVal) p.set('iq', iqVal);
    const qs = p.toString();
    if (qs) hash += '?' + qs;

    return hash;
  }

  // ── PUSH ──────────────────────────────────────────────────
  let _debounce = null;

  function pushURL() {
    if (_restoring) return;           // never corrupt forward stack during restore
    const hash = encodeState();
    if (location.hash === hash) return;
    history.pushState({ qRouter: true }, '', hash);
  }

  function replaceURL() {
    if (_restoring) return;
    const hash = encodeState();
    if (location.hash === hash) return;
    history.replaceState({ qRouter: true }, '', hash);
  }

  function debouncedPush(ms) {
    clearTimeout(_debounce);
    _debounce = setTimeout(pushURL, ms || 400);
  }

  window._routerPush    = pushURL;
  window._routerReplace = replaceURL;

  // ── DECODE / RESTORE ──────────────────────────────────────
  async function restoreHash(hash) {
    _restoring = true;
    try {
      await _doRestore(hash);
    } finally {
      // Release flag after all microtasks settle so wrapped render fns don't push
      setTimeout(() => { _restoring = false; }, 100);
    }
  }

  async function _doRestore(hash) {
    const raw = (hash || '').replace(/^#/, '').trim();
    if (!raw || raw === 'home') { _silentActivate('home'); return; }

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
    if (!Object.keys(allData).length) return;

    // Reset inputs to match URL
    _setInputs(q, iq);
    clearSearch();
    // Restore input values that clearSearch just wiped
    _setInputs(q, iq);

    if (year) {
      currentYear = year;
      currentColl = null;
      renderSidebar();

      if (coll) {
        currentColl = coll;
        renderSidebar();

        const set = allData[`${year}::${coll}`];
        if (!set) { renderCollections(year); return; }

        if (set._stub || !set.cards) {
          try {
            const txt = await fetchWithRetry(set._jsonUrl).then(r => r.text());
            set.cards = JSON.parse(txt).cards;
            set._stub = false;
          } catch(e) {}
        }

        renderCards(set);
        setBC([
          { label: String(year), year },
          { label: coll, setKey: `${year}::${coll}` }
        ]);

        if (cardId && set.cards) {
          const target = set.cards.find(c => c.card === cardId);
          if (target) {
            setTimeout(() => {
              // open without pushing (we're in restore mode)
              if (typeof _origOpenModal === 'function') _origOpenModal(target, set, set.cards);
            }, 80);
          }
        }
      } else if (q || iq) {
        _applySearch(q, iq);
      } else {
        renderCollections(year);
        setBC([{ label: String(year), year }]);
      }
    } else if (q || iq) {
      _applySearch(q, iq);
    } else {
      renderYearsOverview();
      setBC([]);
    }
  }

  function _silentActivate(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.getElementById('nav-' + id)?.classList.add('active');
  }

  function _setInputs(q, iq) {
    const ni = document.getElementById('searchInput');
    const ii = document.getElementById('searchInfoInput');
    if (ni) ni.value = q  || '';
    if (ii) ii.value = iq || '';
    // Also sync JS vars
    if (typeof searchTerm     !== 'undefined') searchTerm     = q  || '';
    if (typeof infoSearchTerm !== 'undefined') infoSearchTerm = iq || '';
  }

  function _applySearch(q, iq) {
    _setInputs(q, iq);
    if (typeof renderCombinedSearch === 'function') {
      renderCombinedSearch(q || null, iq || null);
    }
  }

  // Keep a reference to the original openModal so restore can call it without pushing
  let _origOpenModal = null;

  // ── HOOKS (run after all other scripts) ───────────────────
  window.addEventListener('load', () => {

    // Silence the old _pushNav — router owns history now
    window._pushNav = function() {};

    // Wrap openModal / closeModal
    _origOpenModal = window.openModal;
    const _origClose = window.closeModal;

    if (typeof _origOpenModal === 'function') {
      window.openModal = function(card, set, cardList) {
        _origOpenModal(card, set, cardList);
        if (!_restoring) setTimeout(pushURL, 20);
      };
    }
    if (typeof _origClose === 'function') {
      window.closeModal = function() {
        _origClose();
        if (!_restoring) setTimeout(pushURL, 20);
      };
    }

    // Wrap render functions — push after each navigation render
    const _origRC  = window.renderCollections;
    const _origRCa = window.renderCards;
    const _origYO  = window.renderYearsOverview;
    const _origSS  = window.showSection;

    if (typeof _origRC === 'function') {
      window.renderCollections = function(year) {
        _origRC(year);
        if (!_restoring) setTimeout(pushURL, 20);
      };
    }
    if (typeof _origRCa === 'function') {
      window.renderCards = function(set) {
        _origRCa(set);
        if (!_restoring) setTimeout(pushURL, 20);
      };
    }
    if (typeof _origYO === 'function') {
      window.renderYearsOverview = function() {
        _origYO();
        if (!_restoring) setTimeout(pushURL, 20);
      };
    }
    if (typeof _origSS === 'function') {
      window.showSection = function(id) {
        _origSS(id);
        if (!_restoring) setTimeout(pushURL, 20);
      };
    }

    // Modal copy-link button
    const modal = document.getElementById('cardModal');
    if (modal) {
      new MutationObserver(() => {
        if (modal.classList.contains('open')) _injectModalCopyBtn();
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // Share button in DB toolbar
    const toolbar = document.querySelector('.db-toolbar');
    if (toolbar && !document.getElementById('dbShareBtn')) {
      const btn = document.createElement('button');
      btn.id = 'dbShareBtn';
      btn.className = 'sort-btn';
      btn.title = 'Copy link to current view';
      btn.innerHTML = '🔗 Share';
      btn.style.cssText = 'margin-left:auto;flex-shrink:0;font-size:.75rem;padding:5px 10px;white-space:nowrap;';
      btn.onclick = _shareCurrentView;
      toolbar.appendChild(btn);
    }
  });

  // ── Search input listeners (DOMContentLoaded so inputs exist) ──
  window.addEventListener('DOMContentLoaded', () => {
    // Attach after a tick so other DOMContentLoaded handlers run first
    setTimeout(() => {
      const ni = document.getElementById('searchInput');
      const ii = document.getElementById('searchInfoInput');
      // Use 'input' event — fires synchronously after value changes
      // Read from DOM in debouncedPush (encodeState reads inputs directly)
      if (ni) ni.addEventListener('input', () => debouncedPush(400));
      if (ii) ii.addEventListener('input', () => debouncedPush(400));
    }, 0);
  });

  // ── POPSTATE ──────────────────────────────────────────────
  window.addEventListener('popstate', () => {
    restoreHash(location.hash);
  });

  // ── INITIAL LOAD ──────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    history.replaceState({ qRouter: true }, '', location.href);
    const initialHash = location.hash;
    if (!initialHash || initialHash === '#' || initialHash === '#home') return;
    window._routerPendingHash = initialHash;
    if (Object.keys(allData).length) restoreHash(initialHash);
  });

  // Called by finishLoad() in loader.js
  window._routerRestore = function() {
    const hash = window._routerPendingHash || location.hash;
    window._routerPendingHash = null;
    if (hash && hash !== '#' && hash !== '#home') restoreHash(hash);
  };

  // ── UI HELPERS ────────────────────────────────────────────
  function _injectModalCopyBtn() {
    const modal = document.getElementById('cardModal');
    if (!modal || modal.querySelector('#modalCopyLink')) return;
    const btn = document.createElement('button');
    btn.id = 'modalCopyLink';
    btn.title = 'Copy link to this card';
    btn.textContent = '🔗';
    btn.style.cssText = 'position:absolute;top:14px;right:52px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:5px 9px;font-size:.85rem;cursor:pointer;color:var(--text-secondary);z-index:10;transition:background .15s;';
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,.16)';
    btn.onmouseout  = () => btn.style.background = 'rgba(255,255,255,.08)';
    btn.onclick = e => {
      e.stopPropagation();
      _copy(location.origin + location.pathname + encodeState());
      btn.textContent = '✓'; btn.style.color = '#4caf50';
      setTimeout(() => { btn.textContent = '🔗'; btn.style.color = ''; }, 1800);
    };
    modal.appendChild(btn);
  }

  function _shareCurrentView() {
    const url = location.origin + location.pathname + encodeState();
    if (navigator.share) { navigator.share({ url }).catch(() => {}); return; }
    _copy(url);
    const btn = document.getElementById('dbShareBtn');
    if (btn) { btn.innerHTML = '✓ Copied'; setTimeout(() => { btn.innerHTML = '🔗 Share'; }, 1800); }
  }

  function _copy(text) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => prompt('Copy:', text));
    else prompt('Copy this link:', text);
  }

  window._router = { encode: encodeState, restore: restoreHash, push: pushURL };

})();
