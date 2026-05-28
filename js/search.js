// ── SEARCH & FILTER ───────────────────────────────────────
function handleSearch(val) {
  searchTerm = val;
  const trimmedName = val.trim();
  const trimmedInfo = infoSearchTerm.trim();

  if (!trimmedName && !trimmedInfo) {
    // Both empty — return to previous context view
    if (_lastCountryResults) {
      renderCountryResults(_lastCountryResults.iso, _lastCountryResults.name, _lastCountryResults.results);
    } else if (currentColl && currentYear) {
      const set = allData[`${currentYear}::${currentColl}`];
      if (set && set.cards) renderCards(set);
    } else if (currentYear) {
      renderCollections(currentYear);
    } else {
      renderYearsOverview();
    }
    return;
  }

  // Require at least 3 characters in whichever field is active
  if (trimmedName.length > 0 && trimmedName.length < 3 && !trimmedInfo) return;

  // If we're inside a loaded collection, search it directly
  if (currentColl && currentYear) {
    const set = allData[`${currentYear}::${currentColl}`];
    if (set && set.cards) { renderCards(set); return; }
  }

  renderCombinedSearch(trimmedName || null, trimmedInfo || null);
}

// ── COMBINED SEARCH (name + info together) ────────────────
async function renderCombinedSearch(nameTerm, infoTerm) {
  const content = document.getElementById('dbContent');
  setToolbarMode('sets');

  const qName = nameTerm ? nameTerm.toLowerCase() : null;
  const qInfo = infoTerm ? infoTerm.toLowerCase() : null;

  // Fast path: use indexes when both are available, or fall back to slow path
  const hasNameIndex = cardNamesIndex.length > 0;
  const hasInfoIndex = cardInfosIndex.length > 0;

  // Build a combined lookup key → card for info index
  const infoMap = {};   // "year::collection::card" → info entry card
  if (hasInfoIndex) {
    cardInfosIndex.forEach(entry => {
      if (currentYear && String(entry.year) !== String(currentYear)) return;
      (entry.cards || []).forEach(c => {
        infoMap[`${entry.year}::${entry.collection}::${c.card}`] = { card: c, setMeta: entry };
      });
    });
  }

  if (hasNameIndex) {
    const results = [];
    cardNamesIndex.forEach(entry => {
      if (currentYear && String(entry.year) !== String(currentYear)) return;
      if (!entry.cards) return;
      entry.cards.forEach(c => {
        // Name filter
        const passesName = !qName || (c.name || '').toLowerCase().includes(qName) || (c.card || '').toLowerCase().includes(qName);
        if (!passesName) return;

        // Info filter
        if (qInfo) {
          if (hasInfoIndex) {
            const infoEntry = infoMap[`${entry.year}::${entry.collection}::${c.card}`];
            if (!infoEntry) return;
            const infoText = [infoEntry.card.info, infoEntry.card.info_left, infoEntry.card.info_right, infoEntry.card.info_image].filter(Boolean).join(' ');
            if (!infoText.toLowerCase().includes(qInfo)) return;
          }
          // If no info index, we can't fast-filter by info — will fall through to slow path below
        }

        results.push({ card: c, setMeta: entry });
      });
    });

    // If we needed info filtering but had no info index, fall to slow path
    if (qInfo && !hasInfoIndex) {
      await renderSlowCombinedSearch(qName, qInfo);
      return;
    }

    content.innerHTML = '';
    const termLabel = [nameTerm && `name "${nameTerm}"`, infoTerm && `info "${infoTerm}"`].filter(Boolean).join(' + ');
    if (!results.length) {
      const scope = currentYear ? `in ${currentYear}` : 'across all sets';
      content.innerHTML = `<div class="empty-state"><div class="big">🔍</div><h3>No results</h3><p>No cards matching ${termLabel} found ${scope}</p></div>`;
      return;
    }

    results.sort((a, b) => {
      let cmp = 0;
      if (searchSort === 'year') {
        cmp = Number(a.setMeta.year) - Number(b.setMeta.year);
        if (cmp === 0) cmp = (a.card.name || '').localeCompare(b.card.name || '');
      } else {
        cmp = (a.card.name || '').localeCompare(b.card.name || '');
      }
      return searchSortRev ? -cmp : cmp;
    });

    const scope = currentYear ? `in ${currentYear}` : 'in all sets';
    const header = document.createElement('div');
    header.style.cssText = 'padding:12px 20px 4px;font-family:var(--font-ui);font-size:.72rem;letter-spacing:.1em;color:var(--text-dim);';
    header.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for ${termLabel} ${scope}`;
    content.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'search-results-grid';

    results.forEach(({ card, setMeta }) => {
      const set = allData[`${setMeta.year}::${setMeta.collection}`];
      const el = document.createElement('div');
      el.className = 'qcard';
      el.onclick = async () => {
        if (set && !set._stub && set.cards && set.cards.length) {
          const fullCard = set.cards.find(c => c.card === card.card) || card;
          const allSearchCards = results.map(r => {
            const s = allData[`${r.setMeta.year}::${r.setMeta.collection}`];
            return s && !s._stub && s.cards ? (s.cards.find(c => c.card === r.card.card) || r.card) : r.card;
          });
          const allSearchSets = results.map(r => allData[`${r.setMeta.year}::${r.setMeta.collection}`] || set);
          FIELDS = deriveFields(set);
          _modalSet = set; _modalCards = allSearchCards; _modalSets = allSearchSets;
          _modalIdx = results.findIndex(r => r.card.card === card.card && r.setMeta.year === setMeta.year && r.setMeta.collection === setMeta.collection);
          if (_modalIdx < 0) _modalIdx = 0;
          _renderModal(fullCard, set);
          document.getElementById('cardModal').classList.add('open');
          document.body.style.overflow = 'hidden';
          return;
        }
        // Stub — fetch the full JSON first
        const targetSet = set || { year: setMeta.year, collection: setMeta.collection, _stub: true, cards: [] };
        const jsonUrl = targetSet._jsonUrl || (allData[`${setMeta.year}::${setMeta.collection}`] || {})._jsonUrl;
        if (jsonUrl) {
          try {
            const jsonText = await fetchWithRetry(jsonUrl).then(r => r.text());
            const jsonData = JSON.parse(jsonText);
            targetSet.cards = jsonData.cards; targetSet._stub = false;
            allData[`${setMeta.year}::${setMeta.collection}`] = Object.assign(allData[`${setMeta.year}::${setMeta.collection}`] || targetSet, { cards: jsonData.cards, _stub: false });
            const ck = Object.keys(localStorage).find(k => k.startsWith('qCache_v2_'));
            if (ck) { try { const cc=JSON.parse(localStorage.getItem(ck)); cc.data[`${setMeta.year}::${setMeta.collection}`]=allData[`${setMeta.year}::${setMeta.collection}`]; localStorage.setItem(ck,JSON.stringify(cc)); } catch(e){} }
            const fullCard2 = targetSet.cards.find(c => c.card === card.card) || card;
            FIELDS = deriveFields(targetSet);
            _modalSet = targetSet;
            _modalCards = results.map(r => { const s2=allData[`${r.setMeta.year}::${r.setMeta.collection}`]; return s2&&!s2._stub&&s2.cards?(s2.cards.find(c=>c.card===r.card.card)||r.card):r.card; });
            _modalSets  = results.map(r => allData[`${r.setMeta.year}::${r.setMeta.collection}`] || targetSet);
            _modalIdx = results.findIndex(r => r.card.card === card.card && r.setMeta.year === setMeta.year && r.setMeta.collection === setMeta.collection);
            if (_modalIdx < 0) _modalIdx = 0;
            _renderModal(fullCard2, targetSet);
            document.getElementById('cardModal').classList.add('open');
            document.body.style.overflow = 'hidden';
            return;
          } catch(e) { console.warn('Stub fetch failed:', e); }
        }
        FIELDS = [];
        _modalSet = targetSet;
        _modalCards = results.map(r => r.card);
        _modalSets  = results.map(r => allData[`${r.setMeta.year}::${r.setMeta.collection}`] || targetSet);
        _modalIdx = results.findIndex(r => r.card.card === card.card && r.setMeta.year === setMeta.year && r.setMeta.collection === setMeta.collection);
        if (_modalIdx < 0) _modalIdx = 0;
        _renderModal(card, targetSet);
        document.getElementById('cardModal').classList.add('open');
        document.body.style.overflow = 'hidden';
      };
      el.innerHTML = `
        <div class="qcard-img">
          <img alt="${card.name}">
          <div class="qcard-placeholder">🚗<span>No Image</span></div>
          <div class="grade-badge">${card.card}</div>
        </div>
        <div class="qcard-body">
          <div class="qcard-cat" title="${setMeta.year} · ${setMeta.collection}" style="font-size:.55rem;opacity:.7;">${setMeta.year} · ${setMeta.collection}</div>
          <div class="qcard-name">${card.name}</div>
        </div>`;
      const img = el.querySelector('.qcard-img img');
      const ph  = el.querySelector('.qcard-placeholder');
      const url = imageMap[`${setMeta.year}::${setMeta.collection}::${card.card}`];
      if (url) {
        img.onload  = () => { img.classList.add('loaded'); ph.style.display = 'none'; };
        img.onerror = () => img.classList.remove('loaded');
        img.src = url;
        if (img.complete && img.naturalWidth > 0) { img.classList.add('loaded'); ph.style.display = 'none'; }
      }
      grid.appendChild(el);
    });
    content.appendChild(grid);
    return;
  }

  // No indexes at all — slow path
  await renderSlowCombinedSearch(qName, qInfo);
}

async function renderSlowCombinedSearch(qName, qInfo) {
  const content = document.getElementById('dbContent');
  const setsToSearch = Object.values(allData).filter(s => currentYear ? String(s.year) === String(currentYear) : true);
  const stubs = setsToSearch.filter(s => s._stub || !s.cards);
  if (stubs.length) {
    content.innerHTML = `<div class="empty-state"><div class="big">⏳</div><h3>Loading data…</h3><p>Fetching ${stubs.length} unloaded set${stubs.length !== 1 ? 's' : ''}</p></div>`;
    await Promise.all(stubs.map(async set => {
      try {
        const jsonText = await fetchWithRetry(set._jsonUrl).then(r => r.text());
        const jsonData = JSON.parse(jsonText);
        set.cards = jsonData.cards; set._stub = false;
        const cacheKey = Object.keys(localStorage).find(k => k.startsWith('qCache_v2_'));
        if (cacheKey) { try { const c=JSON.parse(localStorage.getItem(cacheKey)); c.data[`${set.year}::${set.collection}`]=set; localStorage.setItem(cacheKey,JSON.stringify(c)); } catch(e){} }
      } catch(e) {}
    }));
  }

  const results = [];
  setsToSearch.forEach(set => {
    if (!set.cards) return;
    set.cards.forEach(card => {
      if (qName) {
        const passesName = (card.name||'').toLowerCase().includes(qName) || (card.card||'').toLowerCase().includes(qName) || (card.category||'').toLowerCase().includes(qName);
        if (!passesName) return;
      }
      if (qInfo) {
        const info = [card.info, card.info_left, card.info_right, card.info_image].filter(Boolean).join(' ');
        if (!info.toLowerCase().includes(qInfo)) return;
      }
      results.push({ card, set });
    });
  });

  results.sort((a, b) => {
    let cmp = 0;
    if (searchSort === 'year') {
      cmp = Number(a.set.year) - Number(b.set.year);
      if (cmp === 0) cmp = (a.card.name||'').localeCompare(b.card.name||'');
    } else {
      cmp = (a.card.name||'').localeCompare(b.card.name||'');
    }
    return searchSortRev ? -cmp : cmp;
  });

  content.innerHTML = '';
  const termLabel = [qName && `name "${qName}"`, qInfo && `info "${qInfo}"`].filter(Boolean).join(' + ');
  if (!results.length) {
    const scope = currentYear ? `in ${currentYear}` : 'across all sets';
    content.innerHTML = `<div class="empty-state"><div class="big">🔍</div><h3>No results</h3><p>No cards matching ${termLabel} found ${scope}</p></div>`;
    return;
  }

  const scope = currentYear ? `in ${currentYear}` : 'in all sets';
  const header = document.createElement('div');
  header.style.cssText = 'padding:12px 20px 4px;font-family:var(--font-ui);font-size:.72rem;letter-spacing:.1em;color:var(--text-dim);';
  header.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for ${termLabel} ${scope}`;
  content.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'search-results-grid';
  results.forEach(({ card, set }) => {
    const fields = deriveFields(set);
    const el = document.createElement('div');
    el.className = 'qcard';
    el.onclick = () => {
      FIELDS = fields;
      _modalCards = results.map(r => r.card);
      _modalSets  = results.map(r => r.set);
      _modalSet   = set;
      _modalIdx   = results.findIndex(r => r.card.card === card.card && r.set.year === set.year && r.set.collection === set.collection);
      if (_modalIdx < 0) _modalIdx = 0;
      _renderModal(card, set);
      document.getElementById('cardModal').classList.add('open');
      document.body.style.overflow = 'hidden';
      if (window._pushNav) window._pushNav('modal');
    };
    el.innerHTML = `
      <div class="qcard-img">
        <img alt="${card.name}">
        <div class="qcard-placeholder">🚗<span>No Image</span></div>
        <div class="grade-badge">${card.card}</div>
      </div>
      <div class="qcard-body">
        <div class="qcard-cat" title="${set.year} · ${set.collection}" style="font-size:.55rem;opacity:.7;">${set.year} · ${set.collection}</div>
        <div class="qcard-name">${card.name}</div>
      </div>`;
    const img = el.querySelector('.qcard-img img');
    const ph  = el.querySelector('.qcard-placeholder');
    loadImgForGrade(img, card.card, ph, set);
    grid.appendChild(el);
  });
  content.appendChild(grid);
}

async function renderGlobalSearch(term) {
  return renderCombinedSearch(term, null);
}

async function renderGlobalInfoSearch(term) {
  return renderCombinedSearch(null, term);
}

// ── INFO SEARCH ───────────────────────────────────────────
let infoSearchTerm = '';

function handleInfoSearch(val) {
  infoSearchTerm = val;
  const trimmedInfo = val.trim();
  const trimmedName = searchTerm.trim();

  if (!trimmedInfo && !trimmedName) {
    if (_lastCountryResults) {
      renderCountryResults(_lastCountryResults.iso, _lastCountryResults.name, _lastCountryResults.results);
    } else if (currentColl && currentYear) {
      const set = allData[`${currentYear}::${currentColl}`];
      if (set && set.cards) renderCards(set);
    } else if (currentYear) {
      renderCollections(currentYear);
    } else {
      renderYearsOverview();
    }
    return;
  }

  if (trimmedInfo.length > 0 && trimmedInfo.length < 3 && !trimmedName) return;

  renderCombinedSearch(trimmedName || null, trimmedInfo || null);
}

function setFilter(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  activeFilter = cat;
  if (currentColl && currentYear) {
    const set = allData[`${currentYear}::${currentColl}`];
    if (set) renderCards(set);
  }
}

