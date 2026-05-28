# Quartett Archive — Architecture

## File Structure
```
quartett/
├── index.html              ← Shell only: HTML, <link> to CSS, <script src> tags
├── css/
│   └── styles.css          ← All styles: themes (crimson/dhl/default), components, mobile
└── js/
    ├── state.js            ← Global vars, FIELDS, country flag helpers
    ├── loader.js           ← GitHub repo loader, JSON lazy-load, image map builder
    ├── nav.js              ← showSection(), home stats, sidebar (year/collection list)
    ├── database.js         ← renderYearsOverview, renderCollections, renderCards, card grid
    ├── modal.js            ← openModal, _renderModal, modalNav, closeModal, state vars
    ├── quartett-overlay.js ← openQuartettView, _getQuartettGroups, _renderQuartettOverlay
    ├── search.js           ← handleSearch, handleInfoSearch, setSearchSort, renderSearchResults
    ├── ui.js               ← setTheme, setLang, i18n (t()), init(), swipe, lightbox, back button
    ├── report.js           ← openReportModal, sendReport, bug report flow
    ├── map.js              ← Country map: SVG render, D3 zoom, selectCountry, renderCountryResults
    └── game.js             ← FUTURE: game logic (currently empty stub)
```

## Script Load Order
`state → loader → nav → database → modal → quartett-overlay → search → ui → report → map → game`

This order matters — later files call functions defined in earlier files.

## Key Global State (state.js)
| Variable | Description |
|---|---|
| `allData` | `"year::collection"` → set object (cards, images, metadata) |
| `imageMap` | `"year::collection::grade"` → blob URL for card image |
| `currentYear` | Currently browsed year (null = overview) |
| `currentColl` | Currently browsed collection key (null = year level) |
| `FIELDS` | Derived stat field definitions for current set |
| `_modalCards` | Card list currently navigable in the modal |
| `_modalIdx` | Index of open card in `_modalCards` |
| `_modalSet` | Set object for the open modal |

## Key Functions by File

### loader.js
- `loadEntireRepo()` — fetches GitHub tree, populates `allData` stubs
- `loadImgForGrade(img, grade, placeholder, set)` — lazy-loads card image into an `<img>` element
- `fetchWithRetry(url)` — fetch with exponential backoff

### database.js
- `renderCards(set)` — renders the 4×4 quartett card grid for a set
- `renderCollections(year)` — renders collection thumbnails for a year
- `renderYearsOverview()` — renders the year picker

### modal.js
- `openModal(card, set, cardList)` — opens the card detail modal
- `_renderModal(card, set)` — rebuilds modal body content
- `modalNav(dir)` — navigate ±1 within `_modalCards`

### quartett-overlay.js
- `openQuartettView(group)` — entry point, called from modal's "show quartett" button
- `_renderQuartettOverlay(group, set)` — builds the full-screen 4-image overlay
- Keyboard: ESC closes, ←/→ navigates between quartett groups

### map.js
- `openCountryMap()` — shows the SVG world map modal
- `selectCountry(iso)` — async; closes map, searches cards, lazy-loads sets, renders results
- `renderCountryResults(iso, name, results)` — renders the country card grid

### game.js (future)
Expected public API when implemented:
- `initGame(setKey)` — called when user navigates to Play section
- `cleanupGame()` — called when leaving Play section

## Themes (css/styles.css)
Three themes via `data-theme` on `<html>`:
- `default` (Midnight Blue) — blue/cyan accents
- `crimson` — red on black
- `dhl` — yellow + blue on near-black (matches real DHL card style)

## Adding the Game Feature
1. Edit `js/game.js` only
2. Add game HTML to `index.html` inside `<section id="play">`
3. Add game-specific styles to `css/styles.css` under a `/* ── GAME ── */` comment
4. The game can call `openModal()`, `allData`, `imageMap` — everything is global

## Common Gotchas
- `selectCountry(iso)` is **async** — always await or call without blocking UI
- `imageMap` is populated by `loadEntireRepo()` and `loadSetImages()` — may be empty until load completes  
- Card grade field: `card.card` (e.g. `"4A"`, `"4B"`) — the letter suffix is A–D
- Quartett group = `card.card.replace(/[A-Da-d]$/i, '')` (e.g. `"4"`)
- `FIELDS` is rebuilt per-set via `deriveFields(set)` — don't cache across sets
