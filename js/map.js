// ── COUNTRY MAP ───────────────────────────────────────────────────────────────

let _lastCountryResults = null; // { iso, name, results } — for re-sorting
let _cmapTappedIso     = null; // mobile: first tap tracks this ISO
let _cmapCountryList = null;   // raw [{Code, Country}] from country_list.json
let _cmapTopoReady   = false;
let _cmapCardCounts  = {};     // ISO-alpha2 → card count (computed once)
let _cmapIsoToNames  = {};     // ISO-alpha2 → display country name
let _cmapSelectedIso = null;
window._getCmapSelectedIso = () => _cmapSelectedIso;
let _cmapSelectedCards = [];
let _cmapGeoLoaded   = false;
let _cmapD3Loaded    = false;
let _cmapZoom        = null;

// Map from Quartett codes → ISO 3166-1 alpha-2
// Extended from existing CODE_TO_ISO + country_list names
// Maps every Quartett country code → ISO 3166-1 alpha-2
// Built from the actual country_list.json codes used in the data.
// Combined/slash codes (e.g. "CDN/D") are resolved by resolveQuartettCode() below.
const QUARTETT_CODE_TO_ISO = {
  // Single-letter European
  A:'AT', B:'BE', D:'DE', E:'ES', F:'FR', H:'HU', I:'IT', J:'JP',
  L:'LU', M:'MT', N:'NO', P:'PT', S:'SE',
  // Two-letter (Quartett style, not always ISO)
  AG:'AG', BM:'BM', BR:'BR', BS:'BS', CH:'CH', CN:'CN', CY:'CY',
  CZ:'CZ', DK:'DK', GB:'GB', GH:'GH', GR:'GR', HK:'HK', HR:'HR',
  IL:'IL', IS:'IS', KY:'KY', LB:'LY', LT:'LT', LV:'LV', MA:'MA',
  MC:'MC', NL:'NL', NZ:'NZ', PA:'PA', PE:'PE', PK:'PK', PL:'PL',
  Q:'QA',  RC:'TW', RO:'RO', SG:'SG', SK:'SK', TN:'TN', TR:'TR',
  TW:'TW', UA:'UA', UZ:'UZ', VN:'VN', WV:'VC', ZA:'ZA',
  // Three-letter Quartett codes
  AUS:'AU', BLR:'BY', BRN:'BH', CAN:'CA', CDN:'CA', EST:'EE',
  FIN:'FI', GBZ:'GI', IND:'IN', KSA:'SA', LAO:'LA', MAL:'MY',
  NAM:'NA', NZL:'NZ', RA:'AR',  RC:'TW', RCH:'CL', RF:'RU',
  RI:'ID',  ROK:'KR', RP:'PH',  RSM:'SM', RUS:'RU', SLO:'SI',
  SGP:'SG', UAE:'AE', UKR:'UA', USA:'US',
  // Direct ISO passthroughs (already alpha-2)
  AR:'AR', AT:'AT', AE:'AE', AU:'AU', BY:'BY', CA:'CA', CL:'CL',
  CO:'CO', DE:'DE', EE:'EE', EG:'EG', ES:'ES', FI:'FI', FR:'FR',
  GI:'GI', ID:'ID', IE:'IE', IN:'IN', IR:'IR', IQ:'IQ', JO:'JO',
  JP:'JP', KR:'KR', KW:'KW', LY:'LY', MX:'MX', MY:'MY', OM:'OM',
  PH:'PH', PT:'PT', QA:'QA', RU:'RU', SA:'SA', SE:'SE', SI:'SI',
  SM:'SM', TH:'TH', US:'US', UY:'UY', VC:'VC', VE:'VE',
  // Extras
  DDR:'DE', EU:'EU', IRL:'IE', SF:'FI', HU:'HU', LU:'LU', MT:'MT',
  NO:'NO', PL:'PL', RO:'RO', SK:'SK', TR:'TR', UA:'UA', ZA:'ZA',
};

// ISO numeric → alpha-2 (subset covering cars)
const ISO_NUMERIC_TO_ALPHA2 = {
  '276':'DE','826':'GB','250':'FR','724':'ES','380':'IT','528':'NL',
  '752':'SE','578':'NO','246':'FI','756':'CH','040':'AT','056':'BE',
  '616':'PL','203':'CZ','703':'SK','191':'HR','300':'GR','620':'PT',
  '208':'DK','348':'HU','642':'RO','100':'BG','804':'UA','112':'BY',
  '440':'LT','428':'LV','233':'EE','792':'TR','372':'IE','442':'LU',
  '392':'JP','036':'AU','124':'CA','840':'US','076':'BR','032':'AR',
  '152':'CL','156':'CN','356':'IN','410':'KR','710':'ZA','376':'IL',
  '484':'MX','158':'TW','643':'RU','858':'UY','170':'CO',
  '068':'BO','591':'PA','218':'EC','604':'PE','862':'VE','492':'MC',
  '566':'NG','818':'EG','504':'MA','012':'DZ','764':'TH',
  '360':'ID','458':'MY','608':'PH','702':'SG','682':'SA',
  '784':'AE','364':'IR','368':'IQ','422':'LB','400':'JO','512':'OM',
  '634':'QA','048':'BH','414':'KW','860':'UZ','704':'VN','586':'PK',
  '050':'BD','404':'KE','800':'UG','834':'TZ','716':'ZW',
  '508':'MZ','024':'AO','180':'CD','288':'GH','384':'CI',
  '788':'TN','434':'LY','706':'SO','231':'ET','729':'SD',
  '120':'CM','072':'BW','516':'NA','646':'RW','108':'BI',
  '554':'NZ','076':'BR',
  // Countries from Quartett country_list.json not previously mapped
  '705':'SI',  // Slovenia (SLO)
  '196':'CY',  // Cyprus (CY)
  '470':'MT',  // Malta (M)
  '352':'IS',  // Iceland (IS)
  '634':'QA',  // Qatar (Q)
  '096':'BN',  // Brunei
  '682':'SA',  // Saudi Arabia (KSA)
  '458':'MY',  // Malaysia (MAL)
  '608':'PH',  // Philippines (RP)
  '674':'SM',  // San Marino (RSM)
  '418':'LA',  // Laos (LAO)
  '516':'NA',  // Namibia (NAM)
  '308':'GD',  // Grenada
  '780':'TT',  // Trinidad
  '388':'JM',  // Jamaica
  '060':'BM',  // Bermuda (BM)
  '136':'KY',  // Cayman Islands (KY)
  '630':'PR',  // Puerto Rico
  '275':'PS',  // Palestine
  '275':'PS',
  '792':'TR',  // Turkey (TR)
  '348':'HU',  // Hungary (H)
  '528':'NL',  // Netherlands (NL)
  '191':'HR',  // Croatia (HR)
  '703':'SK',  // Slovakia (SK)
  '616':'PL',  // Poland (PL)
  '642':'RO',  // Romania (RO)
  '300':'GR',  // Greece (GR)
  '756':'CH',  // Switzerland (CH)
  '056':'BE',  // Belgium (B)
  '442':'LU',  // Luxembourg (L)
  '040':'AT',  // Austria (A)
  '208':'DK',  // Denmark (DK)
  '752':'SE',  // Sweden (S)
  '246':'FI',  // Finland (FIN/SF)
  '578':'NO',  // Norway (N)
  '372':'IE',  // Ireland (IRL)
  '724':'ES',  // Spain (E)
  '620':'PT',  // Portugal (P)
  '484':'MX',  // Mexico (MEX)
  '032':'AR',  // Argentina (RA)
  '076':'BR',  // Brazil (BR)
  '152':'CL',  // Chile (RCH)
  '604':'PE',  // Peru (PE)
  '591':'PA',  // Panama (PA)
  '170':'CO',  // Colombia
  '764':'TH',  // Thailand
  '360':'ID',  // Indonesia (RI)
  '410':'KR',  // South Korea (ROK)
  '710':'ZA',  // South Africa (ZA)
  '516':'NA',  // Namibia (NAM)
  '288':'GH',  // Ghana (GH)
  '504':'MA',  // Morocco (MA)
  '788':'TN',  // Tunisia (TN)
  '818':'EG',  // Egypt (ET)
  '702':'SG',  // Singapore (SG/SGP)
  '458':'MY',  // Malaysia (MAL)
  '704':'VN',  // Vietnam (VN)
  '860':'UZ',  // Uzbekistan (UZ)
  '784':'AE',  // UAE
  '682':'SA',  // Saudi Arabia (KSA)
  '634':'QA',  // Qatar (Q)
  '048':'BH',  // Bahrain (BRN)
  '376':'IL',  // Israel (IL)
  '356':'IN',  // India (IND)
  '156':'CN',  // China (CN/RC)
  '158':'TW',  // Taiwan (RC/TW)
  '392':'JP',  // Japan (J)
  '036':'AU',  // Australia (AUS)
  '124':'CA',  // Canada (CDN/CAN)
  '840':'US',  // USA
  '643':'RU',  // Russia (RF/RUS)
  '804':'UA',  // Ukraine (UA/UKR)
  '112':'BY',  // Belarus (BLR)
  '440':'LT',  // Lithuania (LT)
  '428':'LV',  // Latvia (LV)
  '233':'EE',  // Estonia (EST)
  '792':'TR',  // Turkey (TR)
  '100':'BG',  // Bulgaria
  '492':'MC',  // Monaco (MC)
  '191':'HR',  // Croatia (HR)
  '705':'SI',  // Slovenia (SLO)
  '196':'CY',  // Cyprus (CY)
  '470':'MT',  // Malta (M)
  '352':'IS',  // Iceland (IS)
  '554':'NZ',  // New Zealand (NZ/NZL)
  '716':'ZW',  // Zimbabwe
  '276':'DE',  // Germany (D)
  '826':'GB',  // Great Britain (GB)
  '380':'IT',  // Italy (I)
  '250':'FR',  // France (F)
};

function resolveQuartettCode(code) {
  if (!code) return null;
  // Handle combined codes like "CDN/D" or "D/F" → resolve each part, return first match
  const parts = code.split(/[\/,\+]/);
  for (const part of parts) {
    const trimmed = part.trim().toUpperCase();
    if (!trimmed) continue;
    const iso = QUARTETT_CODE_TO_ISO[trimmed];
    if (iso) return iso;
  }
  return null;
}

function buildCardCountsFromData() {
  _cmapCardCounts = {};
  // Primary: use cardNamesIndex (grouped_cards_extended.json) — loaded upfront, has all cards
  if (cardNamesIndex && cardNamesIndex.length) {
    cardNamesIndex.forEach(entry => {
      (entry.cards || []).forEach(card => {
        // country may be at card level or inherited from entry level
        const countryCode = card.country || entry.country;
        if (!countryCode) return;
        const iso = resolveQuartettCode(countryCode);
        if (!iso) return;
        _cmapCardCounts[iso] = (_cmapCardCounts[iso] || 0) + 1;
      });
    });
    return;
  }
  // Fallback: scan already-loaded set data (only works if sets were opened)
  Object.values(allData).forEach(set => {
    if (!set.cards) return;
    set.cards.forEach(card => {
      if (!card.country) return;
      const iso = resolveQuartettCode(card.country);
      if (!iso) return;
      _cmapCardCounts[iso] = (_cmapCardCounts[iso] || 0) + 1;
    });
  });
}

function buildIsoNamesFromCountryList(list) {
  if (!list) return;
  // For each entry in country_list.json: register the code in QUARTETT_CODE_TO_ISO
  // (in case it's new / not yet hardcoded), then populate _cmapIsoToNames for display.
  list.forEach(({ Code, Country }) => {
    if (!Code || !Country) return;
    const upper = Code.toUpperCase().trim();
    // Resolve via existing mapping first; for unknown codes try to derive ISO from
    // standard 2-letter codes, then fall back to registering via known country names.
    let iso = QUARTETT_CODE_TO_ISO[upper];
    // If still unknown: for 2-letter codes assume they are ISO alpha-2 directly
    if (!iso && /^[A-Z]{2}$/.test(upper)) iso = upper;
    if (iso) {
      // Register the code → ISO mapping for future resolveQuartettCode calls
      if (!QUARTETT_CODE_TO_ISO[upper]) QUARTETT_CODE_TO_ISO[upper] = iso;
      // Use the country_list display name (prefer longer/more specific name if already set)
      if (!_cmapIsoToNames[iso] || _cmapIsoToNames[iso].length < Country.length) {
        _cmapIsoToNames[iso] = Country;
      }
    }
  });
}

async function loadCountryListJson() {
  if (_cmapCountryList) return _cmapCountryList;
  // Derive raw URL from the current repo URL
  const input = document.getElementById('githubRepoUrl')?.value?.trim() || '';
  const match = input.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)(?:\/(.*))?/);
  if (!match) return null;
  const [, user, repo, branch, basePath] = match;
  const rootPath = (basePath || '').replace(/\/$/, '');
  const filePathInRepo = rootPath ? `${rootPath}/country_list.json` : 'country_list.json';
  const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePathInRepo}`;
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) return null;
    _cmapCountryList = await res.json();
    return _cmapCountryList;
  } catch(e) { return null; }
}

async function openCountryMap() {
  const modal = document.getElementById('countryMapModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Load country list JSON (enriches code mapping)
  const countryList = await loadCountryListJson();
  if (countryList) buildIsoNamesFromCountryList(countryList);

  // Build counts from currently loaded card data
  buildCardCountsFromData();
  // Update subtitle with stats
  const sub = document.getElementById('cmap-subtitle');
  if (sub) {
    const total = Object.values(_cmapCardCounts).reduce((a,b)=>a+b,0);
    sub.textContent = `${Object.keys(_cmapCardCounts).length} ${t('byCountry').toLowerCase()} · ${total} ${t('cardsWord')}`;
  }

  // Load D3 + TopoJSON + render map
  await loadAndRenderMap();
}

function closeCountryMap() {
  document.getElementById('countryMapModal').style.display = 'none';
  document.body.style.overflow = '';
  _cmapSelectedIso = null;
}

async function selectCountry(iso) {
  _cmapSelectedIso = iso;
  // Sync URL immediately — _cmapSelectedIso is now set so encodeState can read it
  if (typeof window._routerSync === 'function') window._routerSync();
  closeCountryMap();
  const name = (iso && (_cmapIsoToNames[iso] || iso)) || '?';

  showSection('database');
  const content = document.getElementById('dbContent');
  content.innerHTML = `<div class="empty-state"><div class="big">${isoToFlag(iso)}</div><h3>${t('loadingCountry', { name })}</h3></div>`;
  setToolbarMode('sets');

  // Collect matching entries from cardNamesIndex (always available)
  const hits = [];
  if (cardNamesIndex && cardNamesIndex.length) {
    cardNamesIndex.forEach(entry => {
      (entry.cards || []).forEach(card => {
        const countryCode = card.country || entry.country;
        if (!countryCode) return;
        if (resolveQuartettCode(countryCode) !== iso) return;
        const cardWithCountry = card.country ? card : Object.assign({}, card, { country: entry.country });
        hits.push({ card: cardWithCountry, setMeta: entry });
      });
    });
  }

  if (!hits.length) {
    content.innerHTML = `<div class="empty-state"><div class="big">${isoToFlag(iso)}</div><h3>${name}</h3><p>${t('noCardsForCountry')}</p></div>`;
    return;
  }

  // Lazy-load any stubs that contain matching cards
  const neededKeys = [...new Set(hits.map(h => `${h.setMeta.year}::${h.setMeta.collection}`))];
  const stubs = neededKeys.filter(k => { const s = allData[k]; return !s || s._stub || !s.cards; });

  if (stubs.length) {
    content.innerHTML = `<div class="empty-state"><div class="big">${isoToFlag(iso)}</div><h3>${t('loadingData')}</h3></div>`;
    await Promise.all(stubs.map(async key => {
      const s = allData[key];
      if (!s || !s._jsonUrl) return;
      try {
        const text = await fetchWithRetry(s._jsonUrl).then(r => r.text());
        const json = JSON.parse(text);
        s.cards = json.cards; s._stub = false;
      } catch(e) {}
    }));
  }

  const results = hits.map(({ card: indexCard, setMeta }) => {
    const set = allData[`${setMeta.year}::${setMeta.collection}`];
    let fullCard = indexCard;
    if (set && set.cards) {
      const found = set.cards.find(c =>
        c.card === indexCard.card ||
        (c.card || '').toUpperCase() === (indexCard.card || '').toUpperCase()
      );
      if (found) fullCard = Object.assign({}, found, { country: indexCard.country || found.country });
    }
    return { card: fullCard, set: set || { year: setMeta.year, collection: setMeta.collection } };
  });

  renderCountryResults(iso, name, results);
  setBC([{ label: `${isoToFlag(iso)} ${name}` }]);
  // Sync URL here (not via wrapper) so ALL call sites — including internal ones — update the hash
  if (typeof window._routerSync === 'function') setTimeout(window._routerSync, 150);
}

// Mobile two-tap: first tap shows name label, second tap opens cards
function cmapHandleTap(iso) {
  const name  = _cmapIsoToNames[iso] || iso;
  const count = _cmapCardCounts[iso] || 0;
  const label = document.getElementById('cmap-tap-label');
  if (_cmapTappedIso === iso) {
    // Second tap on same country → go to cards
    if (label) label.style.display = 'none';
    _cmapTappedIso = null;
    selectCountry(iso);
  } else {
    // First tap → show label, highlight
    _cmapTappedIso = iso;
    if (label) {
      label.style.display = 'block';
      label.innerHTML = `${isoToFlag(iso)} <strong>${name}</strong> · ${count} ${t('cardsWord')}<span style="display:block;font-size:.68rem;opacity:.6;margin-top:2px;">${t('tapAgainBrowse')}</span>`;
      // Auto-hide after 3s if no second tap
      clearTimeout(label._hideTimer);
      label._hideTimer = setTimeout(() => {
        label.style.display = 'none';
        _cmapTappedIso = null;
        // Reset highlight to cyan
        document.querySelectorAll('#cmap-svg path.cmap-country').forEach(p => {
          if (p.dataset.hasCards === '1') p.style.fill = 'rgba(0,229,255,0.55)';
        });
      }, 3000);
    }
    // Highlight tapped country
    document.querySelectorAll('#cmap-svg path.cmap-country').forEach(p => {
      if (p.dataset.iso === iso) p.style.fill = 'var(--accent-blue)';
      else if (p.dataset.hasCards === '1') p.style.fill = 'rgba(0,229,255,0.55)';
    });
  }
}


function renderCountryResults(iso, countryName, results) {
  // Store for re-sorting via sortByYear / sortByName buttons
  _lastCountryResults = { iso, name: countryName, results };

  // Apply current sort
  results = [...results].sort((a, b) => {
    let cmp = 0;
    if (searchSort === 'year') {
      cmp = Number((a.set||{}).year||0) - Number((b.set||{}).year||0);
      if (cmp === 0) cmp = (a.card.name||'').localeCompare(b.card.name||'');
    } else {
      cmp = (a.card.name||'').localeCompare(b.card.name||'');
    }
    return searchSortRev ? -cmp : cmp;
  });

  const content = document.getElementById('dbContent');
  content.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'padding:12px 20px 4px;font-family:var(--font-ui);font-size:.78rem;letter-spacing:.1em;color:var(--text-dim);display:flex;align-items:center;gap:10px;';
  header.innerHTML = `<span style="font-size:1.4rem">${isoToFlag(iso)}</span><span style="color:var(--accent-cyan);font-weight:700">${countryName}</span><span>${_lastCountryResults.results.length} card${_lastCountryResults.results.length!==1?'s':''} across ${new Set(_lastCountryResults.results.map(r=>`${r.set.year}::${r.set.collection}`)).size} set${new Set(_lastCountryResults.results.map(r=>`${r.set.year}::${r.set.collection}`)).size!==1?'s':''}</span>`;
  content.appendChild(header);

  const isMob = window.innerWidth <= 680;
  const grid = document.createElement('div');
  grid.className = 'search-results-grid';

  results.forEach(({ card, set }, idx) => {
    const el = document.createElement('div');
    el.className = 'qcard';
    el.onclick = () => {
      FIELDS = deriveFields(set);
      _modalCards = results.map(r => r.card);
      _modalSets  = results.map(r => r.set);
      _modalSet   = set;
      _modalIdx   = idx;
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
        <div class="qcard-cat" style="font-size:.55rem;opacity:.7;">${set.year} · ${set.collection}</div>
        <div class="qcard-name">${card.name}</div>
      </div>`;
    const img = el.querySelector('.qcard-img img');
    const ph  = el.querySelector('.qcard-placeholder');
    loadImgForGrade(img, card.card, ph, set);
    grid.appendChild(el);
  });
  content.appendChild(grid);

  // Breadcrumb
  setBC([{ label: `${isoToFlag(iso)} ${countryName}` }]);
}

async function loadAndRenderMap() {
  const svg = document.getElementById('cmap-svg');
  const loading = document.getElementById('cmap-loading');
  svg.innerHTML = '';

  // Load D3 and topojson from CDN if not yet loaded
  if (!window.d3) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  if (!window.topojson) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // Fetch world TopoJSON
  let world;
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    world = await res.json();
  } catch(e) {
    loading.textContent = t('failedLoadMap');
    return;
  }

  loading.style.display = 'none';

  const wrap = document.getElementById('cmap-map-wrap');
  const W = wrap.clientWidth || 800;
  const H = wrap.clientHeight || 420;

  const svgEl = d3.select('#cmap-svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const projection = d3.geoNaturalEarth1()
    .scale(W / 6.2)
    .translate([W / 2, H / 2]);

  const path = d3.geoPath().projection(projection);

  const countries = topojson.feature(world, world.objects.countries);

  const g = svgEl.append('g');

  // Build numeric → alpha2 lookup
  const numToAlpha2 = ISO_NUMERIC_TO_ALPHA2;

  // Sphere (ocean) background
  g.append('path')
    .datum({ type: 'Sphere' })
    .attr('d', path)
    .attr('fill', '#0d0f1c')
    .attr('stroke', 'none');

  // Graticules
  g.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(90,110,200,0.08)')
    .attr('stroke-width', '0.5');

  const tooltip = document.getElementById('cmap-tooltip');

  // Draw countries
  g.selectAll('path.cmap-country')
    .data(countries.features)
    .enter().append('path')
    .attr('class', 'cmap-country')
    .attr('d', path)
    .each(function(d) {
      const numId = String(d.id).padStart(3, '0');
      const iso   = numToAlpha2[numId] || numToAlpha2[String(d.id)] || null;
      const hasCards = iso && _cmapCardCounts[iso] > 0;
      this.dataset.iso = iso || '';
      this.dataset.hasCards = hasCards ? '1' : '0';
      this.dataset.numId = numId;
    })
    .attr('fill', function() {
      if (this.dataset.hasCards === '1') return 'rgba(0,229,255,0.55)';
      return 'rgba(30,36,70,0.9)';
    })
    .attr('stroke', 'rgba(0,0,0,0.7)')
    .attr('stroke-width', '0.5')
    .style('cursor', function() { return this.dataset.hasCards === '1' ? 'pointer' : 'default'; })
    .style('transition', 'fill .15s')
    .on('mousemove', function(event, d) {
      const iso = this.dataset.iso;
      if (!iso) return;
      const name = _cmapIsoToNames[iso] || iso;
      const count = _cmapCardCounts[iso];
      if (!count) return;
      tooltip.style.display = 'block';
      const rect = wrap.getBoundingClientRect();
      tooltip.style.left = (event.clientX - rect.left + 12) + 'px';
      tooltip.style.top  = (event.clientY - rect.top  - 10) + 'px';
      tooltip.innerHTML  = `${isoToFlag(iso)} <strong>${name}</strong> · ${count} card${count!==1?'s':''}`;
    })
    .on('mouseleave', function() {
      tooltip.style.display = 'none';
      if (this.dataset.hasCards === '1' && this.dataset.iso !== _cmapSelectedIso) {
        this.style.fill = 'rgba(0,229,255,0.55)';
      }
    })
    .on('mouseover', function() {
      if (this.dataset.hasCards === '1') this.style.fill = 'var(--accent-blue)';
    })
    .on('click', function(event) {
      const iso = this.dataset.iso;
      if (!iso || this.dataset.hasCards !== '1') return;
      // On touch devices use the two-tap flow; on desktop go straight to cards
      if (event.pointerType === 'touch' || window.matchMedia('(hover:none)').matches) {
        cmapHandleTap(iso);
      } else {
        selectCountry(iso);
      }
    })
    .on('touchstart', function(event) {
      // Handled via click event above (touchstart fires before click)
      // We just prevent the tooltip from lingering
      tooltip.style.display = 'none';
    }, { passive: true });

  // ── SMALL COUNTRY DOTS ──────────────────────────────────
  // Countries too small to appear in 110m TopoJSON get a clickable dot marker.
  // Coordinates are [longitude, latitude] (geographic).
  const SMALL_COUNTRY_COORDS = {
    'AG': [-61.8,  17.1],  // Antigua and Barbuda
    'BS': [-77.4,  25.0],  // Bahamas
    'BH': [ 50.6,  26.0],  // Bahrain
    'BM': [-64.7,  32.3],  // Bermuda
    'BN': [114.7,   4.9],  // Brunei
    'CY': [ 33.4,  35.1],  // Cyprus
    'GI': [ -5.4,  36.1],  // Gibraltar
    'HK': [114.1,  22.3],  // Hong Kong
    'IS': [-18.5,  65.0],  // Iceland
    'KW': [ 47.7,  29.4],  // Kuwait
    'KY': [-81.2,  19.3],  // Cayman Islands
    'LI': [  9.5,  47.2],  // Liechtenstein
    'LU': [  6.1,  49.8],  // Luxembourg
    'MC': [  7.4,  43.7],  // Monaco
    'MT': [ 14.4,  35.9],  // Malta
    'MU': [ 57.6, -20.3],  // Mauritius
    'MV': [ 73.5,   3.2],  // Maldives
    'PA': [-80.0,   8.5],  // Panama
    'QA': [ 51.2,  25.3],  // Qatar
    'SC': [ 55.5,  -4.6],  // Seychelles
    'SG': [103.8,   1.3],  // Singapore
    'SM': [ 12.4,  43.9],  // San Marino
    'TW': [121.0,  23.7],  // Taiwan
    'VC': [-61.2,  13.3],  // St Vincent & Grenadines
    'BM': [-64.7,  32.3],  // Bermuda
  };

  // Find which ISOs with cards have no rendered polygon (path length == 0 or tiny)
  const renderedIsos = new Set();
  g.selectAll('path.cmap-country').each(function() {
    if (this.dataset.iso && this.getTotalLength && this.getTotalLength() > 5) {
      renderedIsos.add(this.dataset.iso);
    }
  });

  // Also always show dots for known tiny territories regardless of render status
  const alwaysDot = new Set(['AG','BH','BM','CY','GI','HK','IS','KW','KY','LI','LU','MC','MT','MU','PA','QA','SG','SM','TW','VC','BS','BN','SC','MV']);

  const dotGroup = g.append('g').attr('class', 'cmap-dots');

  Object.entries(SMALL_COUNTRY_COORDS).forEach(([iso, [lon, lat]]) => {
    const count = _cmapCardCounts[iso];
    if (!count) return; // only show if there are cards
    const [px, py] = projection([lon, lat]);
    if (!px || !py || isNaN(px) || isNaN(py)) return;

    const name = _cmapIsoToNames[iso] || iso;

    // Outer glow ring
    dotGroup.append('circle')
      .attr('class', 'cmap-dot-outer')
      .attr('cx', px).attr('cy', py)
      .attr('r', 7)
      .attr('fill', 'rgba(0,229,255,0.18)')
      .attr('stroke', 'rgba(0,229,255,0.5)')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none');

    // Solid dot
    const dot = dotGroup.append('circle')
      .attr('class', 'cmap-dot-inner')
      .attr('cx', px).attr('cy', py)
      .attr('r', 4.5)
      .attr('fill', 'rgba(0,229,255,0.85)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .style('transition', 'fill .15s');

    dot
      .on('mouseover', function(event) {
        const k = _cmapZoom ? (d3.zoomTransform(svgEl.node()).k || 1) : 1;
        d3.select(this).attr('fill', 'var(--accent-blue)').attr('r', 6 / k);
        tooltip.style.display = 'block';
      })
      .on('mousemove', function(event) {
        const rect = wrap.getBoundingClientRect();
        tooltip.style.left = (event.clientX - rect.left + 14) + 'px';
        tooltip.style.top  = (event.clientY - rect.top  - 12) + 'px';
        tooltip.innerHTML  = `${isoToFlag(iso)} <strong>${name}</strong> · ${count} card${count!==1?'s':''}`;
      })
      .on('mouseleave', function() {
        const k = _cmapZoom ? (d3.zoomTransform(svgEl.node()).k || 1) : 1;
        d3.select(this).attr('fill', 'rgba(0,229,255,0.85)').attr('r', 4.5 / k);
        tooltip.style.display = 'none';
      })
      .on('click', function(event) {
        if (event.pointerType === 'touch' || window.matchMedia('(hover:none)').matches) {
          cmapHandleTap(iso);
        } else {
          selectCountry(iso);
        }
      });
  });

  // Zoom + pan — counter-scale dots so they stay constant visual size
  const zoom = d3.zoom()
    .scaleExtent([1, 12])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      const k = event.transform.k;
      // Counter-scale dot radii & strokes so they stay visually constant
      g.selectAll('.cmap-dot-outer').attr('r', 7 / k).attr('stroke-width', 1 / k);
      g.selectAll('.cmap-dot-inner').attr('r', 4.5 / k).attr('stroke-width', 1 / k);
      // Also thin country borders as we zoom in
      g.selectAll('path.cmap-country').attr('stroke-width', Math.max(0.3, 0.5 / k)).attr('stroke', 'rgba(0,0,0,0.7)');
    });
  svgEl.call(zoom);
  _cmapZoom = zoom;

  // Double-click to reset zoom
  svgEl.on('dblclick.zoom', null);
  svgEl.on('dblclick', () => svgEl.transition().duration(400).call(zoom.transform, d3.zoomIdentity));
}
