# Verdian Valley Quest teaser video plan

Created by WING after reading the current static prototype.

## Project read

Repo root: `/Users/minsungpark/.superset/projects/softskills`

Main files:
- `README.md` — playable static prototype notes
- `index.html` — game shell, canvas, HUD, dialog/stage containers
- `styles.css` — pixel RPG UI, scene-stage styling, mobile pad, report/dialog styling
- `game.js` — full game loop, scenarios, state, rendering, choices, report export
- `assets/vendor/` — permissive pixel assets: Tiny RPG Forest, Stranger Forest, Kenney 1-bit, MaruMinya Hangul font

Current size:
- README.md: 35 lines
- index.html: 51 lines
- game.js: 1473 lines
- styles.css: 871 lines

## Game summary

Verdian Valley Quest is a browser-based top-down pixel RPG prototype for soft-skill assessment.

The player:
- starts with a 20:00 timer
- moves on a forest map with WASD / arrow keys
- finds glowing scenario markers
- presses E / Space to enter encounters
- plays through 20 onboarding/scenario moments
- chooses between 3 options per encounter
- builds scores across 6 skills: Analytical, Teamwork, Time, Resilience, Creativity, Leadership
- collects 5 Verdian stones through milestone scenes
- ends with an assessment report and downloadable JSON

The game is not just a visual novel. It has a real overworld loop, timer pressure, marker navigation, encounter screens, choice resolution, scoring, stone collection, and final report.

## Verified behavior

Local server:
`python3 -m http.server 4173 --bind 127.0.0.1`

URL:
`http://127.0.0.1:4173/`

Browser checks performed:
- loaded page successfully
- started game via debug/browser click path
- opened Scene 1 at the first objective
- advanced dialogue into choices
- selected River path
- stone count increased to 1/5
- scores changed correctly
- fast-forwarded all 20 scenarios through debug hooks
- final report appeared
- no browser console errors after run

## Best teaser angle

This should be cut like a gameplay trailer, not a corporate explainer.

Core pitch:
"A 20-minute fantasy quest that turns soft-skill assessment into actual gameplay."

Tone:
- cozy pixel RPG
- assessment hidden inside decisions
- light corporate/training framing only at the end
- feel like an indie game demo first

## Suggested 35-45s teaser structure

### 0-4s — Hook
Visual: title card over forest gameplay.
Text:
`What if soft-skill assessment played like an RPG?`

### 4-10s — Gameplay movement
Visual: player moving through Verdian Valley, HUD visible, timer ticking.
Text:
`Explore the valley. Find the glowing trials.`

### 10-17s — First encounter
Visual: Three-Path Crossing scene-stage, guide dialogue, three route options.
Text:
`Every choice measures how you think.`

### 17-24s — Variety montage
Visual cuts:
- broken bridge
- bright flower clue
- rune gate
- storm argument
- tool shore
- fog path
Text bursts:
`Teamwork`
`Time Management`
`Resilience`
`Creativity`

### 24-31s — Consequences
Visual: choose option, stone collected, scores update, timer drops.
Text:
`Decisions change your score. Time keeps moving.`

### 31-38s — Endgame/report
Visual: five stones / altar / final assessment report.
Text:
`Finish the quest. Get the assessment.`

### 38-45s — Closing title
Visual: logo/title + CTA.
Text:
`Verdian Valley Quest`
`Playable soft-skills RPG prototype`

## Capture strategy

Use actual gameplay capture, then add motion graphics.

Recommended pipeline:
1. Use Playwright or Puppeteer to drive the browser deterministically.
2. Capture short clips/screenshots of:
   - intro screen
   - overworld movement
   - Scene 1 dialogue
   - choice UI
   - result/stone collection
   - selected later scenarios via `window.__verdianDebug`
   - final report
3. Edit with Remotion or HyperFrames.

## Remotion vs HyperFrames

They are not exactly competitors for this job.

Remotion is better for:
- React-based video editing timeline
- compositing recorded gameplay clips
- captions, cuts, transitions, reusable trailer components
- programmatic video builds in a JS/React project

HyperFrames is better for:
- HTML-native motion graphics
- animated title cards and overlays
- GSAP-driven text/visual treatment
- quick deterministic MP4 renders from HTML

Best combination for this project:
- Playwright captures real game footage from `http://127.0.0.1:4173/`
- Remotion assembles the gameplay montage
- HyperFrames can create punchy title cards / motion overlay cards if desired

If choosing one only: use Remotion for the trailer because this needs real gameplay montage composition more than a pure HTML motion-graphic ad.

## Technical notes for capture

Useful debug hooks already exposed in `game.js`:

```js
window.__verdianDebug = {
  state,
  objectives,
  scenarios,
  interact,
  resolveScenario,
  showReport,
  blocked,
};
```

This makes trailer capture easy:
- jump player to objective: set `state.player.x/y` to `objectives[i].x/y`
- call `interact()` to open a scene
- call `resolveScenario(optionIndex)` to show result
- call `showReport()` for final assessment

Potential issue:
- `drawScenarioSetPiece()` exists but does not appear to be called from `drawPropsAndMarkers()` in the current code. The overworld mostly uses active/completed markers plus buildings/NPCs/enemy. For a richer trailer, we can either use scene-stage encounter screens or patch overworld to draw set pieces.

## Deliverable recommendation

Create:
- `teaser/` folder
- `teaser/capture-gameplay.mjs` for deterministic Playwright capture
- `teaser/remotion/` or `teaser/hyperframes/` for final composition
- final output: `teaser/verdian-valley-quest-teaser.mp4`

Target formats:
- 16:9 YouTube/demo: 1920x1080, 35-45s
- optional vertical: 1080x1920, 20-30s
