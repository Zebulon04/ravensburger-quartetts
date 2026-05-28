# Game Integration Guide

## Files
- `game.js`        → drop into `js/game.js` (replaces the empty stub)
- `game_styles.css` → copy its contents into `css/styles.css` at the bottom,
                      under the existing `/* ── GAME ── */` comment

## index.html changes needed

### 1. The Play section — add a set-picker + arena:
```html
<section id="play">
  <!-- Set picker: rendered by nav.js / your existing UI when user clicks Play -->
  <!-- After picking a set, call: initGame("year::collectionKey") -->

  <!-- Game board is injected here by game.js -->
</section>
```

### 2. How to trigger initGame
Call `initGame(setKey)` with the same key format used elsewhere in the app
(`"year::collectionKey"`, e.g. `"1985::Formel1"`).

The simplest hook: in `nav.js` / wherever your Play nav item is handled,
after the user selects a set, call:

```js
initGame(selectedSetKey);
```

And when they navigate away:
```js
cleanupGame();
```

## What the game does (mirrors game.py logic)

| Python                          | JS                        |
|---------------------------------|---------------------------|
| `load_card_data(year, cardset)` | reads `allData[setKey]`   |
| `load_card_images(year, cardset)` | reads `imageMap[setKey+"::"+grade]` |
| `ORIG_ATTR_RECTS` (pixel rects) | `ATTR_ZONES_PCT` (% of image size) |
| `deck split + shuffle`          | identical logic           |
| Player clicks rect → H/L choice | invisible `<div>` zones over card image |
| AI picks best attr by avg-distance | identical heuristic    |
| Cards go to winner's deck       | identical                 |
| Game over when a deck empties   | identical                 |

## Attribute zone calibration
The zones in `ATTR_ZONES_PCT` were derived from your Python `ORIG_ATTR_RECTS`
coordinates. If they're slightly off on your actual card images, adjust the
percentages in `game.js` at the top of the file:

```js
const ATTR_ZONES_PCT = [
  { x1: 39.6, y1: 60.5, x2: 91.8, y2: 64.7 },  // attr 1
  // ...
];
// x1/x2 = % from left edge, y1/y2 = % from top edge of the card image
```

You can make the zones briefly visible during calibration by adding this to CSS:
```css
.game-attr-zone { background: rgba(255,0,0,0.2) !important; }
```
