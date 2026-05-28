// ── STATE ─────────────────────────────────────────────────
const allData = {};   // key: "year::collection" → set object
let currentYear = null;
let currentColl = null;
let activeFilter = 'all';
let searchTerm   = '';
let yearSortAsc  = false;  // false = newest first (default), true = oldest first
let searchSort   = 'name'; // 'year' or 'name' — default A-Z
let searchSortRev = false; // true = reverse of current sort

// ── FIELD DEFINITIONS ─────────────────────────────────────
// Derived dynamically from card data — see deriveFields(set)
let FIELDS = [];

// Meta keys that are never shown as stat fields
const META_KEYS = new Set(['card','category','name','country','info_right','info_left','info','info_image']);

// Unit tokens — single and multi-part suffixes at end of key
const UNIT_TOKENS_SINGLE = { ccm:'ccm', kw:'kW', ps:'PS', kmh:'km/h', kg:'kg',
                              t:'t', l:'l', m:'m', s:'s', nm:'Nm', rpm:'rpm', cv:'CV' };
// Multi-part: last N parts of key form a known unit
const UNIT_TOKENS_MULTI  = { 'km_h':'km/h', 'u_min':'U/min', 'km h':'km/h' };

function extractUnit(parts) {
  // Try last 2 parts as compound unit first (e.g. km + h → km/h)
  if (parts.length >= 2) {
    const two = parts.slice(-2).join('_').toLowerCase();
    if (UNIT_TOKENS_MULTI[two]) return { unit: UNIT_TOKENS_MULTI[two], drop: 2 };
  }
  // Try last part alone
  const one = parts[parts.length - 1].toLowerCase();
  if (UNIT_TOKENS_SINGLE[one]) return { unit: UNIT_TOKENS_SINGLE[one], drop: 1 };
  // No known unit — keep last part as unit but don't strip from label
  return { unit: one, drop: 0 };
}

// Retry fetch up to 3 times with exponential backoff — handles transient GitHub 500s
async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // Don't retry on auth/client errors
      if (res.status === 401 || res.status === 403 || res.status === 404) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch(e) { lastErr = e; }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 600 * Math.pow(2, i)));
  }
  throw lastErr;
}


function deriveFields(set) {
  if (!set || !set.cards || !set.cards.length) return [];
  const seen = new Map();
  set.cards.forEach(card => {
    Object.keys(card).forEach(k => {
      if (META_KEYS.has(k)) return;
      if (!seen.has(k)) seen.set(k, true);
    });
  });

  return Array.from(seen.keys()).map(key => {
    const stripped = key.replace(/_+$/, '');
    const parts    = stripped.split('_');
    const { unit, drop } = extractUnit(parts);
    const labelParts = drop > 0 ? parts.slice(0, -drop) : parts;
    const label = labelParts.join(' ').replace(/\b\w/g, c => c.toUpperCase());
    return { key, label, unit };
  });
}

// ── COUNTRY FLAGS ─────────────────────────────────────────
// Maps non-standard/abbreviated country codes to proper ISO 3166-1 alpha-2
// Derived from the actual country_list.json used in the data.
const CODE_TO_ISO = {
  // Single-letter
  A:'AT', B:'BE', D:'DE', E:'ES', F:'FR', H:'HU', I:'IT', J:'JP',
  L:'LU', M:'MT', N:'NO', P:'PT', Q:'QA', S:'SE',
  // Two-letter Quartett codes (not all are standard ISO)
  AG:'AG', BM:'BM', BR:'BR', BS:'BS', CH:'CH', CN:'CN', CY:'CY',
  CZ:'CZ', DK:'DK', GB:'GB', GH:'GH', GR:'GR', HK:'HK', HR:'HR',
  IL:'IL', IS:'IS', KY:'KY', LB:'LY', LT:'LT', LV:'LV', MA:'MA',
  MC:'MC', NL:'NL', NZ:'NZ', PA:'PA', PE:'PE', PK:'PK', PL:'PL',
  RC:'TW', RO:'RO', SG:'SG', SK:'SK', TN:'TN', TR:'TR', TW:'TW',
  UA:'UA', UZ:'UZ', VN:'VN', WV:'VC', ZA:'ZA',
  // Three-letter Quartett codes
  AUS:'AU', BLR:'BY', BRN:'BH', CAN:'CA', CDN:'CA', EST:'EE',
  FIN:'FI', GBZ:'GI', IND:'IN', IRL:'IE', KSA:'SA', LAO:'LA',
  MAL:'MY', MEX:'MX', MX:'MX', NAM:'NA', NZL:'NZ', RA:'AR',
  RCH:'CL', RF:'RU', RI:'ID', ROK:'KR', RP:'PH', RSM:'SM',
  RUS:'RU', SF:'FI', SGP:'SG', SLO:'SI', UAE:'AE', UKR:'UA', USA:'US',
  // Direct ISO passthroughs
  AR:'AR', AT:'AT', AE:'AE', AU:'AU', BY:'BY', CA:'CA', CL:'CL',
  CO:'CO', DE:'DE', EE:'EE', EG:'EG', ES:'ES', FI:'FI', FR:'FR',
  GI:'GI', ID:'ID', IE:'IE', IN:'IN', JP:'JP', KR:'KR', LY:'LY',
  MX:'MX', MY:'MY', NO:'NO', PH:'PH', PT:'PT', QA:'QA', RU:'RU',
  SA:'SA', SE:'SE', SI:'SI', SM:'SM', TH:'TH', US:'US', UY:'UY',
  VC:'VC', VE:'VE',
  // Legacy / alternate
  DDR:'DE', EU:'DE', BG:'BG', MT:'MT', HU:'HU', LU:'LU',
};

function isoToFlag(iso2) {
  // Convert 2-letter ISO code to emoji flag via Unicode regional indicators
  if (!iso2 || iso2.length !== 2) return '';
  const base = 0x1F1E6 - 65; // 'A'.charCodeAt(0) = 65
  return String.fromCodePoint(base + iso2.toUpperCase().charCodeAt(0))
       + String.fromCodePoint(base + iso2.toUpperCase().charCodeAt(1));
}

function flag(code) {
  if (!code) return '';
  const upper = code.toUpperCase().split(/[\/,\+]/)[0].trim(); // use first part of combined codes
  const iso = CODE_TO_ISO[upper] || QUARTETT_CODE_TO_ISO[upper] || null;
  const emoji = iso ? isoToFlag(iso) : '';
  return emoji ? emoji + ' ' + code : code;
}

