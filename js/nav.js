// ── NAV ───────────────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const section = document.getElementById(id);
  const navLink = document.getElementById('nav-' + id);

  if (section) section.classList.add('active');
  if (navLink) navLink.classList.add('active');

  if (id === 'database') {
    if (!Object.keys(allData).length) {
      renderEmpty();
    } else {
      renderSidebar();
      if (currentYear && currentColl) {
        const set = allData[`${currentYear}::${currentColl}`];
        if (set) renderCards(set);
      } else if (currentYear) {
        renderCollections(currentYear);
      } else {
        renderYearsOverview();
      }
    }
  }

  if (id === 'play') {
    if (typeof cleanupGame === 'function') cleanupGame();
    if (typeof showPlayPicker === 'function') showPlayPicker();
  }
}

// ── HOME STATS ────────────────────────────────────────────
function countUp(id, target, duration) {
  const el = document.getElementById(id);
  if (!el || target === 0) return;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(tick);
}

function cardCount(set) {
  return set.cards ? set.cards.length : (set._cardCount || 0);
}

function updateHomeStats() {
  const keys  = Object.keys(allData);
  const years = new Set(keys.map(k => k.split('::')[0]));
  const total = keys.reduce((s, k) => s + cardCount(allData[k]), 0);

  if (!keys.length) {
    ['s-years', 's-sets', 's-cards'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = t('loading'); el.classList.add('loading'); }
    });
    return;
  }

  ['s-years', 's-sets', 's-cards'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('loading');
  });

  countUp('s-years', years.size, 3000);
  countUp('s-sets',  keys.length, 3000);
  countUp('s-cards', total, 3000);
}

// ── SIDEBAR ───────────────────────────────────────────────
function renderSidebar() {
  const sidebar = document.getElementById('yearSidebar');

  const labelEl = document.createElement('div');
  labelEl.className = 'sidebar-label';
  labelEl.innerHTML = `<span>${t('years')}</span>`;
  const sortBtn = document.createElement('button');
  sortBtn.className = 'sidebar-sort-btn';
  sortBtn.title = yearSortAsc ? 'Sort: oldest first — click for newest first' : 'Sort: newest first — click for oldest first';
  sortBtn.innerHTML = yearSortAsc ? '↑' : '↓';
  sortBtn.onclick = () => {
    yearSortAsc = !yearSortAsc;
    renderSidebar();
    if (!currentColl) {
      if (currentYear) renderCollections(currentYear);
      else renderYearsOverview();
    }
  };
  const mobYearBtn = document.getElementById('yearSortMobileBtn');
  if (mobYearBtn) mobYearBtn.textContent = yearSortAsc ? `${t('years')} ↑` : `${t('years')} ↓`;
  labelEl.appendChild(sortBtn);
  sidebar.innerHTML = '';
  sidebar.appendChild(labelEl);

  const byYear = {};
  Object.values(allData).forEach(s => { (byYear[s.year] = byYear[s.year] || []).push(s); });
  Object.keys(byYear).map(Number).sort((a, b) => yearSortAsc ? a - b : b - a).forEach(year => {
    const cols = byYear[year];
    const btn = document.createElement('button');
    btn.className = 'year-btn' + (year === currentYear ? ' active' : '');
    btn.innerHTML = `${year} <span class="badge">${cols.length}</span>`;
    btn.onclick = () => {
      if (currentYear === year) {
        clearSearch();
        currentYear = null; currentColl = null;
        renderSidebar();
        renderYearsOverview();
        setBC([]);
        if (window._pushNav) window._pushNav('db');
        return;
      }
      clearSearch();
      currentYear = year; currentColl = null;
      renderSidebar();
      renderCollections(year);
      setBC([{ label: String(year), year }]);
      if (window._pushNav) window._pushNav(String(year));
    };
    sidebar.appendChild(btn);

    const div = document.createElement('div');
    div.className = 'year-collections' + (year === currentYear ? ' open' : '');
    cols.forEach(set => {
      const cb = document.createElement('button');
      cb.className = 'coll-btn' + (currentColl === set.collection && currentYear === year ? ' active' : '');
      cb.textContent = set.collection; cb.title = set.collection;
      cb.onclick = async () => {
        clearSearch();
        currentYear = year; currentColl = set.collection;
        renderSidebar();
        if (set._stub || !set.cards) {
          const content = document.getElementById('dbContent');
          content.innerHTML = `<div class="empty-state"><div class="big">⏳</div><h3>Loading ${set.collection}…</h3></div>`;
          try {
            const jsonText = await fetchWithRetry(set._jsonUrl).then(r => r.text());
            const jsonData = JSON.parse(jsonText);
            set.cards = jsonData.cards;
            set._stub = false;
            const cacheKey = Object.keys(localStorage).find(k => k.startsWith('qCache_v2_'));
            if (cacheKey) {
              try {
                const c = JSON.parse(localStorage.getItem(cacheKey));
                c.data[`${set.year}::${set.collection}`] = set;
                localStorage.setItem(cacheKey, JSON.stringify(c));
              } catch (e) {}
            }
          } catch (e) {
            document.getElementById('dbContent').innerHTML = `<div class="empty-state"><div class="big">❌</div><h3>${t('failedToLoad')}</h3><p>${e.message}</p></div>`;
            return;
          }
        }
        renderCards(set);
        setBC([{ label: String(year), year }, { label: set.collection, setKey: `${year}::${set.collection}` }]);
        if (window._pushNav) window._pushNav(set.collection);
      };
      div.appendChild(cb);
    });
    sidebar.appendChild(div);
  });
}

// ── TITLE CARD helper ─────────────────────────────────────
function findTitleCardUrl(set) {
  if (!set) return null;
  const direct = imageMap[`${set.year}::${set.collection}::__TITLE__`];
  if (direct) return direct;
  const prefix = `${set.year}::${set.collection}::`;
  for (const [key, url] of Object.entries(imageMap)) {
    if (key.startsWith(prefix) && (key.includes('TITLECARD') || url.toLowerCase().includes('titlecard'))) return url;
  }
  return null;
}

// ── START IN DATABASE ─────────────────────────────────────
// Applied after all scripts load so showSection/renderYearsOverview are defined
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('qStartInDatabase')) {
    showSection('database');
  }
});

// ── GAME — see game.js ──────────────────────────────────
