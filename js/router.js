// ── URL ROUTER ────────────────────────────────────────────
// Only does TWO things:
//   1. Keep the URL hash in sync with current app state (replaceState)
//   2. Restore state when the page loads with a deep-link hash
//
// Back/forward is left 100% to the original ui.js _pushNav logic.
// We never call pushState — only replaceState.
//
// Hash format:
//   #section
//   #database[/year[/collection[/card]]][?q=name&iq=info&country=ISO]

(function () {
  'use strict';

  // ── ENCODE ────────────────────────────────────────────────
  function encodeState() {
    const activeSection = ['home','database','play','contact'].find(id =>
      document.getElementById(id)?.classList.contains('active')
    ) || 'home';

    if (activeSection !== 'database') return '#' + activeSection;

    // Read search terms directly from DOM — JS vars lag by one tick
    const qVal  = (document.getElementById('searchInput')?.value     || '').trim();
    const iqVal = (document.getElementById('searchInfoInput')?.value || '').trim();

    // Country filter active?
    const countryIso = (typeof window._getCmapSelectedIso === 'function' && window._getCmapSelectedIso()) || null;

    let hash = '#database';

    // Modal open? Use the modal's own set data (works for search-result cards too)
    const modalOpen = document.getElementById('cardModal')?.classList.contains('open');
    if (modalOpen) {
      try {
        // _modalSets[_modalIdx] is the correct set for multi-set search results
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
    if (qVal)       p.set('q',       qVal);
    if (iqVal)      p.set('iq',      iqVal);
    if (countryIso) p.set('country', countryIso);
    const qs = p.toString();
    if (qs) hash += '?' + qs;

    return hash;
  }

  // ── REPLACE (never push) ──────────────────────────────────
  let _debounce = null;

  function syncURL() {
    const hash = encodeState();
    if (location.hash === hash) return;
    history.replaceState(history.state, '', hash);
  }

  function debouncedSync(ms) {
    clearTimeout(_debounce);
    _debounce = setTimeout(syncURL, ms || 400);
  }

  // Expose for external callers
  window._routerSync = syncURL;

  // ── HOOKS ─────────────────────────────────────────────────
  window.addEventListener('load', () => {

    // 1. Wrap _renderModal — fires for ALL card openings including search results
    //    (search.js bypasses openModal and calls _renderModal + classList.add directly)
    const _origRenderModal = window._renderModal;
    if (typeof _origRenderModal === 'function') {
      window._renderModal = function(card, set) {
        _origRenderModal(card, set);
        // Sync after next frame so modal class is added and _modalIdx is set
        requestAnimationFrame(syncURL);
      };
    }

    // 2. Wrap closeModal → sync URL after close
    const _origClose = window.closeModal;
    if (typeof _origClose === 'function') {
      window.closeModal = function() {
        _origClose();
        requestAnimationFrame(syncURL);
      };
    }

    // 3. Wrap renderCollections / renderCards / renderYearsOverview / showSection
    //    so navigating updates the URL immediately
    ['renderCollections', 'renderCards', 'renderYearsOverview', 'showSection'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function(...args) {
        orig(...args);
        requestAnimationFrame(syncURL);
      };
    });

    // 4. Wrap selectCountry (map.js) to encode country in URL
    const _origSelectCountry = window.selectCountry;
    if (typeof _origSelectCountry === 'function') {
      window.selectCountry = function(iso) {
        _origSelectCountry(iso);
        // selectCountry is async; sync after a short delay to let it set _cmapSelectedIso
        setTimeout(syncURL, 100);
      };
    }

    // 5. Modal copy-link button
    const modal = document.getElementById('cardModal');
    if (modal) {
      new MutationObserver(() => {
        if (modal.classList.contains('open')) _injectCopyBtn();
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
  });

  // 6. Search inputs → debounced sync (no push, just replace)
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const ni = document.getElementById('searchInput');
      const ii = document.getElementById('searchInfoInput');
      if (ni) ni.addEventListener('input', () => debouncedSync(400));
      if (ii) ii.addEventListener('input', () => debouncedSync(400));
    }, 0);
  });

  // ── RESTORE FROM HASH ─────────────────────────────────────
  async function restoreHash(hash) {
    const raw = (hash || '').replace(/^#/, '').trim();
    if (!raw || raw === 'home') return;

    const [pathPart, qsPart] = raw.split('?');
    const segs   = pathPart.split('/').filter(Boolean);
    const params = new URLSearchParams(qsPart || '');

    const section   = segs[0] || 'home';
    const year      = segs[1] ? Number(segs[1]) : null;
    const coll      = segs[2] ? decodeURIComponent(segs[2]) : null;
    const cardId    = segs[3] ? decodeURIComponent(segs[3]) : null;
    const q         = params.get('q')       || '';
    const iq        = params.get('iq')      || '';
    const countryIso= params.get('country') || '';

    if (!['home','database','play','contact'].includes(section)) return;

    // Activate section silently (avoid side effects of showSection)
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById(section)?.classList.add('active');
    document.getElementById('nav-' + section)?.classList.add('active');

    if (section !== 'database') return;
    if (!Object.keys(allData).length) return;

    // Country view
    if (countryIso && !year && !coll && typeof selectCountry === 'function') {
      selectCountry(countryIso);
      return;
    }

    // Set search inputs
    if (q || iq) {
      const ni = document.getElementById('searchInput');
      const ii = document.getElementById('searchInfoInput');
      if (ni) ni.value = q  || '';
      if (ii) ii.value = iq || '';
      if (typeof searchTerm     !== 'undefined') searchTerm     = q  || '';
      if (typeof infoSearchTerm !== 'undefined') infoSearchTerm = iq || '';
    }

    if (year) {
      currentYear = year;
      currentColl = null;
      renderSidebar();

      if (coll) {
        currentColl = coll;
        renderSidebar();

        const set = allData[`${year}::${coll}`];
        if (!set) { renderCollections(year); return; }

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
            // Push history entries for each level so back works step by step:
            // [replaceState(card)] → after pushes: [replaceState(db), push(year), push(coll), push(card)]
            // The initial replaceState at boot already has the card hash; we replace it with
            // the database root, then push year → coll → card so each back press goes up one level.
            history.replaceState({ qNav: true, root: true }, '', location.pathname + '#database');
            history.pushState({ qNav: true, label: String(year) }, '', location.pathname + '#database/' + year);
            history.pushState({ qNav: true, label: coll }, '', location.pathname + '#database/' + year + '/' + encodeURIComponent(coll));
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
              // Push the card level entry last (after modal is open so navHash encodes card)
              const cardHash = '#database/' + year + '/' + encodeURIComponent(coll) + '/' + encodeURIComponent(cardId);
              history.pushState({ qNav: true, label: cardId }, '', location.pathname + cardHash);
            }, 80);
          }
        } else {
          // No card: deep-link to collection view — push year entry so back goes to year list
          history.replaceState({ qNav: true, root: true }, '', location.pathname + '#database');
          history.pushState({ qNav: true, label: String(year) }, '', location.pathname + '#database/' + year);
          history.pushState({ qNav: true, label: coll }, '', location.pathname + '#database/' + year + '/' + encodeURIComponent(coll));
        }
      } else {
        renderCollections(year);
        setBC([{ label: String(year), year }]);
        // Push a year-level entry so back goes to the database root
        history.replaceState({ qNav: true, root: true }, '', location.pathname + '#database');
        history.pushState({ qNav: true, label: String(year) }, '', location.pathname + '#database/' + year);
        if (q || iq) renderCombinedSearch(q || null, iq || null);
      }
    } else if (q || iq) {
      renderCombinedSearch(q || null, iq || null);
      setBC([]);
    } else {
      renderYearsOverview();
      setBC([]);
    }
  }

  // ── INITIAL LOAD ──────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    const initialHash = location.hash;
    if (!initialHash || initialHash === '#' || initialHash === '#home') return;
    // Store for after data loads
    window._routerPendingHash = initialHash;
    // If data already ready (shouldn't happen on first load, but just in case)
    if (typeof allData !== 'undefined' && Object.keys(allData).length) {
      restoreHash(initialHash);
    }
  });

  // Called by loader.js finishLoad() once allData is populated
  window._routerRestore = function() {
    const hash = window._routerPendingHash || location.hash;
    window._routerPendingHash = null;
    if (hash && hash !== '#' && hash !== '#home') restoreHash(hash);
  };

  // ── MODAL COPY LINK ───────────────────────────────────────
  function _injectCopyBtn() {
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
      const url = location.origin + location.pathname + encodeState();
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => prompt('Copy:', url));
      } else {
        prompt('Copy this link:', url);
      }
      btn.textContent = '✓'; btn.style.color = '#4caf50';
      setTimeout(() => { btn.textContent = '🔗'; btn.style.color = ''; }, 1800);
    };
    modal.appendChild(btn);
  }

  window._router = { encode: encodeState, restore: restoreHash, sync: syncURL };

})();
