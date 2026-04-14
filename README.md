# Planet Scanner Mission Prototype

This project is a browser-based interactive scanner game built with plain HTML, CSS, and JavaScript.

## What the Project Is

The app is a mini-game a planet-scanning mission where the player searches for water deposits while avoiding contamination sources.

- Objective: Reach a water score target before contamination reaches the loss threshold.
- Theme: Styled as a futuristic scanner experience, visually tied to charity: water branding.

## What It Is Doing Right Now

At runtime, the project:

- Generates randomized material sources on a rotatable 3D-like planet projection.
- Lets players scan and confirm sources.
- Tracks mission state in real time (water score, contamination, win/loss).
- Plays material-specific audio beeps to help identify source type.
- Supports desktop and mobile interaction patterns.

## Tech Used

- HTML5: Defines the UI structure, HUD, overlays, and controls.
- CSS3: Handles theming, responsive layout, animations, and visual effects.
- Vanilla JavaScript (ES6+): Implements gameplay state, rendering, interaction logic, and mission flow.
- Canvas 2D API: Renders the scanner planet view, source dots, reticle, and marker effects.
- Web Audio API: Generates procedural material-specific scanner tones and volume control.
- Pointer Events API: Unifies desktop and touch input behavior for rotation and selection.

## Core Gameplay Loop

1. Start from the rules overlay.
2. Rotate and zoom the planet to explore.
3. Hover/touch to scan source proximity.
4. Confirm sources to begin scoring effects.
5. Collect enough water to win, or avoid contamination overflow.

## Controls

### Desktop

- Left click + drag: Rotate planet
- Mouse wheel: Zoom in/out
- Right click: Confirm/select a source marker
- R key or Restart button: Restart mission
- Hover material key: Preview material audio

### Mobile / Touch

- Drag: Rotate planet
- Tap on planet: Confirm/select nearest source marker
- Tap material key buttons: Toggle material audio preview
- On-screen controls: Restart and view rules

## Mission Rules

- Win condition: 320 water score
- Loss condition: 100 contamination
- Water increases score
- Toxin and waste increase contamination

## Project Structure

- index.html: Main game UI markup
- style.css: Visual design, themes, responsive layout
- script.js: Mission logic, rendering, interaction, audio
- docs/: GitHub Pages deployment copy of the same app
- _config.yml: Jekyll/GitHub Pages source config

## Run Locally

Open index.html in a browser.

For best results, use a local static server if your browser applies strict autoplay or file access constraints.

## Deployment Notes

GitHub Pages is configured to publish from the docs directory.

If you update root files, keep docs/index.html, docs/style.css, and docs/script.js in sync.

## Next Improvement: Visual Proximity Indicators

The next planned improvement is a clear visual indication of source proximity for each material type, so players can read distance at a glance in addition to audio.

### Goal

Add on-screen feedback that answers two questions immediately:

- Which material is nearest right now?
- How close the scanner is to water, toxin, and waste at the current cursor/touch position?

### Proposed UX Direction

- Add three mini proximity bars in the HUD (water, toxin, waste), each with its own material color.
- Fill amount should map to proximity from 0% to 100%.
- Show a soft pulse/glow on the currently dominant material.
- Keep the existing material readout label, but enhance it with an intensity state such as weak, medium, or strong.

### Planned Implementation Approach

1. In the scanning update loop, compute nearest active source per material type.
2. Derive normalized proximity values for each type from distance and detect radius.
3. Store those values in scanner state for HUD rendering.
4. Add HUD markup for the three proximity indicators.
5. Add CSS styles and responsive behavior for bars, labels, and active pulse state.
6. Update the render path to refresh indicator values each frame.

### Why This Matters

- Improves readability for players who prefer visual signals over audio.
- Makes mobile play more accessible where hover cues are limited.
- Strengthens decision-making by exposing water-vs-contamination risk in real time.
