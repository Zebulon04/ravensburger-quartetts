// ── URL ROUTER ────────────────────────────────────────────
// Only does TWO things:
//   1. Keep the URL hash in sync with current app state (replaceState)
//   2. Restore state when the page loads with a deep-link hash
//
// Hash format:
//   #section
//   #database[/year[/collection[/card]]][?q=name&iq=info]

(function () {
  'use strict';

  // ── ENCODE ────────────────────────────────────────────────
  function encodeState() {
    const activeSection = ['home','database','play','contact'].find(id =>
      document.getElementById(id)?.classList.contains('active')
    ) || 'home';

    if (activeSection !== 'database') return '#' + activeSection;

    const qVal  = (document.getElementById('searchInput')?.value     || '').trim();
    const iqVal = (document.getElementById('searchInfoInput')?.value || '').trim();

    let hash = '#database';

    // Modal open? Use the modal's own set data (works for search-result cards too)
    const modalOpen = document.getElementById('cardModal')?.classList.contains('open');
    if (modalOpen) {
      try {
        const set  = (_modalSets && _modalSets[_modalIdx]) ? _modalSets[_modalIdx] : _modalSet;
        const card = _modalCards[_modalIdx];
        if (card?.card && set?.year && set?.collection) {
          hash += '/' + set.year;
          hash += '/' + encodeURIComponent(set.collection);
          hash += '/' + encodeURIComponent(card.card);
        }
      } catch(e) {}
    } else {
      if (currentYear) hash += '/' + currentYear;
      if (currentColl) hash += '/' + encodeURIComponent(currentColl);
    }

    const p = new URLSearchParams();
    if (qVal)  p.set('q',  qVal);
    if (iqVal) p.set('iq', iqVal);
    const qs = p.toString();
    if (qs) hash += '?' + qs;

    return hash;
  }

  // ── SYNC (replaceState only, never pushState) ─────────────
  let _debounce = null;
  let _syncPaused = false;  // when true, syncURL does nothing (popstate is handling URL)

  function syncURL() {
    if (_syncPaused) return;
    const hash = encodeState();
    if (location.hash === hash) return;
    history.replaceState(history.state, '', hash);
  }

  function debouncedSync(ms) {
    clearTimeout(_debounce);
    _debounce = setTimeout(syncURL, ms || 400);
  }

  window._routerSync = syncURL;

  // ── HOOKS ─────────────────────────────────────────────────
  window.addEventListener('load', () => {

    // 1. Wrap _renderModal
    const _origRenderModal = window._renderModal;
    if (typeof _origRenderModal === 'function') {
      window._renderModal = function(card, set) {
        _origRenderModal(card, set);
        requestAnimationFrame(syncURL);
      };
    }

    // 2. Wrap closeModal
    const _origClose = window.closeModal;
    if (typeof _origClose === 'function') {
      window.closeModal = function() {
        _origClose();
        requestAnimationFrame(syncURL);
      };
    }

    // 3. Wrap render functions
    ['renderCollections', 'renderCards', 'renderYearsOverview', 'showSection'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function(...args) {
        orig(...args);
        requestAnimationFrame(syncURL);
      };
    });

  });

  // 4. Search inputs → debounced sync
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const ni = document.getElementById('searchInput');
      const ii = document.getElementById('searchInfoInput');
      if (ni) ni.addEventListener('input', () => debouncedSync(400));
      if (ii) ii.addEventListener('input', () => debouncedSync(400));
    }, 0);
  });

  // ── RESTORE FROM HASH ─────────────────────────────────────
  async function restoreHash(hash, skipHistoryPush) {
    const raw = (hash || '').replace(/^#/, '').trim();
    if (!raw || raw === 'home') return;

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

    // Activate section silently
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById(section)?.classList.add('active');
    document.getElementById('nav-' + section)?.classList.add('active');

    if (section !== 'database') return;
    if (!Object.keys(allData).length) return;

    // Set search inputs
    if (q || iq) {
      const ni = document.getElementById('searchInput');
      const ii = document.getElementById('searchInfoInput');
      if (ni) ni.value = q  || '';
      if (ii) ii.value = iq || '';
      if (typeof searchTerm     !== 'undefined') searchTerm     = q  || '';
      if (typeof infoSearchTerm !== 'undefined') infoSearchTerm = iq || '';
    }

    // While we restore state, pause syncURL so the render-function wrappers
    // don't fire replaceState and overwrite the hash we just popped to.
    if (skipHistoryPush) _syncPaused = true;

    if (year) {
      currentYear = year;
      currentColl = null;
      renderSidebar();

      if (coll) {
        currentColl = coll;
        renderSidebar();

        const set = allData[`${year}::${coll}`];
        if (!set) {
          if (skipHistoryPush) _syncPaused = false;
          renderCollections(year);
          return;
        }

        // Hydrate stub if needed
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
            if (!skipHistoryPush) {
              history.replaceState({ qNav: true, root: true }, '', location.pathname + '#database');
              history.pushState({ qNav: true, label: String(year) }, '', location.pathname + '#database/' + year);
              history.pushState({ qNav: true, label: coll }, '', location.pathname + '#database/' + year + '/' + encodeURIComponent(coll));
            }
            setTimeout(() => {
              FIELDS = deriveFields(set);
              _modalSet   = set;
              _modalSets  = null;
              _modalCards = set.cards;
              _modalIdx   = set.cards.findIndex(c => c.card === cardId);
              if (_modalIdx < 0) _modalIdx = 0;
              _renderModal(target, set);
              document.getElementById('cardModal').classList.add('open');
              document.body.style.overflow = 'hidden';
              if (!skipHistoryPush) {
                const cardHash = '#database/' + year + '/' + encodeURIComponent(coll) + '/' + encodeURIComponent(cardId);
                history.pushState({ qNav: true, label: cardId }, '', location.pathname + cardHash);
              }
              _syncPaused = false;
            }, 80);
            return; // _syncPaused cleared in setTimeout above
          }
        }

        if (!skipHistoryPush) {
          history.replaceState({ qNav: true, root: true }, '', location.pathname + '#database');
          history.pushState({ qNav: true, label: String(year) }, '', location.pathname + '#database/' + year);
          history.pushState({ qNav: true, label: coll }, '', location.pathname + '#database/' + year + '/' + encodeURIComponent(coll));
        }

      } else {
        renderCollections(year);
        setBC([{ label: String(year), year }]);
        if (!skipHistoryPush) {
          history.replaceState({ qNav: true, root: true }, '', location.pathname + '#database');
          history.pushState({ qNav: true, label: String(year) }, '', location.pathname + '#database/' + year);
        }
        if (q || iq) renderCombinedSearch(q || null, iq || null);
      }

    } else if (q || iq) {
      renderCombinedSearch(q || null, iq || null);
      setBC([]);
    } else {
      renderYearsOverview();
      setBC([]);
    }

    if (skipHistoryPush) _syncPaused = false;
  }

  // ── INITIAL LOAD ──────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    const initialHash = location.hash;
    if (!initialHash || initialHash === '#' || initialHash === '#home') return;
    window._routerPendingHash = initialHash;
    if (typeof allData !== 'undefined' && Object.keys(allData).length) {
      restoreHash(initialHash);
    }
  });

  window._routerRestore = function() {
    const hash = window._routerPendingHash || location.hash;
    window._routerPendingHash = null;
    if (hash && hash !== '#' && hash !== '#home') restoreHash(hash);
  };

  window._router = { encode: encodeState, restore: restoreHash, sync: syncURL };

})();
