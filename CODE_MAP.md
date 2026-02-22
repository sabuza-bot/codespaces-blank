# Small Kingdom Code Map

This document explains each major segment of the project and how the HTML, CSS, and JavaScript relate to each other.

## 1) HTML Structure (`index.html`)

### A. Document head
- Includes metadata (`charset`, `viewport`) and sets the page title.
- Loads `style.css` so all visual styles are centralized.

### B. `body` launch state
- `class="start-cover-active"` means the app starts in “menu cover mode.”
- CSS uses this class to disable scrolling until the game starts.

### C. Start menu cover (`#startMenu`)
- Full-screen launch overlay shown first.
- Contains three buttons:
  - `#startOnePlayer`
  - `#startTwoPlayer`
  - `#escapeButton`
- Contains `#startStatus` text area for fallback messages (like blocked tab close).

### D. Game container (`#gameContainer`)
- Starts with class `hidden`, so it is not visible initially.
- Contains all in-game panels:
  1. Header/title panel
  2. Turn tracker panel (`round`, `current player`, `theme selector`)
  3. Player info panel (name + stat grid)
  4. Event panel (event text + two choice buttons)
  5. History panel (`#log`)

### E. Script load
- Loads `script.js` at the bottom so all DOM nodes exist before JavaScript queries them.

---

## 2) CSS Structure (`style.css`)

### A. Global reset and theme variables
- `* { box-sizing: border-box; }` normalizes sizing behavior.
- `:root` defines the default (GBA olive) palette via CSS variables.

### B. Theme variants
- Theme blocks like `body[data-theme="gba-teal"]` override the same variable names.
- Because all components use variables, switching one body attribute updates the full UI.

### C. Base body styles
- Applies global font, background, text color, and line spacing.
- `body.start-cover-active { overflow: hidden; }` prevents scroll while menu cover is active.

### D. Visibility utility
- `.hidden { display: none !important; }` guarantees hidden state wins over other `display` rules.
- This is crucial for toggling `#startMenu` and `#gameContainer` reliably.

### E. Start cover layout
- `.start-menu` is `position: fixed; inset: 0; z-index: 1000;`.
- This pins it over the entire viewport until JavaScript hides it.
- `.start-panel` and `.menu-actions` shape menu width and button stacking.

### F. Game layout styles
- `.container` and `.panel` create the boxed console layout.
- `.tracker`, `.stats-grid`, `.choices` define each panel’s internal flow.

### G. Input/interaction styles
- `select` and `button` share palette-driven borders/backgrounds.
- Hover/active states come from theme variables (`--button-hover`, `--button-active`).

### H. Log and text tone
- `.log` constrains height and enables scrolling.
- `.log-entry` and `.muted` provide visual hierarchy for history and secondary text.

---

## 3) JavaScript Structure (`script.js`)

### A. Data definitions
1. `basePlayers`
   - Immutable templates for Player 1 and Player 2 with starting stats.
2. `players`
   - Runtime active players array.
   - Filled at game start based on 1-player or 2-player selection.
3. `events`
   - Event pool with binary choices and stat effects.

### B. Runtime state
- `currentPlayerIndex`: whose turn it is.
- `roundNumber`: current round counter.
- `currentEvent`: event currently displayed.
- `activePlayerCount`: 1 or 2 based on start menu selection.

### C. DOM references
- Cached references for all dynamic fields and buttons (`roundValueEl`, `playerNameEl`, `choiceAButton`, etc.).
- Enables fast updates and event wiring.

### D. Theme system
1. `applyTheme(themeName)`
   - Sets `data-theme` on `<body>`.
2. `initializeTheme()`
   - Reads saved theme from `localStorage`.
   - Applies it immediately.
   - Wires selector change event to update and persist.

### E. Game start system
1. `initializePlayers(playerCount)`
   - Clones templates from `basePlayers` into `players`.
2. `startGame(playerCount)`
   - Resets game state (round, current player, event, log).
   - Builds active players.
   - Calls `updateUI()`.
   - Hides menu, shows game, removes `start-cover-active` class.
3. `beginGameSequence(playerCount)`
   - Guard function: only allows 1 or 2.
4. `initializeStartMenu()`
   - Wires click handlers:
     - 1 player → `beginGameSequence(1)`
     - 2 player → `beginGameSequence(2)`
     - escape → `attemptEscape()`
5. `attemptEscape()`
   - Attempts `window.close()`.
   - Shows fallback status if browser blocks it.

### F. Core turn mechanics
1. `getRandomEvent()`
   - Picks random event from `events`.
2. `applyEffects(player, effects)`
   - Applies each stat delta safely if stat exists.
3. `logChoice(player, choice)`
   - Prepends a human-readable history line to `#log`.
4. `nextTurn()`
   - Moves to next player.
   - If all players acted, wraps to player 1 and increments round.
   - Rolls next event and refreshes UI.
5. `updateUI()`
   - Renders round/player tracker.
   - Renders active player name + stats.
   - Renders current event + choice button labels.

### G. Choice button flow
- `choiceAButton` click:
  1. Read active player
  2. Apply A effects
  3. Log result
  4. Advance turn
- `choiceBButton` click:
  - Same flow for B effects.

### H. Boot sequence
- `initializeTheme();`
- `initializeStartMenu();`
- No game auto-start. User must select mode first.

---

## 4) Relationship Map (HTML ↔ CSS ↔ JS)

### Start menu visibility
- HTML: `#startMenu`, `#gameContainer`, body class `start-cover-active`
- CSS: `.start-menu`, `.hidden`, `body.start-cover-active`
- JS: `startGame()` toggles visibility classes and removes body cover class

### Theme switching
- HTML: `#themeSelect`
- CSS: `:root` variables + `body[data-theme="..."]` overrides
- JS: `initializeTheme()` + `applyTheme()` + `localStorage`

### Turn tracker and player panel
- HTML: `#roundValue`, `#playerTurnValue`, `#playerCountValue`, `#playerName`, `#statsGrid`
- CSS: `.tracker`, `.label`, `.stats-grid`
- JS: `updateUI()` reads state and writes these fields

### Event and choices
- HTML: `#eventText`, `#choiceAButton`, `#choiceBButton`
- CSS: `.event-text`, `.choices`, `button`
- JS: `updateUI()` sets text; button listeners call effect and turn functions

### History log
- HTML: `#log`
- CSS: `.log`, `.log-entry`
- JS: `logChoice()` prepends entries each action

---

## 5) End-to-end runtime flow
1. Page loads.
2. Theme initializes from saved preference.
3. Start menu waits for user choice.
4. User picks 1P or 2P.
5. Game initializes players + state, reveals game UI.
6. On each choice:
   - Effects apply to current player
   - Action logged
   - Turn advances
   - Round increments after all active players have acted
   - New random event appears
