function openQuartettView(group) {
  const set = _modalSet;
  if (!set || !set.cards) return;
  _renderQuartettOverlay(group, set);
}

function _getQuartettGroups(set) {
  // Return all unique quartett group numbers sorted numerically, e.g. ["1","2",...,"8"]
  const groups = [...new Set(
    (set.cards || [])
      .map(c => (c.card || '').replace(/[A-Da-d]$/i, '').trim())
      .filter(g => g.length > 0)
  )].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  return groups;
}

function _renderQuartettOverlay(group, set) {
  const siblings = (set.cards || [])
    .filter(c => c.card && c.card.replace(/[A-Da-d]$/i, '').trim() === String(group))
    .sort((a, b) => (a.card || '').localeCompare(b.card || ''));
  if (!siblings.length) return;

  const existing = document.getElementById('quartettOverlay');
  if (existing) existing.remove();

  const groups = _getQuartettGroups(set);
  const groupIdx = groups.indexOf(String(group));
  const hasPrev = groupIdx > 0;
  const hasNext = groupIdx < groups.length - 1;

  const overlay = document.createElement('div');
  overlay.id = 'quartettOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:3500;
    background:rgba(0,0,0,0.94);
    animation:fadeIn .22s ease;
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', escHandler); }
  });

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '\u2715';
  closeBtn.style.cssText = `
    position:absolute;top:14px;right:18px;z-index:10;
    background:rgba(255,255,255,.08);border:1px solid rgba(90,110,200,.3);
    border-radius:50%;width:36px;height:36px;font-size:.95rem;
    color:var(--text-secondary);cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    transition:background .18s,color .18s;
  `;
  closeBtn.onmouseenter = () => { closeBtn.style.background='rgba(255,255,255,.18)'; closeBtn.style.color='#fff'; };
  closeBtn.onmouseleave = () => { closeBtn.style.background='rgba(255,255,255,.08)'; closeBtn.style.color=''; };
  closeBtn.onclick = (e) => { e.stopPropagation(); overlay.remove(); document.removeEventListener('keydown', escHandler); };

  // Group label
  const label = document.createElement('div');
  label.style.cssText = `
    position:absolute;top:17px;left:50%;transform:translateX(-50%);
    font-family:var(--font-display);font-size:1rem;letter-spacing:.14em;
    color:rgba(255,255,255,.4);z-index:10;white-space:nowrap;pointer-events:none;
  `;
  label.textContent = 'QUARTETT ' + group;

  // Nav arrows
  function makeNavArrow(dir) {
    const btn = document.createElement('button');
    btn.innerHTML = dir === 'prev' ? '\u2039' : '\u203a';
    const disabled = dir === 'prev' ? !hasPrev : !hasNext;
    btn.style.cssText = `
      position:absolute;top:50%;transform:translateY(-50%);
      ${dir === 'prev' ? 'left:16px' : 'right:16px'};
      z-index:10;
      background:rgba(15,18,40,.85);border:1px solid var(--border-glow);
      border-radius:50%;width:48px;height:48px;
      display:flex;align-items:center;justify-content:center;
      cursor:${disabled ? 'default' : 'pointer'};
      color:var(--text-primary);font-size:2rem;line-height:1;
      transition:background .2s,border-color .2s,opacity .2s;
      opacity:${disabled ? '.18' : '1'};
      pointer-events:${disabled ? 'none' : 'auto'};
    `;
    if (!disabled) {
      btn.onmouseenter = () => { btn.style.background='rgba(58,143,255,.35)'; btn.style.borderColor='var(--accent-blue)'; };
      btn.onmouseleave = () => { btn.style.background='rgba(15,18,40,.85)'; btn.style.borderColor='var(--border-glow)'; };
      btn.onclick = (e) => {
        e.stopPropagation();
        const newIdx = dir === 'prev' ? groupIdx - 1 : groupIdx + 1;
        if (newIdx >= 0 && newIdx < groups.length) _renderQuartettOverlay(groups[newIdx], set);
      };
    }
    return btn;
  }

  // Image strip — flex row on desktop, 2x2 grid on mobile
  const isMobile = window.innerWidth <= 600;
  const strip = document.createElement('div');
  strip.style.cssText = isMobile ? `
    position:absolute;
    top:50%;left:50%;
    transform:translate(-50%,-50%);
    display:grid;
    grid-template-columns:1fr 1fr;
    grid-template-rows:1fr 1fr;
    gap:6px;
    width:calc(100vw - 16px);
    max-height:calc(100vh - 80px);
  ` : `
    position:absolute;
    top:50%;left:50%;
    transform:translate(-50%,-50%);
    display:flex;
    align-items:center;
    gap:10px;
  `;

  siblings.slice(0, 4).forEach((card, i) => {
    const imgKey = `${set.year}::${set.collection}::${card.card}`;
    const url = imageMap[imgKey];

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:relative;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
    `;

    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = card.name || card.card || '';
      img.style.cssText = isMobile ? `
        width:100%;height:100%;
        object-fit:contain;
        border-radius:4px;
        box-shadow:0 4px 20px rgba(0,0,0,.7);
        display:block;
        cursor:zoom-in;
      ` : `
        max-height:72vh;
        max-width:calc((100vw - 180px) / 4);
        width:auto;height:auto;
        object-fit:contain;
        border-radius:4px;
        box-shadow:0 8px 40px rgba(0,0,0,.7);
        display:block;
        transition:transform .18s,box-shadow .18s;
        cursor:zoom-in;
      `;
      img.onmouseenter = () => { img.style.transform='scale(1.03)'; img.style.boxShadow='0 16px 56px rgba(58,143,255,.35)'; };
      img.onmouseleave = () => { img.style.transform=''; img.style.boxShadow='0 8px 40px rgba(0,0,0,.7)'; };
      img.onclick = (e) => { e.stopPropagation(); openLightbox(url); };
      panel.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = isMobile ? `
        width:100%;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        color:var(--text-dim);font-size:2rem;gap:6px;
        border:1px solid var(--border-subtle);border-radius:4px;
        aspect-ratio:670/1068;
      ` : `
        width:calc((100vw - 180px) / 4);max-height:72vh;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        color:var(--text-dim);font-size:2.5rem;gap:8px;
        border:1px solid var(--border-subtle);border-radius:4px;
        aspect-ratio:670/1068;
      `;
      ph.innerHTML = '🚗<span style="font-family:var(--font-ui);font-size:.6rem;letter-spacing:.15em;color:var(--text-dim)">' + (card.card||'') + '</span>';
      panel.appendChild(ph);
    }

    strip.appendChild(panel);
  });

  overlay.appendChild(closeBtn);
  overlay.appendChild(label);
  overlay.appendChild(makeNavArrow('prev'));
  overlay.appendChild(makeNavArrow('next'));
  overlay.appendChild(strip);
  document.body.appendChild(overlay);

  // Keyboard navigation
  const escHandler = (e) => {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    else if (e.key === 'ArrowLeft'  && hasPrev) { _renderQuartettOverlay(groups[groupIdx - 1], set); document.removeEventListener('keydown', escHandler); }
    else if (e.key === 'ArrowRight' && hasNext) { _renderQuartettOverlay(groups[groupIdx + 1], set); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

function modalNav(dir) {
  const next = _modalIdx + dir;
  if (next < 0 || next >= _modalCards.length) return;
  _modalIdx = next;
  const card = _modalCards[_modalIdx];
  const set  = (_modalSets && _modalSets[_modalIdx]) ? _modalSets[_modalIdx] : _modalSet;
  // Update FIELDS for the card's own set when navigating across sets
  if (_modalSets && _modalSets[_modalIdx]) {
    FIELDS = deriveFields(_modalSets[_modalIdx]);
    _modalSet = _modalSets[_modalIdx];
  }
  _renderModal(card, set);
  // If lightbox is open, update its image to the new card
  if (document.getElementById('imgLightbox').classList.contains('open')) {
    // Wait for the new image to load in the modal, then mirror it
    const checkImg = () => {
      const modalImg = document.querySelector('#mImg img.loaded');
      if (modalImg) {
        document.getElementById('imgLightboxImg').src = modalImg.src;
      } else {
        setTimeout(checkImg, 80);
      }
    };
    checkImg();
  }
}

function closeModal() {
  document.getElementById('cardModal').classList.remove('open');
  document.body.style.overflow = '';
  window.dispatchEvent(new Event('scroll'));
}
function closeModalOuter(e){ if (e.target.id==='cardModal') closeModal(); }

// ── BREADCRUMB ────────────────────────────────────────────
function setBC(crumbs) {
  const bc = document.getElementById('breadcrumb');
  let html = `<span onclick="resetView()" data-i18n="all">${t('all')}</span>`;
  crumbs.forEach((c, i) => {
    html += `<span class="sep">›</span>`;
    if (i === crumbs.length - 1) {
      html += `<span class="current">${c.label}</span>`;
      if (c.setKey) {
        html += `<button class="bc-play-btn" data-setkey="${c.setKey}" onclick="bcPlaySet(this)" title="Play this set">▶ Play</button>`;
      }
    } else {
      // Use data-year attribute for safe year navigation — avoids closure serialization bug
      html += `<span class="bc-year-link" data-year="${c.year || ''}" onclick="bcNav(this)">${c.label}</span>`;
    }
  });
  bc.innerHTML = html;
}

function bcPlaySet(el) {
  const setKey = el.dataset.setkey;
  if (!setKey) return;
  const set = allData[setKey];
  if (!set) return;
  showSection('play');
  if (set._stub || !set.cards) {
    fetchWithRetry(set._jsonUrl).then(r => r.text()).then(text => {
      const json = JSON.parse(text);
      set.cards = json.cards;
      set._stub = false;
      initGame(setKey);
    }).catch(e => console.error('Failed to load set for game:', e));
  } else {
    initGame(setKey);
  }
}

// Called from breadcrumb year spans — identical behaviour to clicking the year-btn in the sidebar
function bcNav(el) {
  const year = Number(el.dataset.year);
  if (!year) return;
  clearSearch();
  currentYear = year; currentColl = null;
  renderSidebar();
  renderCollections(year);
  setBC([{label: String(year), year}]);
  if (window._pushNav) window._pushNav(String(year));
}

function setSearchSort(type) {
  if (searchSort === type) {
    searchSortRev = !searchSortRev; // toggle direction
  } else {
    searchSort = type;
    searchSortRev = false;
  }
  // Update button labels + active state
  const byYear = document.getElementById('sortByYear');
  const byName = document.getElementById('sortByName');
  if (byYear && byName) {
    byYear.classList.toggle('on', searchSort === 'year');
    byName.classList.toggle('on', searchSort === 'name');
    const yearArrow = searchSort === 'year' ? (searchSortRev ? '↑' : '↓') : '↓';
    const nameArrow = searchSort === 'name' ? (searchSortRev ? 'Z–A' : 'A–Z') : 'A–Z';
    byYear.textContent = `Jahr ${yearArrow}`;
    byName.textContent = nameArrow;
  }
  // Re-run search with current terms
  const nameTrimmed = (document.getElementById('searchInput')?.value || '').trim();
  const infoTrimmed = (document.getElementById('searchInfoInput')?.value || '').trim();
  if (_lastCountryResults) {
    // Re-render country results with new sort
    renderCountryResults(_lastCountryResults.iso, _lastCountryResults.name, _lastCountryResults.results);
  } else if (nameTrimmed || infoTrimmed) {
    renderCombinedSearch(nameTrimmed || null, infoTrimmed || null);
  }
}

function openCardSortPanel(set) {
  // Toggle: if dropdown already open, close it
  const existing = document.getElementById('cardSortPanel');
  if (existing) { existing.remove(); return; }

  const btn = document.getElementById('cardSortByBtn');
  if (!btn) return;

  const dropdown = document.createElement('div');
  dropdown.id = 'cardSortPanel';

  // Position dropdown below the button
  const rect = btn.getBoundingClientRect();
  dropdown.style.cssText = `
    position:fixed;
    top:${rect.bottom + 6}px;
    left:${rect.left}px;
    z-index:2000;
    background:var(--bg-panel);
    border:1px solid var(--border-glow);
    border-radius:var(--radius);
    padding:8px;
    display:flex; flex-direction:column; gap:4px;
    min-width:160px;
    box-shadow:0 8px 32px rgba(0,0,0,.5);
    animation:fadeIn .15s ease;
  `;

  // "Default" option — back to grade order
  const defBtn = document.createElement('button');
  defBtn.className = 'sort-btn' + (cardSetSortKey === null ? ' on' : '');
  defBtn.style.cssText = 'width:100%;text-align:left;justify-content:flex-start;';
  defBtn.textContent = cardSetSortKey === null ? '✓ Default' : 'Default';
  defBtn.onclick = () => {
    cardSetSortKey = null; cardSetSortRev = false;
    dropdown.remove(); renderCards(set);
  };
  dropdown.appendChild(defBtn);

  // A-Z by name
  const azBtn = document.createElement('button');
  azBtn.className = 'sort-btn' + (cardSetSortKey === '__name__' ? ' on' : '');
  azBtn.style.cssText = 'width:100%;text-align:left;justify-content:flex-start;';
  const azArrow = cardSetSortKey === '__name__' ? (cardSetSortRev ? ' Z–A' : ' A–Z') : '';
  azBtn.textContent = (cardSetSortKey === '__name__' ? '✓ ' : '') + 'Name' + azArrow;
  azBtn.onclick = () => {
    if (cardSetSortKey === '__name__') {
      cardSetSortRev = !cardSetSortRev;
    } else {
      cardSetSortKey = '__name__'; cardSetSortRev = false;
    }
    dropdown.remove(); renderCards(set);
  };
  dropdown.appendChild(azBtn);

  // One button per numeric stat field
  FIELDS.forEach(f => {
    const sampleVals = (set.cards || []).map(c => c[f.key]).filter(v => v != null && v !== '');
    const isNumeric = sampleVals.length > 0 && sampleVals.some(v => !isNaN(parseFloat(v)));
    if (!isNumeric) return;

    const isActive = cardSetSortKey === f.key;
    const btn2 = document.createElement('button');
    btn2.className = 'sort-btn' + (isActive ? ' on' : '');
    btn2.style.cssText = 'width:100%;text-align:left;justify-content:flex-start;';
    const arrow = isActive ? (cardSetSortRev ? ' ↓' : ' ↑') : '';
    btn2.textContent = (isActive ? '✓ ' : '') + f.label + arrow;
    btn2.onclick = () => {
      if (cardSetSortKey === f.key) {
        cardSetSortRev = !cardSetSortRev;
      } else {
        cardSetSortKey = f.key;
        cardSetSortRev = true; // default: highest values first
      }
      dropdown.remove(); renderCards(set);
    };
    dropdown.appendChild(btn2);
  });

  document.body.appendChild(dropdown);

  // Close on outside click
  setTimeout(() => {
    const close = (e) => {
      if (!dropdown.contains(e.target) && e.target.id !== 'cardSortByBtn') {
        dropdown.remove();
        document.removeEventListener('pointerdown', close);
      }
    };
    document.addEventListener('pointerdown', close);
  }, 50);
}

function clearSearch() {
  cardSetSortKey = null; cardSetSortRev = false;
  searchTerm = '';
  infoSearchTerm = '';
  _lastCountryResults = null;
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  const infoInp = document.getElementById('searchInfoInput');
  if (infoInp) infoInp.value = '';
  // Hide search sort buttons
  const sortBtns = document.getElementById('searchSortBtns');
  if (sortBtns) sortBtns.style.display = 'none';
}

function resetView() {
  clearSearch();
  currentYear=null; currentColl=null;
  renderSidebar(); renderYearsOverview();
  if (window._pushNav) window._pushNav('db');
}

