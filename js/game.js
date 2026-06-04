// ── GAME ───────────────────────────────────────────────────
// Quartett Higher/Lower card game
// Public API:
//   initGame(setKey)        — start game with a specific set key
//   cleanupGame()           — called when leaving Play section
//   startGameFromPicker()   — legacy hook (no-op, picker is internal now)

// ── Attribute click zones as % of card image
const ATTR_ZONES_PCT = [
  { x1: 41, y1: 61,   x2: 92, y2: 66.5 },  // attr 1
  { x1: 41, y1: 68,   x2: 92, y2: 73.5 },  // attr 2
  { x1: 41, y1: 75.5, x2: 92, y2: 81   },  // attr 3
  { x1: 41, y1: 83,   x2: 92, y2: 88.5 },  // attr 4
  { x1: 41, y1: 90,   x2: 92, y2: 95.5 },  // attr 5
];

// ── Game state
let _gSetKey      = null;
let _gSet         = null;
let _gCards       = [];
let _gPlayerDeck  = [];
let _gAiDeck      = [];
let _gTurn        = "player";
let _gPlayerCard  = null;
let _gAiCard      = null;
let _gChosenField = null;
let _gAnimating   = false;

// ── Picker state
let _gPickerYear  = null;  // null = year overview, number = collections for that year

// ═══════════════════════════════════════════════
//  PICKER — year grid → collection grid → game
// ═══════════════════════════════════════════════

function showPlayPicker() {
  const section = document.getElementById("play");
  if (!section) return;

  // Remove any existing game board
  const board = document.getElementById("game-wrap");
  if (board) board.remove();

  let picker = document.getElementById("play-picker");
  if (!picker) {
    picker = document.createElement("div");
    picker.id = "play-picker";
    section.appendChild(picker);
  }
  picker.style.display = "";
  _gPickerYear = null;
  _renderPickerYears(picker);
}

function _renderPickerYears(picker) {
  _gPickerYear = null;
  const byYear = {};
  Object.values(allData).forEach(s => { (byYear[s.year] = byYear[s.year] || []).push(s); });
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a); // newest first

  picker.innerHTML = `
    <div class="game-picker-header">
      <div class="coming-badge">Choose a Set</div>
      <h2>PLAY</h2>
      <p>${t('pickYearFull')}</p>
    </div>
    <div class="coll-grid" id="game-year-grid"></div>`;

  const grid = picker.querySelector("#game-year-grid");

  years.forEach(year => {
    const cols = byYear[year];
    const total = cols.reduce((s, c) => s + (c.cards ? c.cards.length : (c._cardCount || 0)), 0);
    const yearImgUrl = (typeof yearImageMap !== "undefined" && yearImageMap[String(year)])
      || (typeof findTitleCardUrl === "function" ? findTitleCardUrl(cols[0]) : null);

    const el = document.createElement("div");
    el.className = "coll-card";
    el.innerHTML = `
      <div class="cimg">
        ${yearImgUrl ? `<img src="${yearImgUrl}" alt="${year}">` : `<span class="cimg-fallback">📅</span>`}
      </div>
      <div class="icon-body">
        <h3>${year}</h3>
        <p>${cols.length} set${cols.length !== 1 ? "s" : ""}</p>
        <div class="cnt">${total} cards</div>
      </div>`;
    el.onclick = () => _renderPickerCollections(picker, year, byYear[year]);
    grid.appendChild(el);
  });

  if (!years.length) {
    picker.innerHTML += `<p class="game-picker-empty">No data loaded yet — visit the Database tab first.</p>`;
  }
}

function _renderPickerCollections(picker, year, cols) {
  _gPickerYear = year;
  picker.innerHTML = `
    <div class="game-picker-header">
      <button class="game-back-btn" onclick="_renderPickerYears(document.getElementById('play-picker'))">← Back</button>
      <div class="coming-badge">${year}</div>
      <h2>Choose a Set</h2>
    </div>
    <div class="coll-grid" id="game-coll-grid"></div>`;

  const grid = picker.querySelector("#game-coll-grid");

  cols.forEach(set => {
    const titleImgUrl = typeof findTitleCardUrl === "function" ? findTitleCardUrl(set) : null;
    const count = set.cards ? set.cards.length : (set._cardCount || "?");

    const el = document.createElement("div");
    el.className = "coll-card";
    el.innerHTML = `
      <div class="cimg">
        ${titleImgUrl ? `<img src="${titleImgUrl}" alt="${set.collection}">` : `<span class="cimg-fallback">🃏</span>`}
      </div>
      <div class="icon-body">
        <h3>${set.collection}</h3>
        <p>${year}</p>
        <div class="cnt">${count} cards</div>
      </div>`;

    el.onclick = async () => {
      // Lazy-load cards exactly like database.js does
      if (set._stub || !set.cards) {
        picker.innerHTML = `
          <div class="game-picker-header">
            <div class="coming-badge">${year} › ${set.collection}</div>
            <h2>Loading…</h2>
            <p>Fetching card data, please wait.</p>
          </div>`;
        try {
          const jsonText = await fetchWithRetry(set._jsonUrl).then(r => r.text());
          const jsonData = JSON.parse(jsonText);
          set.cards = jsonData.cards;
          set._stub = false;
          // Update cache
          const cacheKey = Object.keys(localStorage).find(k => k.startsWith("qCache_v2_"));
          if (cacheKey) {
            try {
              const cached = JSON.parse(localStorage.getItem(cacheKey));
              cached.data[`${set.year}::${set.collection}`] = set;
              localStorage.setItem(cacheKey, JSON.stringify(cached));
            } catch(e) {}
          }
        } catch(e) {
          picker.innerHTML = `
            <div class="game-picker-header">
              <button class="game-back-btn" onclick="_renderPickerCollections(document.getElementById('play-picker'),${year},[])">← Back</button>
              <h2>Failed to load</h2>
              <p>${e.message}</p>
            </div>`;
          return;
        }
      }
      initGame(`${set.year}::${set.collection}`);
    };

    grid.appendChild(el);
  });
}

// ═══════════════════════════════════════════════
//  GAME INIT
// ═══════════════════════════════════════════════

function initGame(setKey) {
  _gSetKey = setKey;
  _gSet    = (typeof allData !== "undefined") ? allData[setKey] : null;

  if (!_gSet || !_gSet.cards || _gSet.cards.length === 0) {
    showPlayPicker();
    return;
  }

  // Hide picker
  const picker = document.getElementById("play-picker");
  if (picker) picker.style.display = "none";

  _gCards = [..._gSet.cards];
  _shuffle(_gCards);
  const half   = Math.floor(_gCards.length / 2);
  _gPlayerDeck = _gCards.slice(0, half);
  _gAiDeck     = _gCards.slice(half);
  _gTurn       = "player";
  _gAnimating  = false;

  _renderGameBoard();
  setTimeout(_startTurn, 400);
}

function cleanupGame() {
  const board = document.getElementById("game-wrap");
  if (board) board.remove();
  _gSetKey = _gSet = null;
  _gPlayerDeck = _gAiDeck = [];
}

// Legacy hook — picker is now internal
function startGameFromPicker() { showPlayPicker(); }
window.startGameFromPicker = startGameFromPicker;

// ═══════════════════════════════════════════════
//  GAME BOARD
// ═══════════════════════════════════════════════

function _renderGameBoard() {
  const section = document.getElementById("play");
  if (!section) return;
  const old = document.getElementById("game-wrap");
  if (old) old.remove();

  const [year, coll] = (_gSetKey || "::").split("::");
  const board = document.createElement("div");
  board.id = "game-wrap";
  board.className = "game-wrap";
  board.innerHTML = `
    <button class="game-back-btn" onclick="cleanupGame();showPlayPicker();">${t('changeSetArrow')}</button>

    <div class="game-scorebar">
      <div class="game-score-side">
        <span class="game-score-label">${t('aiLabel')}</span>
        <span class="game-score-num" id="ai-count">${_gAiDeck.length}</span>
        <span class="game-score-cards">${t('cardsLabel')}</span>
      </div>
      <div class="game-score-mid" id="game-round-msg">${t('yourTurnShort')}</div>
      <div class="game-score-side">
        <span class="game-score-label">${t('youLabel')}</span>
        <span class="game-score-num" id="player-count">${_gPlayerDeck.length}</span>
        <span class="game-score-cards">${t('cardsLabel')}</span>
      </div>
    </div>

    <div style="font-size:.72rem;opacity:.35;letter-spacing:.1em;text-transform:uppercase;">${year} &mdash; ${coll}</div>

    <div class="game-arena" id="game-arena">
      <div class="game-card-slot" id="slot-ai">
        <div class="game-card-inner">
          <div class="game-card-back" id="card-ai-back"></div>
          <div class="game-card-front" id="card-ai-front" style="display:none;width:100%;height:100%;"></div>
        </div>
      </div>
      <div class="game-vs">VS</div>
      <div class="game-card-slot" id="slot-player">
        <div class="game-card-inner">
          <div id="player-img-wrap" style="width:100%;height:100%;"></div>
        </div>
      </div>
    </div>

    <div class="game-hl-row" id="game-hl-row" style="display:none;">
      <span class="game-chosen-attr" id="game-chosen-attr"></span>
      <button class="game-btn game-btn--high" onclick="resolveRound('H')">▲ ${t('higher')}</button>
      <button class="game-btn game-btn--low"  onclick="resolveRound('L')">▼ ${t('lower')}</button>
    </div>

    <div class="game-result-overlay" id="game-result-overlay" style="display:none;">
      <div class="game-result-box" id="game-result-box"></div>
    </div>`;

  section.appendChild(board);
}

// ═══════════════════════════════════════════════
//  TURN FLOW
// ═══════════════════════════════════════════════

function _startTurn() {
  if (_checkGameOver()) return;
  if (_gTurn === "player") _doPlayerTurn();
  else _doAiTurn();
}

function _doPlayerTurn() {
  if (!_gPlayerDeck.length || !_gAiDeck.length) { _checkGameOver(); return; }
  _gPlayerCard  = _gPlayerDeck.shift();
  _gAiCard      = _gAiDeck.shift();
  _gChosenField = null;
  _gAnimating   = false;

  _setMsg(t('yourTurn'));
  _hideHLButtons();

  const aiFront = document.getElementById("card-ai-front");
  const aiBack  = document.getElementById("card-ai-back");
  if (aiFront) { aiFront.innerHTML = ""; aiFront.style.display = "none"; }
  if (aiBack)  { aiBack.style.display = ""; aiBack.style.opacity = "1"; aiBack.style.transition = ""; }

  const wrap   = document.getElementById("player-img-wrap");
  if (!wrap) return;
  const fields = _getFields();
  const imgUrl = _getCardImage(_gPlayerCard);

  wrap.innerHTML = `
    <div style="position:relative;width:100%;height:100%;">
      <img src="${imgUrl}" alt="${_gPlayerCard.card || ''}"
           style="width:100%;height:100%;object-fit:contain;display:block;" />
      ${fields.map((f, i) => i < ATTR_ZONES_PCT.length ? `
        <div class="game-attr-zone"
             style="position:absolute;
               left:${ATTR_ZONES_PCT[i].x1}%;top:${ATTR_ZONES_PCT[i].y1}%;
               width:${ATTR_ZONES_PCT[i].x2-ATTR_ZONES_PCT[i].x1}%;
               height:${ATTR_ZONES_PCT[i].y2-ATTR_ZONES_PCT[i].y1}%;"
             onclick="gameAttrClick(${i})" title="${f}"></div>
      ` : "").join("")}
    </div>`;
}

function gameAttrClick(idx) {
  if (_gAnimating || _gTurn !== "player") return;
  const fields = _getFields();
  if (idx >= fields.length) return;
  _gChosenField = fields[idx];
  document.querySelectorAll(".game-attr-zone").forEach((z, i) =>
    z.classList.toggle("game-attr-zone--active", i === idx));
  _showHLButtons(_gChosenField);
}
window.gameAttrClick = gameAttrClick;

function resolveRound(hl) {
  if (_gAnimating) return;
  _gAnimating = true;
  _hideHLButtons();
  // ① Reveal AI card
  _revealAiCard(() => {
    // ② Wait 1.5s so player can see it, THEN show result
    setTimeout(() => _doResolve(hl), 1500);
  });
}
window.resolveRound = resolveRound;

function _revealAiCard(cb) {
  const front  = document.getElementById("card-ai-front");
  const back   = document.getElementById("card-ai-back");
  const imgUrl = _getCardImage(_gAiCard);

  if (front) {
    front.innerHTML = `<img src="${imgUrl}" alt="${_gAiCard.card || ''}"
      style="width:100%;height:100%;object-fit:contain;display:block;" />`;
    front.style.display = "";
  }
  if (back) {
    back.style.transition = "opacity 0.3s";
    back.style.opacity = "0";
  }
  setTimeout(() => {
    if (back) back.style.display = "none";
    if (cb) cb();
  }, 350);
}

function _doResolve(hl) {
  const field = _gChosenField;
  const pVal  = _numVal(_gPlayerCard, field);
  const aVal  = _numVal(_gAiCard, field);

  let playerWins;
  if (pVal !== null && aVal !== null) {
    playerWins = hl === "H" ? pVal > aVal : pVal < aVal;
  } else {
    playerWins = hl === "H"
      ? String(_gPlayerCard[field] ?? "") > String(_gAiCard[field] ?? "")
      : String(_gPlayerCard[field] ?? "") < String(_gAiCard[field] ?? "");
  }

  const pDisp = pVal !== null ? pVal : (_gPlayerCard[field] ?? "—");
  const aDisp = aVal !== null ? aVal : (_gAiCard[field]    ?? "—");

  if (playerWins) { _gPlayerDeck.push(_gPlayerCard, _gAiCard); _gTurn = "player"; }
  else            { _gAiDeck.push(_gAiCard, _gPlayerCard);      _gTurn = "ai"; }

  _showResult(playerWins, field, pDisp, aDisp, () => {
    _updateCounts();
    _clearArena();
    if (_checkGameOver()) return;
    setTimeout(_startTurn, 300);
  });
}

function _doAiTurn() {
  if (!_gPlayerDeck.length || !_gAiDeck.length) { _checkGameOver(); return; }
  _gPlayerCard  = _gPlayerDeck.shift();
  _gAiCard      = _gAiDeck.shift();
  _gAnimating   = false;

  _setMsg("AI is thinking…");
  _hideHLButtons();

  const wrap = document.getElementById("player-img-wrap");
  if (wrap) {
    const imgUrl = _getCardImage(_gPlayerCard);
    wrap.innerHTML = `<img src="${imgUrl}" alt=""
      style="width:100%;height:100%;object-fit:contain;display:block;opacity:0.5;" />`;
  }
  const aiFront = document.getElementById("card-ai-front");
  const aiBack  = document.getElementById("card-ai-back");
  if (aiFront) { aiFront.innerHTML = ""; aiFront.style.display = "none"; }
  if (aiBack)  { aiBack.style.display = ""; aiBack.style.opacity = "1"; aiBack.style.transition = ""; }

  // Smart AI: pick attribute with biggest advantage vs set average
  const fields  = _getFields();
  let bestField = null, bestScore = -Infinity, bestHl = "H";
  for (const f of fields) {
    const aiVal = _numVal(_gAiCard, f);
    if (aiVal === null) continue;
    let sum = 0, cnt = 0;
    for (const c of _gCards) { const v = _numVal(c, f); if (v !== null) { sum += v; cnt++; } }
    if (!cnt) continue;
    const diff = aiVal - (sum / cnt);
    if (Math.abs(diff) > bestScore) {
      bestScore = Math.abs(diff); bestField = f; bestHl = diff >= 0 ? "H" : "L";
    }
  }
  _gChosenField = bestField || fields[Math.floor(Math.random() * fields.length)];
  const hl = bestField ? bestHl : (Math.random() < 0.5 ? "H" : "L");

  setTimeout(() => {
    _setMsg(t('aiChose', { field: _gChosenField, hl: hl === "H" ? t('higherArrow') : t('lowerArrow') }));
    // ① Show AI card after 0.8s
    setTimeout(() => {
      _gAnimating = true;
      // ② Reveal card, then wait 1.5s before resolving
      _revealAiCard(() => setTimeout(() => _doResolve(hl), 1500));
    }, 900);
  }, 800);
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function _numVal(card, field) {
  const raw = card[field];
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(",", "."));
  return isNaN(n) ? null : n;
}

function _getFields() {
  if (typeof FIELDS !== "undefined" && FIELDS && FIELDS.length > 0)
    return FIELDS.slice(0, 5).map(f => (typeof f === "object" ? f.key : f));
  if (!_gCards.length) return [];
  const skip = new Set(["card","name","year","collection","img","image","grade","id","flag","country","category","info","info_left","info_right","info_image"]);
  return Object.keys(_gCards[0]).filter(k => !skip.has(k.toLowerCase())).slice(0, 5);
}

function _getCardImage(card) {
  if (!card) return "";
  const grade = card.card || card.grade || "";
  const key   = `${_gSetKey}::${grade}`;
  if (typeof imageMap !== "undefined" && imageMap && imageMap[key]) return imageMap[key];
  if (_gSet && _gSet.thumb) return _gSet.thumb;
  return "";
}

function _setMsg(html) {
  const el = document.getElementById("game-round-msg");
  if (el) el.innerHTML = html;
}

function _updateCounts() {
  const pc = document.getElementById("player-count");
  const ac = document.getElementById("ai-count");
  if (pc) pc.textContent = _gPlayerDeck.length;
  if (ac) ac.textContent = _gAiDeck.length;
}

function _showHLButtons(field) {
  const row = document.getElementById("game-hl-row");
  const lbl = document.getElementById("game-chosen-attr");
  if (lbl) lbl.textContent = t('attribute', { field });
  if (row) row.style.display = "flex";
}

function _hideHLButtons() {
  const row = document.getElementById("game-hl-row");
  if (row) row.style.display = "none";
}

function _clearArena() {
  const wrap = document.getElementById("player-img-wrap");
  if (wrap) wrap.innerHTML = "";
  const aiFront = document.getElementById("card-ai-front");
  const aiBack  = document.getElementById("card-ai-back");
  if (aiFront) { aiFront.innerHTML = ""; aiFront.style.display = "none"; }
  if (aiBack)  { aiBack.style.display = ""; aiBack.style.opacity = "1"; aiBack.style.transition = ""; }
  _gAnimating = false;
}

function _showResult(playerWins, field, pVal, aVal, cb) {
  const overlay = document.getElementById("game-result-overlay");
  const box     = document.getElementById("game-result-box");
  if (!overlay || !box) { if (cb) cb(); return; }
  box.innerHTML = `
    <div class="game-result-icon ${playerWins ? 'game-result-win' : 'game-result-lose'}">
      ${playerWins ? "✔" : "✘"}
    </div>
    <div class="game-result-title">${playerWins ? "You win this round!" : "AI wins this round"}</div>
    <div class="game-result-detail">
      <span class="game-result-field">${field}</span>
      <span class="game-result-vals">You: <strong>${pVal}</strong> &nbsp;·&nbsp; AI: <strong>${aVal}</strong></span>
    </div>`;
  overlay.style.display = "flex";
  setTimeout(() => { overlay.style.display = "none"; _gAnimating = false; if (cb) cb(); }, 1600);
}

function _checkGameOver() {
  if (_gPlayerDeck.length && _gAiDeck.length) return false;
  const playerWon = _gAiDeck.length === 0;
  _setMsg(playerWon ? t('winGame') : t('loseGame'));
  const overlay = document.getElementById("game-result-overlay");
  const box     = document.getElementById("game-result-box");
  if (overlay && box) {
    box.innerHTML = `
      <div class="game-result-icon ${playerWon ? 'game-result-win' : 'game-result-lose'}"
           style="font-size:3rem">${playerWon ? "🏆" : "💀"}</div>
      <div class="game-result-title" style="font-size:1.4rem">
        ${playerWon ? t('winGameTitle') : t('loseGameTitle')}
      </div>
      <div style="display:flex;gap:.75rem;margin-top:1.2rem;justify-content:center;">
        <button class="game-btn game-btn--high" onclick="initGame('${_gSetKey}')">${t('playAgain')}</button>
        <button class="game-btn" style="background:rgba(255,255,255,.1);color:var(--text-primary);"
                onclick="cleanupGame();showPlayPicker();">${t('changeSet')}</button>
      </div>`;
    overlay.style.display = "flex";
  }
  return true;
}
