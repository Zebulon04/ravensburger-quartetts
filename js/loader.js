// ── GITHUB REPO LOADER ────────────────────────────────────
// Strategy:
//  1. ONE api.github.com call — GET /git/trees/{sha}?recursive=1 — gets the full file tree
//  2. All JSON data fetched from raw.githubusercontent.com (no API quota used)
//  3. Image URLs built directly from raw.githubusercontent.com (no extra calls)
//  4. Full dataset cached in localStorage so reloads cost 0 API calls
//  5. GitHub API calls go through a Cloudflare Worker proxy (token stored server-side)

// Proxy worker URL — GitHub API calls are routed here instead of api.github.com directly.
// The worker holds the auth token as an encrypted env variable and forwards requests.
const GH_API_BASE = 'https://gh-proxy.andreaszlatic04.workers.dev';

const imageMap = {};
const yearImageMap = {}; // year → raw URL, from files named like "2005_year.jpg"
let cardNamesIndex = [];
let cardInfosIndex = [];
let loadedCount = 0;

const CACHE_KEY_PREFIX = 'qCache_v2_';

function clearRepoCache() {
  Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX)).forEach(k => localStorage.removeItem(k));
  alert(t('cacheCleared'));
}

async function loadEntireRepo() {
  const input = document.getElementById('githubRepoUrl').value.trim();
  if (!input) { alert('Please enter a GitHub repo URL'); return; }

  const match = input.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)(?:\/(.*))?/);
  if (!match) { alert('Invalid GitHub repo URL. Expected:\nhttps://github.com/user/repo/tree/branch'); return; }

  const [, user, repo, branch, basePath] = match;
  const rootPath = (basePath || '').replace(/\/$/, '');
  const cacheKey = `${CACHE_KEY_PREFIX}${user}_${repo}_${branch}`;

  // Clear existing data
  Object.keys(allData).forEach(k => delete allData[k]);
  Object.keys(imageMap).forEach(k => delete imageMap[k]);
  Object.keys(yearImageMap).forEach(k => delete yearImageMap[k]);
  cardNamesIndex = [];
  loadedCount = 0;
  document.getElementById('loadedTags').innerHTML = '';
  document.getElementById('loadProgress').style.display = 'block';
  document.getElementById('progressText').textContent = t('checkingCache');

  // ── Try cache first ──────────────────────────────────────
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, images, yearImages, cardNames, cardInfos, ts } = JSON.parse(cached);
      // If cache has no cardNames index, bust it so we re-fetch fresh (picks up grouped_cards_extended.json)
      if (!cardNames || !cardNames.length) {
        localStorage.removeItem(cacheKey);
        throw new Error('cache bust: no cardNames');
      }
      const ageMin = (Date.now() - ts) / 60000;
      document.getElementById('progressText').textContent = t('loadingFromCache', { age: Math.round(ageMin) });
      Object.assign(allData, data);
      Object.assign(imageMap, images);
      if (yearImages) Object.assign(yearImageMap, yearImages);
      cardNamesIndex = cardNames;
      cardInfosIndex = cardInfos || [];
      loadedCount = Object.keys(data).length;
      Object.values(data).forEach(s => addLoadedTag(s.year, s.collection));
      finishLoad();
      return;
    }
  } catch(e) { /* cache miss or parse error — fetch fresh */ }

  // ── Fetch fresh via Git Trees API (1 API call for the whole tree) ──
  try {
    document.getElementById('progressText').textContent = t('fetchingTree');

    // Step 1: resolve branch → commit SHA (via proxy — token lives server-side)
    const branchUrl = `${GH_API_BASE}/repos/${user}/${repo}/branches/${branch}`;
    const branchRes = await fetchWithRetry(branchUrl);
    if (!branchRes.ok) {
      const msg = branchRes.status === 429 ? t('rateLimited') : `${t('failedToLoad')} branch info (${branchRes.status})`;
      throw new Error(msg);
    }
    const branchData = await branchRes.json();
    const treeSha = branchData.commit.commit.tree.sha;

    // Step 2: get the full recursive tree via proxy — this is the ONLY API call needed
    const treeUrl = `${GH_API_BASE}/repos/${user}/${repo}/git/trees/${treeSha}?recursive=1`;
    const treeRes = await fetchWithRetry(treeUrl);
    if (!treeRes.ok) throw new Error(`Failed to fetch tree (${treeRes.status})`);
    const { tree } = await treeRes.json();

    // Step 3: discover all collection folders from the tree
    // A collection folder contains a .json file — we just need to know where they are
    // Structure: {rootPath}/{year}/{collection}/{something}.json

    // Build a map: "year::collection" → { jsonUrl, folder, year, collection }
    const collectionMeta = {}; // key → { jsonUrl, folder, year, collection }

    tree.forEach(f => {
      if (f.type !== 'blob') return;
      if (rootPath && !f.path.startsWith(rootPath + '/')) return;

      const rel = rootPath ? f.path.slice(rootPath.length + 1) : f.path;
      const parts = rel.split('/');
      // Expect: year / collection / file
      if (parts.length < 3) return;
      const [year, collection] = parts;
      if (!/^\d{4}$/.test(year)) return;

      const key = `${year}::${collection}`;

      if (f.path.endsWith('.json')) {
        if (!collectionMeta[key]) {
          collectionMeta[key] = {
            key, year, collection,
            jsonUrl: `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${f.path}`,
            folder: f.path.substring(0, f.path.lastIndexOf('/'))
          };
        }
      }
    });

    // Step 4: build image map from the full tree (zero extra fetches)
    const imageFiles = tree.filter(f =>
      f.type === 'blob' &&
      /\.(jpg|jpeg|png|webp)$/i.test(f.path) &&
      (!rootPath || f.path.startsWith(rootPath + '/'))
    );

    const _imgByFolder = {};
    imageFiles.forEach(f => {
      const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${f.path}`;
      const folder = f.path.substring(0, f.path.lastIndexOf('/'));
      const nameNoExt = f.path.split('/').pop().replace(/\.[^.]+$/, '');
      if (!_imgByFolder[folder]) _imgByFolder[folder] = [];
      _imgByFolder[folder].push({ name: nameNoExt, url: rawUrl });

      // Detect year cover images: named like "2005_year.jpg" at root level
      const YEAR_COVER_RE = /^(\d{4})_year$/i;
      const rel = rootPath ? (f.path.startsWith(rootPath + '/') ? f.path.slice(rootPath.length + 1) : null) : f.path;
      if (rel && !rel.includes('/')) {
        // file is directly in root folder
        const m = YEAR_COVER_RE.exec(nameNoExt);
        if (m) yearImageMap[m[1]] = rawUrl;
      }
    });

    // Register all image keys now (no JSON needed for this)
    const CARD_GRADE_RE = /^[1-9][A-D]$/i;

    Object.values(collectionMeta).forEach(({ year, collection, folder }) => {
      (_imgByFolder[folder] || []).forEach(img => {
        const nameLower = img.name.toLowerCase();
        if (nameLower.includes('titlecard')) {
          imageMap[`${year}::${collection}::__TITLE__`] = img.url;
        } else if (nameLower.endsWith('back')) {
          imageMap[`${year}::${collection}::__BACK__`] = img.url;
        } else {
          // Only map as a card image if the last 2 chars look like a grade (e.g. 1A, 8D)
          const grade = img.name.slice(-2).toUpperCase();
          if (CARD_GRADE_RE.test(grade)) {
            imageMap[`${year}::${collection}::${grade}`] = img.url;
          }
        }
      });
    });

    // Step 5: store collection stubs with image-based card count
    Object.values(collectionMeta).forEach(({ key, year, collection, jsonUrl, folder }) => {
      if (!allData[key]) {
        // Count only images whose name ends in [1-9][A-D] — genuine card images
        const imgCount = (_imgByFolder[folder] || []).filter(img => {
          if (img.name.toLowerCase().includes('titlecard')) return false;
          return /^[1-9][A-D]$/i.test(img.name.slice(-2));
        }).length;
        allData[key] = { year, collection, cards: null, _jsonUrl: jsonUrl, _stub: true, _cardCount: imgCount };
      }
    });

    loadedCount = Object.keys(collectionMeta).length;
    document.getElementById('progressText').textContent = t('collectionsDiscovered', { count: loadedCount });

    // Step 6: fetch grouped_cards_extended.json — single source for fast name + info search
    const groupedFile = tree.find(f => {
      if (f.type !== 'blob') return false;
      const rel = rootPath ? (f.path.startsWith(rootPath + '/') ? f.path.slice(rootPath.length + 1) : null) : f.path;
      if (!rel) return false;
      return rel === 'grouped_cards_extended.json';
    });
    if (groupedFile) {
      try {
        const gcUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${groupedFile.path}`;
        const gcText = await fetchWithRetry(gcUrl).then(r => r.text());
        const gcData = JSON.parse(gcText);
        // Both indexes point to the same data; searches filter by name vs info fields respectively
        cardNamesIndex = gcData;
        cardInfosIndex = gcData;
        document.getElementById('progressText').textContent = t('searchIndexLoaded', { count: loadedCount });
        console.log(`[grouped_cards_extended] Loaded ${gcData.length} entries from ${groupedFile.path}`);
      } catch(e) {
        console.warn('grouped_cards_extended.json fetch failed:', e);
        cardNamesIndex = []; cardInfosIndex = [];
      }
    } else {
      console.warn('[grouped_cards_extended] Not found in tree — search will fall back to slow path.');
      cardNamesIndex = []; cardInfosIndex = [];
    }

    // Cache image map, stubs, card names and card infos index
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data: allData, images: imageMap, yearImages: yearImageMap, cardNames: cardNamesIndex, cardInfos: cardInfosIndex, ts: Date.now() }));
    } catch(e) { console.warn('Cache write failed:', e); }

    finishLoad();

  } catch (err) {
    console.error('Error:', err);
    document.getElementById('loadProgress').style.display = 'none';
    alert('Error loading from GitHub:\n' + err.message);
  }
}

function addLoadedTag(year, collection) {
  // No-op — loaded tags removed from UI
}

function finishLoad() {
  document.getElementById('loadProgress').style.display = 'none';
  renderSidebar();
  renderYearsOverview();
  updateHomeStats();
  const cached = Object.keys(allData).length;
  document.getElementById('progressText').textContent = t('collectionsLoaded', { count: cached });
}

// Load image: uses composite key year::collection::grade
function loadImgForGrade(img, grade, placeholder, set) {
  if (!set) return;
  const imgKey = `${set.year}::${set.collection}::${grade}`;
  const url = imageMap[imgKey];
  if (!url) return;

  img.onload = () => {
    img.classList.add('loaded');
    if (placeholder) placeholder.style.display = 'none';
  };
  img.onerror = () => { img.classList.remove('loaded'); };
  img.src = url;

  // If already cached by browser, onload won't fire — check immediately
  if (img.complete && img.naturalWidth > 0) {
    img.classList.add('loaded');
    if (placeholder) placeholder.style.display = 'none';
  }
}

// ── LOAD JSON ─────────────────────────────────────────────
function loadJSON(input) {
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const sets = Array.isArray(data) ? data : [data];
        sets.forEach(set => {
          if (!set.year || !set.collection || !set.cards) return;
          allData[`${set.year}::${set.collection}`] = set;
          addLoadedTag(set.year, set.collection);
        });
        renderSidebar();
        renderYearsOverview();
        updateHomeStats();
      } catch(err) { alert('JSON parse error in ' + file.name + ':\n' + err.message); }
    };
    reader.readAsText(file);
  });
}


