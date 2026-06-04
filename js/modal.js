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
  ph.innerHTML = `🚗<span>${t('noImage')}</span>`;
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
    { label: t('metaYear'),       val: set.year,       onclick: `closeModal();showSection('database');(function(){currentYear=${JSON.stringify(set.year)};currentColl=null;renderSidebar();renderCollections(${JSON.stringify(set.year)});setBC([{label:String(${JSON.stringify(set.year)}),year:${JSON.stringify(set.year)}}]);})()` },
    { label: t('metaCollection'), val: set.collection, onclick: `closeModal();showSection('database');(function(){currentYear=${JSON.stringify(set.year)};currentColl=${JSON.stringify(set.collection)};renderSidebar();var s=allData[${JSON.stringify(set.year+'::'+set.collection)}];if(s)renderCards(s);setBC([{label:String(${JSON.stringify(set.year)}),year:${JSON.stringify(set.year)}},{label:${JSON.stringify(set.collection)},setKey:${JSON.stringify(set.year+'::'+set.collection)}}]);})()` },
    ...(card.country  ? [{ label: t('metaCountry'),  val: card.country }] : []),
    ...(card.category ? [{ label: t('metaCategory'), val: card.category }] : []),
  ].map(m => {
    const cls = m.onclick ? 'meta-val meta-val--link' : 'meta-val';
    const handler = m.onclick ? `onclick="${m.onclick.replace(/"/g, '&quot;')}"` : '';
    return `<div class="meta-item"><span class="meta-label">${m.label}</span><span class="${cls}" ${handler}>${m.val}</span></div>`;
  }).join('');

  // Derive quartett group (e.g. "3B" → group "3", or "1A" → "1")
  const gradeStr = (card.card || '').trim();
  const quartettGroup = gradeStr.replace(/[A-Da-d]$/, '');
  const quartettSiblings = quartettGroup && set.cards
    ? set.cards.filter(c => c.card && c.card.replace(/[A-Da-d]$/, '') === quartettGroup)
        .sort((a, b) => (a.card || '').localeCompare(b.card || ''))
    : [];
  const showQuartettBtn = quartettSiblings.length > 1
    ? `<button class="sort-btn" id="showQuartettBtn" style="margin-top:12px;width:100%;justify-content:center;font-size:.72rem;" onclick="openQuartettView('${quartettGroup}')">${t('showQuartett')}</button>`
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

