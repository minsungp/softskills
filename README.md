# Verdian Valley Quest

Playable static prototype based on the onboarding and scenario PDFs.

Open `index.html` in a browser, or run a local static server and visit it. The active local demo during this build uses:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

The game converts the PDF storyboard into a top-down soft-skills RPG:

- move through a green forest valley with WASD / arrow keys
- hear lightweight WebAudio background music and feedback sounds after starting
- watch the 20:00 clock decrease in real time while exploring
- press E or Space at glowing scenario markers
- play through 20 onboarding/scenario moments with large PDF-inspired scene screens, RPG-style dialogue, choices, and result text
- collect five Verdian stones through milestone scenes
- encounter PDF-derived set pieces from the scenario screens: three paths, campfire, broken bridge, bright flower clue, rune gate, switch wall, tool shore, and final altar
- finish with a corporate assessment report and downloadable JSON

Imported asset source:

- Kenney 1-Bit Pack, CC0: `assets/vendor/kenney-1bitpack/`
- License: `assets/vendor/kenney-1bitpack/License.txt`
- Tiny RPG Forest by ansimuz, public domain style license: `assets/vendor/tiny-rpg-forest/`
- License: `assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/public-license.txt`
- TinyRPG Stranger Forest by ansimuz, permissive public license: `assets/vendor/stranger-forest/`
- License: `assets/vendor/stranger-forest/Stranger Forest Files/public-license.txt`
- x12y12pxMaruMinyaHangul pixel font by quiple, OFL: `assets/vendor/x12y12pxMaruMinyaHangul/`
- License: `assets/vendor/x12y12pxMaruMinyaHangul/OFL.txt`

The current playable build primarily uses Tiny RPG Forest for the green top-down RPG look and keeps the Kenney pack available for UI/prototype expansion.
