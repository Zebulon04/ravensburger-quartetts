// ── CONTENT ───────────────────────────────────────────────
function renderEmpty() {
  document.getElementById('dbContent').innerHTML = `
    <div class="empty-state">
      <div class="big">📂</div>
      <h3>No Data Loaded</h3>
      <p>Click "Load JSON" above and select one or more quartett.json files</p>
    </div>`;
}

function renderYearsOverview() {
  setToolbarMode('years');
  const content = document.getElementById('dbContent');
  const byYear = {};
  Object.values(allData).forEach(s => { (byYear[s.year]=byYear[s.year]||[]).push(s); });
  const years = Object.keys(byYear).map(Number).sort((a,b) => yearSortAsc ? a-b : b-a);
  if (!years.length) { renderEmpty(); return; }

  content.innerHTML = '';
  const grid = document.createElement('div'); grid.className = 'coll-grid';
  years.forEach(year => {
    const cols = byYear[year];
    const total = cols.reduce((s,c) => s + cardCount(c), 0);
    // Use dedicated year cover image if available, fallback to first set's titlecard
    const yearImgUrl = yearImageMap[String(year)] || findTitleCardUrl(cols[0]);
    const el = document.createElement('div'); el.className = 'coll-card';
    el.innerHTML = `
      <div class="cimg">
        ${yearImgUrl ? `<img src="${yearImgUrl}" alt="${year}">` : `<span class="cimg-fallback">📅</span>`}
      </div>
      <div class="icon-body">
        <h3>${year}</h3>
        <p>${cols.length} ${t('setsWord')}</p>
        <div class="cnt">${total} ${t('cardsWord')}</div>
      </div>`;
    el.onclick = () => {
      currentYear=year; currentColl=null;
      renderSidebar();
      renderCollections(year);
      setBC([{label:String(year), year}]);
      if (window._pushNav) window._pushNav(String(year));
    };
    grid.appendChild(el);
  });
  content.appendChild(grid);
  setBC([]);
}

function renderCollections(year) {
  setToolbarMode('sets');
  const cols = Object.values(allData).filter(s => s.year == year);
  const content = document.getElementById('dbContent');
  content.innerHTML = '';
  if (!cols.length) { content.innerHTML = `<div class="empty-state"><div class="big">🗂</div><h3>No data for ${year}</h3><p>Load a JSON for this year.</p></div>`; return; }

  const grid = document.createElement('div'); grid.className = 'coll-grid';
  cols.forEach(set => {
    const titleImgUrl = findTitleCardUrl(set);
    const count = cardCount(set);
    const el = document.createElement('div'); el.className = 'coll-card';
    el.innerHTML = `
      <div class="cimg">
        ${titleImgUrl ? `<img src="${titleImgUrl}" alt="${set.collection}">` : `<span class="cimg-fallback">🃏</span>`}
      </div>
      <div class="icon-body">
        <h3>${set.collection}</h3>
        <p>${year}</p>
        <div class="cnt">${count} ${t('cardsWord')}</div>
      </div>`;
    el.onclick = async () => {
      currentColl = set.collection;
      renderSidebar();
      // If stub (cards not yet fetched), load now
      if (set._stub || !set.cards) {
        content.innerHTML = `<div class="empty-state"><div class="big">⏳</div><h3>Loading ${set.collection}…</h3></div>`;
        try {
          const jsonText = await fetchWithRetry(set._jsonUrl).then(r => r.text());
          const jsonData = JSON.parse(jsonText);
          // Merge into existing stub
          set.cards = jsonData.cards;
          set._stub = false;
          // Update cache
          const cacheKey = Object.keys(localStorage).find(k => k.startsWith('qCache_v2_'));
          if (cacheKey) {
            try {
              const cached = JSON.parse(localStorage.getItem(cacheKey));
              cached.data[`${set.year}::${set.collection}`] = set;
              localStorage.setItem(cacheKey, JSON.stringify(cached));
            } catch(e) {}
          }
        } catch(e) {
          content.innerHTML = `<div class="empty-state"><div class="big">❌</div><h3>Failed to load</h3><p>${e.message}</p></div>`;
          return;
        }
      }
      renderCards(set);
      setBC([
        {label:String(year), year},
        {label:set.collection, setKey:`${year}::${set.collection}`}
      ]);
      if (window._pushNav) window._pushNav(set.collection);
    };
    grid.appendChild(el);
  });
  content.appendChild(grid);
}

// 4. Show/hide filter toolbar depending on view level
function setToolbarMode(mode) {
  const toolbar = document.querySelector('.db-toolbar');
  if (!toolbar) return;
  const filters = toolbar.querySelectorAll('.filter-btn, #filterAll');
  const searchBox = toolbar.querySelector('.search-box');
  const sortBtns  = document.getElementById('searchSortBtns');
  const yearSortMob = document.getElementById('yearSortMobileBtn');
  const cardSortBtn = document.getElementById('cardSortByBtn');

  // Always hide card-sort button unless we're in cards mode
  if (cardSortBtn && mode !== 'cards') cardSortBtn.style.display = 'none';

  const isMobile = window.innerWidth <= 680;

  // Update mobile year sort button label
  if (yearSortMob) {
    yearSortMob.textContent = yearSortAsc ? 'Jahr ↑' : 'Jahr ↓';
  }

  if (mode === 'years') {
    toolbar.style.display = '';
    if (searchBox) searchBox.style.display = '';
    if (sortBtns)  sortBtns.style.display  = 'none';
    if (yearSortMob) yearSortMob.style.display = isMobile ? '' : 'none';
    filters.forEach(b => b.style.display = 'none');
  } else if (mode === 'sets') {
    toolbar.style.display = '';
    if (searchBox) searchBox.style.display = '';
    if (sortBtns)  sortBtns.style.display  = 'flex';
    if (yearSortMob) yearSortMob.style.display = 'none';
    filters.forEach(b => b.style.display = 'none');
  } else {
    toolbar.style.display = '';
    if (searchBox) searchBox.style.display = '';
    if (sortBtns)  sortBtns.style.display  = 'none';
    if (yearSortMob) yearSortMob.style.display = 'none';
    filters.forEach(b => b.style.display = isMobile ? 'none' : '');
    if (cardSortBtn) cardSortBtn.style.display = 'none';
  }
}
let _lastFilterSet = null; // track which set the buttons were built for

function renderFilterButtons(set) {
  // Filter buttons removed — keeping activeFilter reset only
  activeFilter = 'all';
}


let cardSetSortKey = null; // null = grade order, or a FIELDS key
let cardSetSortRev = false;

function renderCards(set) {
  setToolbarMode('cards');
  FIELDS = deriveFields(set);
  renderFilterButtons(set);

  // Inject Sort By button into toolbar (replace any previous one)
  const toolbar = document.querySelector('.db-toolbar');
  let sortByBtn = document.getElementById('cardSortByBtn');
  if (!sortByBtn && toolbar) {
    sortByBtn = document.createElement('button');
    sortByBtn.id = 'cardSortByBtn';
    sortByBtn.className = 'sort-btn';
    sortByBtn.style.cssText = 'display:none;';
    sortByBtn.textContent = 'Sort By';
    sortByBtn.onclick = () => openCardSortPanel(set);
    toolbar.appendChild(sortByBtn);
  }
  if (sortByBtn) {
    sortByBtn.style.display = '';
    sortByBtn.onclick = () => openCardSortPanel(set);
    // Highlight if a custom sort is active
    const activeLabel = cardSetSortKey === '__name__'
      ? (cardSetSortRev ? 'Z–A' : 'A–Z')
      : cardSetSortKey
        ? (FIELDS.find(f=>f.key===cardSetSortKey)?.label || cardSetSortKey)
        : null;
    sortByBtn.textContent = activeLabel ? `${activeLabel} ${cardSetSortRev?'↓':'↑'}` : 'Sort By';
    sortByBtn.classList.toggle('on', !!cardSetSortKey);
  }

  let cards = [...set.cards];
  if (activeFilter !== 'all') cards = cards.filter(c => c.category && c.category.toLowerCase().includes(activeFilter.toLowerCase()));
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    cards = cards.filter(c => c.name.toLowerCase().includes(q) || (c.category||'').toLowerCase().includes(q) || (c.card||'').toLowerCase().includes(q));
  }
  if (infoSearchTerm) {
    const qi = infoSearchTerm.toLowerCase();
    cards = cards.filter(c => {
      const info = [c.info, c.info_left, c.info_right, c.info_image].filter(Boolean).join(' ');
      return info.toLowerCase().includes(qi);
    });
  }

  // Sort cards
  if (cardSetSortKey === '__name__') {
    cards.sort((a, b) => {
      const cmp = (a.name || '').localeCompare(b.name || '');
      return cardSetSortRev ? -cmp : cmp;
    });
  } else if (cardSetSortKey) {
    cards.sort((a, b) => {
      const av = parseFloat(a[cardSetSortKey]) || 0;
      const bv = parseFloat(b[cardSetSortKey]) || 0;
      return cardSetSortRev ? bv - av : av - bv;
    });
  } else {
    cards.sort((a, b) => {
      const gradeA = a.card || '';
      const gradeB = b.card || '';
      const numA = parseInt(gradeA) || 0;
      const numB = parseInt(gradeB) || 0;
      if (numA !== numB) return numA - numB;
      return gradeA.localeCompare(gradeB);
    });
  }

  const content = document.getElementById('dbContent');
  content.innerHTML = '';
  if (!cards.length) { content.innerHTML = `<div class="empty-state"><div class="big">🔍</div><h3>No cards match</h3><p>Try a different search or filter</p></div>`; return; }

  // ── QUARTETT LAYOUT ──────────────────────────────────────
  // When a custom sort is active, use a simple flat grid instead
  // so the sorted order is respected
  function makeCardEl(card, orderedCards) {
    const el = document.createElement('div');
    el.className = 'qcard';
    el.onclick = () => openModal(card, set, orderedCards);
    const statsHTML = FIELDS.map(f => {
      const v = card[f.key]; if (!v) return '';
      return `<div class="srow"><span class="skey">${f.label}</span><span class="sval">${v}<span class="sunit">${f.unit}</span></span></div>`;
    }).join('');

    // Show active sort stat under name when a stat sort is active
    let sortStatHTML = '';
    if (cardSetSortKey && cardSetSortKey !== '__name__') {
      const f = FIELDS.find(fi => fi.key === cardSetSortKey);
      const v = card[cardSetSortKey];
      if (f && v != null && v !== '') {
        sortStatHTML = `<div class="qcard-sort-stat"><span class="sstat-label">${f.label}: </span><strong>${v}</strong><span class="sunit">${f.unit}</span></div>`;
      }
    }

    el.innerHTML = `
      <div class="qcard-img">
        <img alt="${card.name}">
        <div class="qcard-placeholder">🚗<span>No Image</span></div>
        <div class="country-badge">${flag(card.country||'')}</div>
      </div>
      <div class="qcard-body">
        <div class="qcard-body-row">
          <span class="qcard-cat">${card.category||''}</span>
          <span class="qcard-grade">${card.card||''}</span>
        </div>
        <div class="qcard-name">${card.name}</div>
        <div class="qcard-stats">${statsHTML}</div>
        ${sortStatHTML}
      </div>`;
    const img = el.querySelector('.qcard-img img');
    const ph  = el.querySelector('.qcard-placeholder');
    loadImgForGrade(img, card.card, ph, set);
    return el;
  }

  // Build a lookup: "1A" → card
  const byGrade = {};
  cards.forEach(c => { if (c.card) byGrade[c.card.toUpperCase()] = c; });

  // Get sorted unique numbers and letters from ALL set cards (not just filtered)
  // so the grid positions stay stable when filtering
  const allCards = set.cards;
  const allNums = [...new Set(allCards.map(c => parseInt(c.card)).filter(n => !isNaN(n) && n > 0))].sort((a,b)=>a-b);
  const allLetters = [...new Set(allCards.map(c => { const m = (c.card||'').match(/[A-Za-z]+$/); return m ? m[0].toUpperCase() : null; }).filter(Boolean))].sort();

  // Standard quartett: 8 numbers, 4 letters — split nums at 4
  const SPLIT = 4;
  const leftNums  = allNums.filter(n => n <= SPLIT);
  const rightNums = allNums.filter(n => n >  SPLIT);

  const useQuartettLayout = leftNums.length > 0 && allLetters.length > 0;

  const grid = document.createElement('div');

  // Build ordered card list matching visual grid order (for keyboard nav)
  const orderedCards = [];
  leftNums.forEach(num => allLetters.forEach(letter => {
    const c = byGrade[`${num}${letter}`]; if (c) orderedCards.push(c);
  }));
  rightNums.forEach(num => allLetters.forEach(letter => {
    const c = byGrade[`${num}${letter}`]; if (c) orderedCards.push(c);
  }));
  if (!useQuartettLayout) orderedCards.push(...cards);

  const isMob = window.innerWidth <= 680;

  if (useQuartettLayout && !cardSetSortKey) {
    // Standard quartett layout (grade order)
    grid.className = 'card-grid';

    if (isMob) {
      orderedCards.forEach(card => grid.appendChild(makeCardEl(card, orderedCards)));
    } else {
      leftNums.forEach((num, rowIdx) => {
        const cssRow = rowIdx + 1;
        allLetters.forEach((letter, colIdx) => {
          const grade = `${num}${letter}`;
          const card  = byGrade[grade];
          if (!card) return;
          const el = makeCardEl(card, orderedCards);
          el.style.gridColumn = colIdx + 1;
          el.style.gridRow    = cssRow;
          grid.appendChild(el);
        });
      });

      // Divider spacer cell — desktop only
      const divider = document.createElement('div');
      divider.className = 'card-grid-divider';
      grid.appendChild(divider);

      rightNums.forEach((num, rowIdx) => {
        const cssRow = rowIdx + 1;
        allLetters.forEach((letter, colIdx) => {
          const grade = `${num}${letter}`;
          const card  = byGrade[grade];
          if (!card) return;
          const el = makeCardEl(card, orderedCards);
          el.style.gridColumn = colIdx + 6;
          el.style.gridRow    = cssRow;
          grid.appendChild(el);
        });
      });
    }

  } else {
    // Flat grid: either non-quartett set OR custom sort active
    grid.style.cssText = `display:grid;grid-template-columns:${isMob ? 'repeat(4,1fr)' : 'repeat(auto-fill,minmax(150px,1fr))'};gap:${isMob?'6px':'12px'};padding:${isMob?'8px':'20px'};animation:fadeUp .3s ease;`;
    const displayCards = cardSetSortKey ? cards : (useQuartettLayout ? orderedCards : cards);
    displayCards.forEach(card => grid.appendChild(makeCardEl(card, displayCards)));
  }

  content.appendChild(grid);
}

// ── MODAL ─────────────────────────────────────────────────
let _modalCards = [];   // current ordered card list shown in the grid
let _modalIdx   = 0;    // index of open card within _modalCards
let _modalSet   = null; // current set (for single-set views)
let _modalSets  = null; // per-card sets array (for search results; null = use _modalSet for all)

function openModal(card, set, cardList) {
  _modalSet   = set;
  _modalSets  = null; // single-set view — all cards share the same set
  _modalCards = cardList || (set.cards || []);
  _modalIdx   = _modalCards.findIndex(c => c.card === card.card);
  if (_modalIdx < 0) _modalIdx = 0;
  _renderModal(card, set);
  document.getElementById('cardModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  window.dispatchEvent(new Event('scroll'));
  if (window._pushNav) window._pushNav('modal');
}

function _renderModal(card, set) {
  const mImg  = document.getElementById('mImg');

  // Keep nav buttons, replace image + pholder
  mImg.querySelectorAll('img, .pholder').forEach(el => el.remove());
  const img = document.createElement('img'); img.alt = card.name;
  const ph  = document.createElement('div'); ph.className = 'pholder';
  ph.innerHTML = `🚗<span>No Image</span>`;
  mImg.appendChild(img);
  mImg.appendChild(ph);
  loadImgForGrade(img, card.card, ph, set);

  // Click image to open lightbox
  mImg.onclick = (e) => {
    e.stopPropagation();
    const src = img.src;
    if (!img.classList.contains('loaded') || !src) return;
    openLightbox(src);
  };

  // Update nav arrow state
  document.getElementById('modalPrev').classList.toggle('dim', _modalIdx <= 0);
  document.getElementById('modalNext').classList.toggle('dim', _modalIdx >= _modalCards.length - 1);

  const statsHTML = FIELDS.map(f => {
    const v = card[f.key] || '—';
    return `<div class="mstat"><div class="key">${f.label}</div><div class="val">${v}${v !== '—' ? `<span class="unit">${f.unit}</span>` : ''}</div></div>`;
  }).join('');

  const metaItems = [
    { label: 'Year',       val: set.year },
    { label: 'Collection', val: set.collection },
    ...(card.country  ? [{ label: 'Country',  val: card.country }] : []),
    ...(card.category ? [{ label: 'Category', val: card.category }] : []),
  ].map(m => `<div class="meta-item"><span class="meta-label">${m.label}</span><span class="meta-val">${m.val}</span></div>`).join('');

  // Derive quartett group (e.g. "3B" → group "3", or "1A" → "1")
  const gradeStr = (card.card || '').trim();
  const quartettGroup = gradeStr.replace(/[A-Da-d]$/, '');
  const quartettSiblings = quartettGroup && set.cards
    ? set.cards.filter(c => c.card && c.card.replace(/[A-Da-d]$/, '') === quartettGroup)
        .sort((a, b) => (a.card || '').localeCompare(b.card || ''))
    : [];
  const showQuartettBtn = quartettSiblings.length > 1
    ? `<button class="sort-btn" id="showQuartettBtn" style="margin-top:12px;width:100%;justify-content:center;font-size:.72rem;" onclick="openQuartettView('${quartettGroup}')">show quartett</button>`
    : '';

  document.getElementById('mBody').innerHTML = `
    <div class="modal-title">${card.name}</div>
    <div class="modal-meta-grid">${metaItems}</div>
    ${card.info_image ? `<div class="modal-info-box modal-info-image">${card.info_image}</div>` : ''}
    ${card.info_left  ? `<div class="modal-info-box modal-info-left">${card.info_left}</div>`  : ''}
    ${card.info_right ? `<div class="modal-info-box modal-info-right">${card.info_right}</div>` : ''}
    <div class="modal-divider"></div>
    <div class="modal-stats-grid">${statsHTML}</div>
    ${showQuartettBtn}`;

  // Auto-shrink modal-title and modal-info-box text to fit one row
  requestAnimationFrame(() => {
    const body = document.getElementById('mBody');
    if (!body) return;
    // Shrink title
    const titleEl = body.querySelector('.modal-title');
    if (titleEl) {
      let fs = 2.1; // rem
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
      titleEl.style.fontSize = fs + 'rem';
      while (titleEl.scrollWidth > titleEl.clientWidth && fs > 0.7) {
        fs = Math.round((fs - 0.05) * 100) / 100;
        titleEl.style.fontSize = fs + 'rem';
      }
    }
    // Shrink info boxes
    body.querySelectorAll('.modal-info-box').forEach(box => {
      let fs = 0.88; // rem
      box.style.fontSize = fs + 'rem';
      while (box.scrollWidth > box.clientWidth && fs > 0.5) {
        fs = Math.round((fs - 0.02) * 100) / 100;
        box.style.fontSize = fs + 'rem';
      }
    });
  });
}

async function openRandomCard() {
  // Collect all sets that have cards loaded, or have stubs we can pick from the index
  const allCards = [];

  // Prefer using cardNamesIndex (always available after repo load) for a fast flat list
  if (typeof cardNamesIndex !== 'undefined' && cardNamesIndex.length) {
    cardNamesIndex.forEach(entry => {
      (entry.cards || []).forEach(card => {
        allCards.push({ card, setMeta: entry });
      });
    });
  } else {
    // Fallback: only sets already fully loaded
    Object.values(allData).forEach(set => {
      if (set.cards) set.cards.forEach(card => allCards.push({ card, set }));
    });
  }

  if (!allCards.length) return;

  const pick = allCards[Math.floor(Math.random() * allCards.length)];
  const setKey = `${pick.setMeta ? pick.setMeta.year : pick.set.year}::${pick.setMeta ? pick.setMeta.collection : pick.set.collection}`;
  let set = allData[setKey];

  // Lazy-load if stub
  if (set && (set._stub || !set.cards)) {
    try {
      const text = await fetchWithRetry(set._jsonUrl).then(r => r.text());
      const json = JSON.parse(text);
      set.cards = json.cards;
      set._stub = false;
    } catch(e) { return; }
  }

  if (!set || !set.cards) return;

  // Find the full card data
  const fullCard = set.cards.find(c =>
    (c.card || '').toUpperCase() === (pick.card.card || '').toUpperCase()
  ) || pick.card;

  // Navigate to database section and open modal
  showSection('database');
  FIELDS = deriveFields(set);
  _modalCards = set.cards;
  _modalSets  = null;
  _modalSet   = set;
  _modalIdx   = set.cards.findIndex(c => (c.card||'').toUpperCase() === (fullCard.card||'').toUpperCase());
  if (_modalIdx < 0) _modalIdx = 0;
  _renderModal(fullCard, set);
  document.getElementById('cardModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (window._pushNav) window._pushNav('modal');
}

