const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const dialog = document.getElementById("dialog");
const timeBadge = document.getElementById("timeBadge");
const stoneBadge = document.getElementById("stoneBadge");
const objectiveBadge = document.getElementById("objectiveBadge");
const meters = document.getElementById("meters");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");
const sceneStage = document.getElementById("sceneStage");

const TILE = 32;
const MAP_W = 44;
const MAP_H = 30;
const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;

const base = "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG";
const forestBase = "assets/vendor/stranger-forest/Stranger Forest Files";
const assets = {
  tiles: image(`${base}/environment/tileset.png`),
  objects: image(`${base}/environment/objects.png`),
  heroFront: image(`${base}/spritesheets/hero/walk/hero-walk-front.png`),
  heroBack: image(`${base}/spritesheets/hero/walk/hero-back-walk.png`),
  heroSide: image(`${base}/spritesheets/hero/walk/hero-walk-side.png`),
  heroIdleFront: image(`${base}/spritesheets/hero/idle/hero-idle-front.png`),
  gem: image(`${base}/spritesheets/misc/gem.png`),
  coin: image(`${base}/spritesheets/misc/coin.png`),
  treant: image(`${base}/spritesheets/treant/idle/treant-idle-front.png`),
  mole: image(`${base}/spritesheets/mole/idle/mole-idle-front.png`),
  pine: image(`${forestBase}/props/Pine.png`),
  pineB: image(`${forestBase}/props/PineB.png`),
  shack: image(`${forestBase}/props/ShackA.png`),
  plant1: image(`${forestBase}/props/plant1.png`),
  plant2: image(`${forestBase}/props/plant2.png`),
  plantA: image(`${forestBase}/props/PlantA.png`),
  rockA: image(`${forestBase}/props/rockA.png`),
};

const skills = ["Analytical", "Teamwork", "Time", "Resilience", "Creativity", "Leadership"];

const state = {
  started: false,
  paused: true,
  sceneIndex: 0,
  stones: 0,
  timeLeft: 20 * 60,
  scores: Object.fromEntries(skills.map((skill) => [skill, 0])),
  keys: {},
  camera: { x: 0, y: 0 },
  player: { x: 5 * TILE, y: 23 * TILE, dir: "front", moving: false },
  message: "",
  log: [],
  activeScenario: null,
  activeLine: 0,
  result: null,
  soundOn: false,
  last: performance.now(),
};

const audio = {
  ctx: null,
  musicTimer: null,
  master: null,
  async start() {
    if (!this.ctx) {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) return;
      this.ctx = new AudioEngine();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.08;
      this.master.connect(this.ctx.destination);
    }
    state.soundOn = true;
    soundButton.textContent = "Sound On";
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // Some headless browsers block resume; real clicks in normal browsers enable it.
      }
    }
    if (!this.musicTimer) this.startMusic();
  },
  stop() {
    state.soundOn = false;
    soundButton.textContent = "Sound Off";
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  },
  toggle() {
    if (state.soundOn) this.stop();
    else this.start();
  },
  startMusic() {
    const notes = [392, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392];
    let step = 0;
    const playStep = () => {
      if (!state.soundOn || !this.ctx) return;
      this.tone(notes[step % notes.length], 0.16, "triangle", 0.05);
      if (step % 4 === 0) this.tone(notes[(step + 2) % notes.length] / 2, 0.28, "sine", 0.035);
      step += 1;
    };
    playStep();
    this.musicTimer = setInterval(playStep, 520);
  },
  tone(freq, duration = 0.12, type = "square", gain = 0.08) {
    if (!state.soundOn || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0, this.ctx.currentTime);
    amp.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
  },
  cue(name) {
    const cues = {
      talk: [660, 0.05, "square", 0.035],
      choice: [784, 0.08, "triangle", 0.08],
      stone: [523.25, 0.12, "triangle", 0.08],
      warning: [174.61, 0.18, "sawtooth", 0.07],
      step: [220, 0.025, "square", 0.018],
    };
    const cue = cues[name];
    if (!cue) return;
    this.tone(...cue);
    if (name === "stone") setTimeout(() => this.tone(783.99, 0.16, "triangle", 0.09), 90);
  },
};

const scenarios = [
  scene("Scene 1", "Analytical Thinking / Risk Assessment", "Three paths lead to the first stone. Each route has different danger, speed, and information quality.", true, [
    choice("Canopy path", "Fast, risky, clear line of sight.", { Analytical: 3, Time: 1, Resilience: -1 }, 110),
    choice("River path", "Balanced risk and travel time.", { Analytical: 2, Time: 1, Resilience: 1 }, 150),
    choice("Cave path", "Safer but slow and uncertain.", { Analytical: 1, Time: -1, Resilience: 1 }, 230),
  ]),
  scene("Scene 2", "Time Management / Prioritization", "The sun is setting. Camp needs food, shelter, and a signal fire before night.", false, [
    choice("Food first", "Useful but not the immediate risk.", { Time: -1, Teamwork: 1 }, 240),
    choice("Shelter first", "Protects the team from the night.", { Time: 2, Resilience: 1 }, 160),
    choice("Signal fire first", "Safety and morale before comfort.", { Time: 3, Leadership: 1 }, 130),
  ]),
  scene("Scene 3", "Resilience / Self Awareness", "The path continues after sunrise, but the team is tired and the next stone pulls you toward a dangerous turn.", false, [
    choice("Rush the dangerous path", "Momentum without self-checking.", { Resilience: -1, Time: 1, Analytical: -1 }, 100),
    choice("Check team readiness", "Notice limits before committing.", { Resilience: 3, Leadership: 1, Teamwork: 1 }, 150),
    choice("Avoid every risk", "Protects comfort, loses the mission thread.", { Resilience: -1, Time: -1 }, 210),
  ]),
  scene("Scene 4", "Creativity / Problem Solving", "The bridge is broken. You can repair it, find materials, or try to cross without a plan.", true, [
    choice("Patch with vines", "Creative but needs testing.", { Creativity: 2, Resilience: 1 }, 170),
    choice("Build a raft", "Creative and safer, but slower.", { Creativity: 3, Analytical: 1, Time: -1 }, 220),
    choice("Jump the gap", "Bold, not thoughtful.", { Time: 1, Analytical: -2 }, 70),
  ]),
  scene("Scene 5", "Analytical Thinking / Evidence Evaluation", "A note says the next stone is near the brightest flower. Several plants glow in different ways.", false, [
    choice("Pick the biggest glow", "Fast but shallow evidence.", { Analytical: 0, Time: 1 }, 90),
    choice("Compare brightness and location", "Use the clue exactly.", { Analytical: 3, Time: 1 }, 150),
    choice("Ask the team to vote", "Inclusive, but not evidence-led.", { Teamwork: 1, Analytical: 1 }, 190),
  ]),
  scene("Scene 6", "Time Management / Delegation", "Night falls and the camp must be set up. Three members have different strengths.", false, [
    choice("Everyone does everything", "Shared effort, low efficiency.", { Teamwork: 1, Time: -1 }, 260),
    choice("Match people to strengths", "Focus, tent, and food roles fit.", { Teamwork: 3, Time: 2, Leadership: 1 }, 160),
    choice("Do it alone", "Control goes up, team trust drops.", { Leadership: -1, Teamwork: -2, Time: -1 }, 260),
  ]),
  scene("Scene 7", "Resilience / Adaptability", "A fallen tree blocks the river while the boat drifts closer.", false, [
    choice("Keep pushing straight", "Persistence without adaptation.", { Resilience: 0, Time: -2 }, 240),
    choice("Abandon the route", "Avoids risk but loses momentum.", { Resilience: -2, Leadership: -1 }, 100),
    choice("Pivot diagonally", "Read the current and adapt.", { Resilience: 3, Analytical: 1, Time: 1 }, 130),
  ]),
  scene("Scene 8", "Creativity / Pattern Reasoning", "Runes on a gate repeat in a pattern. One tile is missing.", true, [
    choice("Choose the repeated rune", "Pattern found from sequence.", { Creativity: 2, Analytical: 2 }, 130),
    choice("Choose the prettiest rune", "Visual appeal is not evidence.", { Creativity: 1, Analytical: -1 }, 80),
    choice("Try all runes", "Works eventually, costs time.", { Time: -2, Resilience: 1 }, 260),
  ]),
  scene("Scene 9", "Analytical Thinking / Hypothesis Testing", "The wall opens only after testing the right switch order.", false, [
    choice("Randomly press switches", "No hypothesis.", { Analytical: -2, Time: -2 }, 260),
    choice("Test one variable at a time", "Controlled reasoning.", { Analytical: 3, Time: 1 }, 150),
    choice("Copy the last pattern", "Useful guess, not verified.", { Analytical: 1, Time: 1 }, 110),
  ]),
  scene("Scene 10", "Time Management / Conflict Handling", "Two teammates argue while a storm approaches. The path forward is blocked by indecision.", false, [
    choice("Ignore the argument", "The task stalls.", { Teamwork: -2, Time: -1 }, 220),
    choice("Pick a side fast", "Fast but divisive.", { Time: 1, Teamwork: -1 }, 100),
    choice("Name the problem and decide", "Short mediation, clear action.", { Teamwork: 2, Time: 2, Leadership: 2 }, 150),
  ]),
  scene("Scene 11", "Resilience / Persistence", "The storm continues. The team wants to turn back and stop before the next stone.", false, [
    choice("Turn back now", "Safety rises, mission stalls.", { Resilience: -2, Leadership: -1 }, 80),
    choice("Push without rest", "Persistence becomes burnout.", { Resilience: 0, Teamwork: -1 }, 170),
    choice("Rest, then continue", "Recovery supports persistence.", { Resilience: 3, Teamwork: 1 }, 180),
  ]),
  scene("Scene 12", "Creativity / Resourcefulness", "A stone floats across the water. Your bag has a hook, rope, and map.", false, [
    choice("Use hook and rope", "Combine tools for reach.", { Creativity: 3, Analytical: 1 }, 120),
    choice("Throw the map", "Wrong tool for the job.", { Creativity: -1, Time: -1 }, 60),
    choice("Wait for water to drop", "Safe but inefficient.", { Time: -2, Resilience: 1 }, 260),
  ]),
  scene("Scene 13", "Analytical Thinking / Situational Analysis", "The next route splits into three: windy ridge, quiet valley, and muddy shortcut.", true, [
    choice("Windy ridge", "Fast but unstable.", { Analytical: 1, Time: 1, Resilience: -1 }, 100),
    choice("Quiet valley", "Safe and readable.", { Analytical: 3, Resilience: 1 }, 170),
    choice("Muddy shortcut", "Tempting but costly.", { Time: -2, Analytical: 0 }, 230),
  ]),
  scene("Scene 14", "Time Management / Rapid Prioritization", "The compass is broken and the map is torn. You can fix only one before sunset.", false, [
    choice("Fix compass", "Direction first.", { Analytical: 2, Time: 1 }, 130),
    choice("Fix map", "Context first.", { Analytical: 2, Resilience: 1 }, 150),
    choice("Split repair roles", "Parallel work under pressure.", { Analytical: 2, Teamwork: 2, Time: 2 }, 100),
  ]),
  scene("Scene 15", "Resilience / Emotional Regulation", "A foe taunts the team. Everyone is angry and ready to rush.", false, [
    choice("Fight immediately", "Impulse wins.", { Resilience: -2, Analytical: -1 }, 80),
    choice("Walk away silently", "Avoids conflict, loses clarity.", { Resilience: 1, Leadership: -1 }, 100),
    choice("Breathe, then respond", "Regulate before action.", { Resilience: 3, Leadership: 1 }, 130),
  ]),
  scene("Scene 16", "Creativity / Tool Use", "The stone is trapped in a willow tree. You can force it, use tools, or communicate with the tree spirit.", false, [
    choice("Use the wrong tool fast", "Speed without fit.", { Time: 1, Creativity: -1 }, 80),
    choice("Match tool to mechanism", "Tool use follows observation.", { Creativity: 3, Analytical: 2 }, 130),
    choice("Ask a teammate to improvise", "Useful collaboration.", { Creativity: 2, Teamwork: 1 }, 150),
  ]),
  scene("Scene 17", "Teamwork / Role Integration", "You got the last stone. The return journey needs guarding, navigation, and morale.", false, [
    choice("Keep all roles yourself", "Control overload.", { Leadership: -1, Teamwork: -2 }, 140),
    choice("Assign return roles", "Team capacity becomes visible.", { Teamwork: 3, Leadership: 2 }, 140),
    choice("Let roles emerge", "Flexible but unclear.", { Teamwork: 1, Time: -1 }, 180),
  ]),
  scene("Scene 18", "Teamwork / Conflict Resolution", "Two teammates blame each other for a delay.", false, [
    choice("Make them argue elsewhere", "Conflict stays unresolved.", { Teamwork: -2 }, 70),
    choice("Hope it works out", "Avoids discomfort.", { Teamwork: -1, Time: 1 }, 80),
    choice("Ask what each needs", "Clarify, then coordinate.", { Teamwork: 3, Leadership: 1 }, 160),
  ]),
  scene("Scene 19", "Leadership / Self Awareness", "Night has fallen and the team is lost and scared. They need steadiness before the final communication push.", true, [
    choice("Build a campfire", "Ground the group in safety.", { Leadership: 2, Resilience: 1 }, 120),
    choice("Give a morale boost", "Name fear without letting it lead.", { Leadership: 3, Teamwork: 1 }, 110),
    choice("Promise nothing is wrong", "Sounds confident, avoids reality.", { Leadership: -2, Analytical: -1 }, 70),
  ]),
  scene("Scene 20", "Communication / Coordination", "Fog covers the route. The team can only move safely if messages stay short and clear.", false, [
    choice("Let everyone shout", "Too much noise.", { Teamwork: -1, Leadership: -1 }, 80),
    choice("Use one clear call sign", "Shared language under pressure.", { Teamwork: 2, Leadership: 2, Time: 1 }, 100),
    choice("Move without speaking", "Quiet, but coordination fails.", { Time: 1, Teamwork: -2 }, 90),
  ]),
];

const scenarioMeta = [
  ["Guide", "Three-Path Crossing", "paths", "Inspect / Choose Path", ["The first PDF screen is now live: three paths, one stone, and the clock already running.", "Read the terrain before you commit. A fast path is not always the best path."]],
  ["Mina", "Dusk Camp Setup", "camp", "Priority Select", ["The sun is setting and the camp needs food, shelter, and fire.", "You cannot do everything. Choose the first camp priority before the clock burns down."]],
  ["Guide", "Sunrise Path", "routes", "Self Check", ["The sun rises and the path continues toward the next stone.", "Resilience starts with noticing the team's state before taking another risk."]],
  ["Builder", "Broken Bridge", "bridge", "Repair Puzzle", ["This is the PDF bridge scene as a map obstacle.", "The bridge can be patched, rebuilt, or ignored. Only one answer respects both risk and creativity."]],
  ["Scout", "Bright Flower Grove", "flowers", "Closer Look", ["Several flowers glow, but the note says the brightest flower near the marker hides the next clue.", "This is not a vote. It is an evidence check."]],
  ["Mina", "Delegation Table", "roles", "Drag Tasks", ["The camp has three jobs and three people.", "This is the PDF drag-and-drop screen: match jobs to strengths before the timer burns down."]],
  ["Guide", "Blocked River", "fallen-tree", "Route Adaptation", ["A tree falls across the river path while the boat drifts away.", "Adapt the route. Pure persistence can still waste the run."]],
  ["Stone Gate", "Rune Gate", "runes", "Pattern Select", ["The gate repeats a pattern. One tile is missing.", "This is the Scene 8 pattern screen from the PDF turned into a gate puzzle."]],
  ["Scout", "Switch Wall", "switches", "Hypothesis Test", ["The wall opens only when switches are tested in a reliable order.", "Random input looks active, but it is not thinking."]],
  ["Mina", "Storm Argument", "conflict", "Timed Team Decision", ["Thunder is closing in and the team is arguing in the rain.", "The real time pressure is now visible on the clock."]],
  ["Guide", "Storm Shelter", "storm", "Persistence / Recover", ["The storm keeps pushing the party backward.", "Resilience is not refusing rest. It is recovering without quitting."]],
  ["Builder", "Tool Shore", "tools", "Tool Choice", ["A stone sits across the water and your bag has hook, rope, and map.", "Use the tool that matches the situation."]],
  ["Scout", "Route Split", "routes", "Situational Analysis", ["The route splits: ridge, valley, shortcut.", "The safest route is not always the slowest one."]],
  ["Mina", "Broken Compass", "compass", "Rapid Prioritization", ["The compass is broken and the map is torn.", "You can repair one thing, or divide the work."]],
  ["Foe", "Taunt Clearing", "foe", "Fight / Regulate", ["A foe taunts the party until everyone wants to rush.", "This is an emotional regulation test before it is a combat test."]],
  ["Builder", "Willow Trap", "trap", "Tool Use", ["The stone is trapped in the willow tree.", "Observe first, then choose whether to force, tool, or communicate."]],
  ["Mina", "Return Trail", "return", "Role Integration", ["The last stone is safe, but the route home still needs roles.", "A team without roles becomes one exhausted hero."]],
  ["Guide", "Blame Circle", "blame", "Conflict Resolution", ["Two teammates blame each other for the delay.", "Resolve the need, not just the noise."]],
  ["Mina", "Night Camp", "altar", "Leadership Choice", ["Night has fallen and the team is lost and scared.", "Lead the group by naming the moment and choosing what they need next."]],
  ["Guide", "Mayor's Fog Path", "fog", "Communication", ["The route to the Mayor is covered in fog.", "Short, shared signals are the only way through."]],
];

scenarios.forEach((scenario, index) => {
  const [speaker, location, visual, mechanic, lines] = scenarioMeta[index];
  Object.assign(scenario, { speaker, location, visual, mechanic, lines });
});

const objectives = [
  [6, 7],
  [12, 6],
  [19, 8],
  [27, 6],
  [35, 7],
  [38, 13],
  [31, 17],
  [23, 20],
  [16, 22],
  [9, 20],
  [6, 14],
  [13, 12],
  [20, 14],
  [26, 12],
  [33, 12],
  [37, 19],
  [30, 24],
  [21, 25],
  [13, 25],
  [6, 24],
].map(([x, y], index) => ({ x: x * TILE + 16, y: y * TILE + 16, index }));

function image(src) {
  const img = new Image();
  img.src = src;
  img.addEventListener("load", () => draw());
  return img;
}

function scene(id, skill, text, stone, options) {
  return { id, skill, text, stone, options, speaker: "Guide", location: "Verdian Valley", visual: "marker", lines: [text] };
}

function choice(label, detail, scores, timeCost) {
  return { label, detail, scores, timeCost };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reset() {
  if (audio.musicTimer) audio.stop();
  hideSceneStage();
  Object.assign(state, {
    started: false,
    paused: true,
    sceneIndex: 0,
    stones: 0,
    timeLeft: 20 * 60,
    scores: Object.fromEntries(skills.map((skill) => [skill, 0])),
    keys: {},
    camera: { x: 0, y: 0 },
    player: { x: 5 * TILE, y: 23 * TILE, dir: "front", moving: false },
    message: "",
    log: [],
    activeScenario: null,
    activeLine: 0,
    result: null,
    soundOn: false,
    last: performance.now(),
  });
  showIntro();
  updateHud();
}

function showIntro() {
  hideSceneStage();
  dialog.hidden = false;
  dialog.className = "dialog rpg-dialog intro-dialog";
  dialog.innerHTML = `
    <div class="speaker-row">
      <div class="portrait">V</div>
      <div>
        <h2>Verdian Valley Quest</h2>
        <p>Walk the valley, recover five sacred stones, and play the onboarding/PDF scenarios as RPG encounters.</p>
        <p>The clock ticks while you explore. Reach each glowing set-piece and press <b>E</b> or <b>Space</b>.</p>
      </div>
    </div>
    <button class="primary" id="beginButton" type="button">Begin quest</button>
  `;
  document.getElementById("beginButton").addEventListener("click", () => {
    audio.start();
    state.started = true;
    state.paused = false;
    dialog.hidden = true;
    dialog.className = "dialog";
    updateHud();
  });
}

function showScenario() {
  const scenario = scenarios[state.sceneIndex];
  if (!scenario) {
    showReport();
    return;
  }
  audio.cue("talk");
  state.paused = true;
  state.activeScenario = scenario;
  state.activeLine = 0;
  state.result = null;
  showRpgLine();
}

function showRpgLine() {
  const scenario = state.activeScenario;
  renderSceneStage(scenario, "dialog");
  dialog.hidden = false;
  dialog.className = "dialog rpg-dialog";
  const line = scenario.lines[state.activeLine] || scenario.text;
  dialog.innerHTML = `
    <div class="speaker-row">
      <div class="portrait">${scenario.speaker.slice(0, 1)}</div>
      <div>
        <div class="scene-kicker">${scenario.id} / ${scenario.location}</div>
        <h2>${scenario.speaker}</h2>
        <p>${line}</p>
      </div>
    </div>
    <button class="primary continue-button" id="continueLine" type="button">Continue</button>
  `;
  document.getElementById("continueLine").addEventListener("click", advanceDialog);
}

function advanceDialog() {
  const scenario = state.activeScenario;
  if (!scenario) return;
  audio.cue("talk");
  state.activeLine += 1;
  if (state.activeLine < scenario.lines.length) {
    showRpgLine();
    return;
  }
  showChoices();
}

function showChoices() {
  const scenario = state.activeScenario;
  renderSceneStage(scenario, "choice");
  dialog.className = "dialog rpg-dialog choice-dialog";
  dialog.innerHTML = `
    <div class="scene-kicker">${scenario.id} / ${scenario.skill}</div>
    <h2>${scenario.text}</h2>
    <div class="rpg-options">
      ${scenario.options
        .map(
          (option, index) => `
            <button type="button" data-choice="${index}">
              <span>${index + 1}</span>
              <b>${option.label}</b>
              <small>${option.detail}</small>
              <em>-${formatTime(choiceTimeCost(option))}</em>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
  dialog.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => resolveScenario(Number(button.dataset.choice)));
  });
}

function resolveScenario(index) {
  const scenario = scenarios[state.sceneIndex];
  const selected = scenario.options[index];
  audio.cue(scenario.stone ? "stone" : "choice");
  Object.entries(selected.scores).forEach(([skill, delta]) => {
    state.scores[skill] = Math.max(-5, Math.min(20, (state.scores[skill] || 0) + delta));
  });
  state.timeLeft = Math.max(0, state.timeLeft - choiceTimeCost(selected));
  if (scenario.stone) state.stones = Math.min(5, state.stones + 1);
  state.log.push({
    scene: scenario.id,
    skill: scenario.skill,
    choice: selected.label,
    scores: selected.scores,
    timeCost: choiceTimeCost(selected),
    stones: state.stones,
  });
  state.sceneIndex += 1;
  state.result = { scenario, selected };
  state.message = scenario.stone ? "Stone recovered. Find the next glow." : "Decision logged. Find the next glow.";
  showResult();
  updateHud();
}

function showResult() {
  const { scenario, selected } = state.result;
  renderSceneStage(scenario, "result", selected);
  const stoneText = scenario.stone ? "The stone answers your choice and joins the inventory." : "The team adjusts course and keeps moving.";
  dialog.className = "dialog rpg-dialog result-dialog";
  dialog.hidden = false;
  dialog.innerHTML = `
    <div class="speaker-row">
      <div class="portrait">${scenario.stone ? "S" : "!"}</div>
      <div>
        <div class="scene-kicker">Decision resolved</div>
        <h2>${selected.label}</h2>
        <p>${selected.detail}</p>
        <p>${stoneText}</p>
      </div>
    </div>
    <button class="primary continue-button" id="closeResult" type="button">${state.sceneIndex >= scenarios.length ? "Open report" : "Back to map"}</button>
  `;
  document.getElementById("closeResult").addEventListener("click", () => {
    if (state.sceneIndex >= scenarios.length) {
      showReport();
      return;
    }
    state.paused = false;
    state.activeScenario = null;
    state.result = null;
    hideSceneStage();
    dialog.hidden = true;
    dialog.className = "dialog";
  });
}

function showReport() {
  state.paused = true;
  state.activeScenario = null;
  state.result = null;
  hideSceneStage();
  dialog.hidden = false;
  dialog.className = "dialog rpg-dialog report-dialog";
  const ranked = [...skills].sort((a, b) => state.scores[b] - state.scores[a]);
  dialog.innerHTML = `
    <h2>Assessment Report</h2>
    <p>You completed the Verdian Valley scenario chain. The report compares choices before the five-stone milestone and after the mission looked complete.</p>
    <div class="report-grid">
      ${skills.map((skill) => `<div><b>${skill}</b><br>${state.scores[skill]}</div>`).join("")}
    </div>
    <p><b>Strongest signal:</b> ${ranked[0]}. <b>Growth signal:</b> ${ranked[ranked.length - 1]}.</p>
    <button class="primary" id="downloadReport" type="button">Download JSON report</button>
  `;
  document.getElementById("downloadReport").addEventListener("click", () => {
    const payload = {
      title: "Verdian Valley Quest Assessment",
      timeLeft: formatTime(state.timeLeft),
      stones: state.stones,
      scores: state.scores,
      log: state.log,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "verdian-valley-assessment.json";
    link.click();
    URL.revokeObjectURL(url);
  });
  updateHud();
}

function hideSceneStage() {
  sceneStage.hidden = true;
  sceneStage.innerHTML = "";
}

const SPRITES = {
  hero: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/spritesheets/hero/idle/hero-idle-front.png",
  heroAttack: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/spritesheets/hero/attack-weapon/hero-attack-front-weapon.png",
  treant: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/spritesheets/treant/idle/treant-idle-front.png",
  mole: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/spritesheets/mole/idle/mole-idle-front.png",
  gem: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/sprites/misc/gem/gem-1.png",
  waterfall: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/environment/waterfall%20animation/waterfall-1.png",
  rockMonument: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/environment/sliced-objects/rock-monument.png",
  sign: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/environment/sliced-objects/sign.png",
  trunk: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/environment/sliced-objects/trunk.png",
  driedTree: "assets/vendor/tiny-rpg-forest/tiny-RPG-forest-files/PNG/environment/sliced-objects/tree-dried.png",
  pineA: "assets/vendor/stranger-forest/Stranger%20Forest%20Files/props/Pine.png",
  pineB: "assets/vendor/stranger-forest/Stranger%20Forest%20Files/props/PineB.png",
  shack: "assets/vendor/stranger-forest/Stranger%20Forest%20Files/props/ShackA.png",
  logA: "assets/vendor/stranger-forest/Stranger%20Forest%20Files/props/LogA.png",
  plantA: "assets/vendor/stranger-forest/Stranger%20Forest%20Files/props/PlantA.png",
  plantC: "assets/vendor/stranger-forest/Stranger%20Forest%20Files/props/PlantC.png",
};

function stageSprite(src, className, style = "", alt = "") {
  return `<img class="stage-sprite ${className}" src="${src}" alt="${escapeHtml(alt)}" style="${style}">`;
}

function stageLabel(text, style = "") {
  return `<div class="sprite-label" style="${style}">${escapeHtml(text)}</div>`;
}

function renderSceneStage(scenario, phase, selected = null) {
  sceneStage.hidden = false;
  sceneStage.className = `scene-stage scene-${scenario.visual} phase-${phase}`;
  sceneStage.innerHTML = `
    <div class="stage-top">
      <div>
        <div class="scene-kicker">${escapeHtml(scenario.id)} / ${escapeHtml(scenario.skill)}</div>
        <div class="stage-title">${escapeHtml(scenario.location)}</div>
      </div>
      <div class="stage-badges">
        <span>Time Left ${formatTime(state.timeLeft)}</span>
        <span>Stones ${state.stones}/5</span>
        <span>${escapeHtml(scenario.mechanic || "Decision")}</span>
        ${selected ? `<span>${escapeHtml(selected.label)}</span>` : ""}
      </div>
    </div>
    <div class="stage-layout">
      <aside class="stage-panel">
        <div class="stage-face">${escapeHtml(scenario.speaker.slice(0, 1))}</div>
        <div class="stage-stones">${Array.from({ length: 5 }, (_, i) => `<i class="${i < state.stones ? "filled" : ""}"></i>`).join("")}</div>
      </aside>
      <section class="stage-art" aria-label="${escapeHtml(scenario.location)} scene">
        <div class="stage-visual">${stageVisualHtml(scenario)}</div>
      </section>
      <aside class="stage-choice-rail">
        <div class="rail-title">${phase === "choice" ? "Choose Action" : "Inventory / Options"}</div>
        ${scenario.options
          .map(
            (option, index) => `
              <div class="rail-slot ${selected && selected.label === option.label ? "active" : ""}">
                <b>${index + 1}</b>
                <span>${escapeHtml(option.label)}</span>
              </div>
            `,
          )
          .join("")}
      </aside>
    </div>
  `;
}

function stageVisualHtml(scenario) {
  const hero = stageSprite(SPRITES.hero, "actor hero-sprite", "left: 8%; bottom: 18%; --w: 92px;");
  const heroReady = stageSprite(SPRITES.heroAttack, "actor hero-sprite", "left: 13%; bottom: 17%; --w: 108px;");
  const team = `
    ${stageSprite(SPRITES.hero, "actor", "left: 16%; bottom: 22%; --w: 86px;")}
    ${stageSprite(SPRITES.mole, "actor", "left: 45%; bottom: 22%; --w: 82px;")}
    ${stageSprite(SPRITES.treant, "actor", "left: 74%; bottom: 21%; --w: 92px;")}
  `;
  switch (scenario.visual) {
    case "paths":
      return `
        ${stageSprite(SPRITES.pineA, "landmark tall", "left: 8%; bottom: 24%; --w: 150px;")}
        ${stageSprite(SPRITES.rockMonument, "landmark monument", "left: 42%; bottom: 24%; --w: 142px;")}
        ${stageSprite(SPRITES.waterfall, "landmark waterfall", "left: 73%; bottom: 20%; --w: 132px;")}
        ${stageLabel("Tree", "left: 9%; bottom: 16%;")}
        ${stageLabel("Volcano", "left: 39%; bottom: 16%;")}
        ${stageLabel("Waterfall", "left: 71%; bottom: 16%;")}
        ${stageSprite(SPRITES.gem, "stone-glow", "left: 48%; bottom: 55%; --w: 44px;")}
      `;
    case "team":
    case "roles":
    case "conflict":
    case "blame":
      return `
        ${team}
        ${stageLabel("Team 1", "left: 13%; bottom: 13%;")}
        ${stageLabel("Team 2", "left: 42%; bottom: 13%;")}
        ${stageLabel("Team 3", "left: 71%; bottom: 13%;")}
        ${stageSprite(SPRITES.logA, "prop", "left: 18%; bottom: 2%; --w: 92px;")}
        ${stageSprite(SPRITES.shack, "prop shack", "left: 44%; bottom: 0%; --w: 132px;")}
        ${stageSprite(SPRITES.plantC, "prop", "left: 76%; bottom: 5%; --w: 78px;")}
      `;
    case "camp":
      return `
        ${hero}
        <div class="campfire-object stage-object" style="left: 23%; bottom: 24%; transform: scale(1.45);"></div>
        ${stageSprite(SPRITES.shack, "prop shack", "left: 50%; bottom: 15%; --w: 150px;")}
        ${stageSprite(SPRITES.plantA, "prop", "left: 76%; bottom: 24%; --w: 92px;")}
        ${stageLabel("Fire", "left: 18%; bottom: 10%;")}
        ${stageLabel("Shelter", "left: 48%; bottom: 10%;")}
        ${stageLabel("Food", "left: 75%; bottom: 10%;")}
      `;
    case "bridge":
      return `${hero}<div class="bridge-object stage-object sprite-bridge" style="left: 40%; bottom: 24%;"></div>${stageSprite(SPRITES.logA, "prop bridge-log", "left: 47%; bottom: 33%; --w: 160px;")}${stageLabel("Broken Bridge", "left: 48%; bottom: 15%;")}`;
    case "flowers":
      return `
        ${hero}
        ${Array.from({ length: 7 }, (_, i) => stageSprite(i === 4 ? SPRITES.plantC : SPRITES.plantA, `prop flower ${i === 4 ? "bright" : ""}`, `left:${18 + i * 10}%; bottom:${23 + (i % 2) * 9}%; --w:${i === 4 ? 92 : 64}px;`)).join("")}
        ${stageSprite(SPRITES.gem, "stone-glow", "left: 60%; bottom: 43%; --w: 40px;")}
        ${stageLabel("Brightest?", "left: 57%; bottom: 14%;")}
      `;
    case "fallen-tree":
      return `${hero}<div class="bridge-object stage-object sprite-bridge" style="left: 35%; bottom: 22%; transform: rotate(-6deg);"></div>${stageSprite(SPRITES.trunk, "prop fallen", "left: 47%; bottom: 33%; --w: 190px;")}`;
    case "runes":
      return `${hero}<div class="rune-gate-object stage-object" style="left: 42%; bottom: 20%;"></div>${stageSprite(SPRITES.rockMonument, "prop", "left: 58%; bottom: 20%; --w: 92px;")}`;
    case "switches":
      return `${hero}<div class="switch-wall-object stage-object" style="left: 42%; bottom: 20%;"></div>${stageSprite(SPRITES.sign, "prop", "left: 33%; bottom: 19%; --w: 78px;")}`;
    case "storm":
      return `
        ${team}
        ${stageSprite(SPRITES.shack, "prop shack", "left: 48%; bottom: 11%; --w: 150px;")}
        <div class="stage-object" style="left:12%; top:10%; width:70%; height:120px; background:repeating-linear-gradient(115deg, transparent 0 24px, rgba(255,255,255,.8) 25px 29px, transparent 30px 50px);"></div>
      `;
    case "tools":
      return `${hero}<div class="bridge-object stage-object sprite-bridge" style="left: 48%; bottom: 18%;"></div>${stageLabel("Hook + Rope", "left: 26%; bottom: 20%;")}${stageSprite(SPRITES.gem, "stone-glow", "left:70%; bottom:34%; --w: 46px;")}`;
    case "routes":
      return `
        ${stageSprite(SPRITES.rockMonument, "landmark monument", "left: 12%; bottom: 20%; --w: 124px;")}
        ${stageSprite(SPRITES.pineB, "landmark tall", "left: 46%; bottom: 22%; --w: 142px;")}
        <div class="bridge-object stage-object sprite-bridge" style="left: 70%; bottom: 21%; transform: scale(.8);"></div>
        ${stageLabel("Ridge", "left: 12%; bottom: 10%;")}
        ${stageLabel("Valley", "left: 47%; bottom: 10%;")}
        ${stageLabel("Shortcut", "left: 72%; bottom: 10%;")}
      `;
    case "compass":
      return `${hero}${stageSprite(SPRITES.sign, "prop", "left:38%; bottom:27%; --w: 98px;")}${stageLabel("Map", "left:34%; bottom:39%;")}${stageLabel("Compass", "left:60%; bottom:39%;")}`;
    case "foe":
      return `${heroReady}${stageSprite(SPRITES.treant, "actor enemy", "left: 67%; bottom: 20%; --w: 126px;")}${stageLabel("Fight?", "left:66%; bottom:13%;")}`;
    case "trap":
      return `${hero}${stageSprite(SPRITES.driedTree, "landmark willow", "left: 44%; bottom: 18%; --w: 158px;")}${stageSprite(SPRITES.gem, "stone-glow", "left:53%; bottom:48%; --w: 42px;")}${stageLabel("Willow Trap", "left:47%; bottom:15%;")}`;
    case "return":
      return `${team}<div class="altar-object stage-object" style="left:40%; bottom:16%;"></div>${stageSprite(SPRITES.gem, "stone-glow", "left:48%; bottom:40%; --w: 42px;")}`;
    case "altar":
      return `${team}<div class="campfire-object stage-object" style="left: 45%; bottom: 4%; transform: scale(1.7);"></div>${stageSprite(SPRITES.pineA, "landmark tall", "left: 83%; bottom: 18%; --w: 126px;")}`;
    case "fog":
      return `${hero}<div class="fog-object stage-object" style="left:20%; bottom:26%;"></div><div class="fog-object stage-object" style="left:48%; bottom:18%;"></div>${stageSprite(SPRITES.sign, "prop", "left:70%; bottom:18%; --w: 90px;")}`;
    default:
      return `${hero}${stageSprite(SPRITES.pineA, "landmark tall", "left: 55%; bottom: 18%; --w: 140px;")}`;
  }
}

function updateHud() {
  timeBadge.textContent = formatTime(state.timeLeft);
  stoneBadge.textContent = `Stones ${state.stones}/5`;
  objectiveBadge.textContent =
    state.sceneIndex < scenarios.length
      ? `${scenarios[state.sceneIndex].id}: ${scenarios[state.sceneIndex].skill.split("/")[0].trim()}`
      : "Report";
  meters.innerHTML = skills
    .map((skill) => `<span>${skill}: ${state.scores[skill]}</span>`)
    .join("");
}

function formatTime(seconds) {
  const value = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function choiceTimeCost(option) {
  return Math.max(8, Math.round(option.timeCost * 0.12));
}

function tile(col, row, dx, dy) {
  if (!assets.tiles.complete || assets.tiles.naturalWidth === 0) {
    ctx.fillStyle = "#51bd4f";
    ctx.fillRect(dx, dy, TILE, TILE);
    return;
  }
  ctx.drawImage(assets.tiles, col * 16, row * 16, 16, 16, dx, dy, TILE, TILE);
}

function drawWorld() {
  const startCol = Math.floor(state.camera.x / TILE);
  const startRow = Math.floor(state.camera.y / TILE);
  const endCol = Math.ceil((state.camera.x + VIEW_W) / TILE);
  const endRow = Math.ceil((state.camera.y + VIEW_H) / TILE);

  for (let y = startRow; y <= endRow; y += 1) {
    for (let x = startCol; x <= endCol; x += 1) {
      const sx = x * TILE - state.camera.x;
      const sy = y * TILE - state.camera.y;
      grassTile(x, y, sx, sy);
    }
  }

  drawWater();
  drawPath();
  drawGroundDetails(startCol, startRow, endCol, endRow);
  drawForest();
  drawPropsAndMarkers();
}

function grassTile(x, y, sx, sy) {
  const shade = Math.abs((x * 37 + y * 19) % 5);
  const colors = ["#57c95a", "#59cc5b", "#54c456", "#5dce60", "#58ca5a"];
  ctx.fillStyle = colors[shade];
  ctx.fillRect(sx, sy, TILE, TILE);

  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  ctx.fillRect(sx, sy, TILE, TILE / 2);

  if ((x * 11 + y * 7) % 8 === 0) {
    ctx.fillStyle = "rgba(31, 124, 57, 0.36)";
    ctx.fillRect(sx + 7, sy + 20, 3, 8);
    ctx.fillRect(sx + 17, sy + 11, 3, 7);
  }
  if ((x * 5 + y * 13) % 37 === 0) {
    ctx.fillStyle = "#fff0a3";
    ctx.fillRect(sx + 22, sy + 18, 3, 3);
    ctx.fillStyle = "#ff95c8";
    ctx.fillRect(sx + 25, sy + 15, 3, 3);
  }
}

function drawPath() {
  ctx.fillStyle = "#b98135";
  const points = [
    [5, 24],
    [8, 20],
    [13, 17],
    [18, 19],
    [23, 18],
    [28, 13],
    [35, 11],
    [38, 16],
    [34, 22],
    [24, 25],
    [14, 24],
    [6, 24],
  ].map(([x, y]) => [x * TILE + TILE / 2 - state.camera.x, y * TILE + TILE / 2 - state.camera.y]);
  ctx.lineWidth = 42;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawWater() {
  drawPond(33 * TILE - state.camera.x, 6 * TILE - state.camera.y, 140, 78);
  drawPond(12 * TILE - state.camera.x, 11 * TILE - state.camera.y, 104, 70);
}

function drawPond(x, y, w, h) {
  ctx.fillStyle = "#c58635";
  drawBlob(x, y + 6, w + 18, h + 12);
  ctx.fillStyle = "#1aa4c7";
  drawBlob(x, y, w, h);
  ctx.fillStyle = "rgba(183, 245, 255, 0.7)";
  for (let i = -2; i < 4; i += 1) {
    ctx.fillRect(x + i * 26 - 18, y + ((i + 3) % 2) * 14 - 8, 20, 3);
  }
  ctx.fillStyle = "rgba(23, 112, 139, 0.35)";
  drawBlob(x + w * 0.28, y + h * 0.12, 16, 7);
}

function drawBlob(x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGroundDetails(startCol, startRow, endCol, endRow) {
  for (let y = startRow; y <= endRow; y += 1) {
    for (let x = startCol; x <= endCol; x += 1) {
      if ((x * 23 + y * 31) % 17 !== 0) continue;
      const sx = x * TILE - state.camera.x + 7;
      const sy = y * TILE - state.camera.y + 12;
      drawSmallProp(sx, sy, (x + y) % 4);
    }
  }
}

function drawSmallProp(x, y, variant) {
  const img = [assets.plant1, assets.plant2, assets.plantA, assets.rockA][variant];
  if (img && img.complete && img.naturalWidth > 0) {
    const scale = variant === 3 ? 0.75 : 1.25;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    return;
  }
  ctx.fillStyle = variant === 3 ? "#7f7c68" : "#257d3a";
  ctx.fillRect(x, y, 12, 8);
}

function drawForest() {
  const trees = [
    [2, 2],
    [5, 4],
    [10, 3],
    [15, 4],
    [22, 3],
    [30, 3],
    [39, 3],
    [4, 13],
    [40, 9],
    [39, 22],
    [33, 26],
    [18, 27],
    [3, 27],
  ];
  trees.forEach(([x, y], i) => drawTree(x * TILE - state.camera.x, y * TILE - state.camera.y, i));
}

function drawTree(x, y, variant = 0) {
  const img = variant % 2 ? assets.pineB : assets.pine;
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x - 6, y - 28, 96, 168);
    return;
  }
  ctx.fillStyle = "#7b4a24";
  ctx.fillRect(x + 30, y + 52, 20, 44);
  ctx.fillStyle = "#0f6b32";
  drawBlob(x + 40, y + 35, 46, 44);
}

function drawPropsAndMarkers() {
  drawBuilding(5 * TILE - state.camera.x, 22 * TILE - state.camera.y);
  drawBuilding(34 * TILE - state.camera.x, 9 * TILE - state.camera.y);

  objectives.forEach((objective) => {
    if (objective.index < state.sceneIndex) drawCompletedMarker(objective);
  });
  const objective = objectives[state.sceneIndex];
  if (objective) drawActiveMarker(objective, scenarios[state.sceneIndex]);

  drawNpc(12 * TILE - state.camera.x, 18 * TILE - state.camera.y, "Guide");
  drawNpc(30 * TILE - state.camera.x, 14 * TILE - state.camera.y, "Team");
  drawEnemy(25 * TILE - state.camera.x, 23 * TILE - state.camera.y);
}

function drawActiveMarker(objective, scenario) {
  const x = objective.x - state.camera.x;
  const y = objective.y - state.camera.y;
  if (x < -96 || x > VIEW_W + 96 || y < -96 || y > VIEW_H + 96) return;
  const pulse = Math.floor(performance.now() / 180) % 2;
  drawPixelShadow(x, y + 18, 52, 12);
  ctx.fillStyle = "#8c5b2b";
  ctx.fillRect(x - 24, y + 4, 48, 28);
  ctx.fillStyle = "#6f4524";
  ctx.fillRect(x - 16, y + 32, 32, 15);
  ctx.fillStyle = "#e9cd63";
  ctx.fillRect(x - 18, y - 12, 36, 24);
  ctx.fillStyle = "#fff6a1";
  ctx.fillRect(x - 12, y - 8, 24, 16);
  drawPixelGem(x, y - 6, false);
  ctx.fillStyle = pulse ? "#fff6a1" : "#f5bd43";
  ctx.fillRect(x - 36, y - 44, 72, 22);
  ctx.fillStyle = "#49331f";
  ctx.fillRect(x - 32, y - 40, 64, 14);
  ctx.fillStyle = "#fffbe8";
  ctx.font = "14px MaruMinya, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`S${objective.index + 1}`, x, y - 28);
  if (scenario?.stone) {
    ctx.fillStyle = "#2ce4ff";
    ctx.fillRect(x + 22, y - 21, 8, 8);
    ctx.fillRect(x + 26, y - 17, 8, 8);
  }
}

function drawCompletedMarker(objective) {
  const x = objective.x - state.camera.x;
  const y = objective.y - state.camera.y;
  if (x < -48 || x > VIEW_W + 48 || y < -48 || y > VIEW_H + 48) return;
  drawPixelShadow(x, y + 12, 30, 8);
  ctx.fillStyle = "#6f7862";
  ctx.fillRect(x - 13, y, 26, 14);
  ctx.fillStyle = "#9aa081";
  ctx.fillRect(x - 9, y - 9, 18, 12);
  drawPixelGem(x, y - 11, true);
}

function drawPixelGem(x, y, collected) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.globalAlpha = collected ? 0.45 : 1;
  ctx.fillStyle = collected ? "#9eeeff" : "#fff6a1";
  ctx.fillRect(-6, -10, 12, 8);
  ctx.fillStyle = collected ? "#31bcd8" : "#ff3eb5";
  ctx.fillRect(-10, -2, 20, 10);
  ctx.fillStyle = collected ? "#167b9f" : "#b20d7d";
  ctx.fillRect(-6, 8, 12, 8);
  ctx.fillStyle = "#fffbe8";
  ctx.fillRect(-2, -7, 7, 13);
  ctx.restore();
}

function drawPixelShadow(x, y, w, h) {
  ctx.fillStyle = "rgba(24, 36, 31, 0.24)";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, h);
}

function drawScenarioSetPiece(objective, scenario) {
  if (!scenario) return;
  const x = objective.x - state.camera.x;
  const y = objective.y - state.camera.y;
  if (x < -160 || x > VIEW_W + 160 || y < -160 || y > VIEW_H + 160) return;
  const active = objective.index === state.sceneIndex;
  ctx.save();
  ctx.globalAlpha = objective.index < state.sceneIndex ? 0.42 : 1;
  switch (scenario.visual) {
    case "paths":
      drawPathFork(x, y);
      break;
    case "camp":
      drawCampfire(x, y);
      break;
    case "bridge":
      drawBridgeScene(x, y);
      break;
    case "flowers":
      drawFlowerPuzzle(x, y);
      break;
    case "roles":
    case "team":
    case "conflict":
    case "blame":
      drawTeamCircle(x, y, scenario.visual);
      break;
    case "fallen-tree":
      drawFallenTree(x, y);
      break;
    case "runes":
      drawRuneGate(x, y);
      break;
    case "switches":
      drawSwitchWall(x, y);
      break;
    case "storm":
      drawStormShelter(x, y);
      break;
    case "tools":
      drawToolShore(x, y);
      break;
    case "routes":
      drawRouteSigns(x, y);
      break;
    case "compass":
      drawCompassMap(x, y);
      break;
    case "foe":
      drawEnemy(x, y);
      break;
    case "trap":
      drawWindTrap(x, y);
      break;
    case "return":
    case "altar":
      drawStoneAltar(x, y);
      break;
    case "fog":
      drawFogBank(x, y);
      break;
    default:
      drawMarkerShadow(x, y);
  }
  if (active) drawSetPieceLabel(x, y - 54, scenario.location);
  ctx.restore();
}

function drawPathFork(x, y) {
  ctx.strokeStyle = "#8c5b2b";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  [[-54, -24], [0, -58], [54, -24]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + 26);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  });
  drawSign(x - 66, y - 32, "R");
  drawSign(x, y - 68, "F");
  drawSign(x + 66, y - 32, "S");
}

function drawSign(x, y, text) {
  ctx.fillStyle = "#7a4724";
  ctx.fillRect(x - 2, y + 10, 4, 24);
  ctx.fillStyle = "#e8b75a";
  ctx.fillRect(x - 12, y, 24, 16);
  ctx.strokeStyle = "#49331f";
  ctx.strokeRect(x - 12, y, 24, 16);
  ctx.fillStyle = "#49331f";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 12);
}

function drawCampfire(x, y) {
  ctx.fillStyle = "#65401f";
  ctx.fillRect(x - 28, y + 18, 56, 9);
  ctx.fillStyle = "#ff7a23";
  drawBlob(x, y + 4, 18, 24);
  ctx.fillStyle = "#ffd75b";
  drawBlob(x, y, 10, 16);
  drawSmallProp(x - 58, y + 8, 1);
  drawSmallProp(x + 42, y + 10, 2);
}

function drawBridgeScene(x, y) {
  ctx.fillStyle = "#1aa4c7";
  ctx.fillRect(x - 70, y - 22, 140, 44);
  ctx.fillStyle = "#9b642d";
  ctx.fillRect(x - 62, y - 8, 48, 14);
  ctx.fillRect(x + 18, y - 8, 48, 14);
  ctx.strokeStyle = "#5b321d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 5);
  ctx.lineTo(x + 10, y + 8);
  ctx.stroke();
}

function drawFlowerPuzzle(x, y) {
  for (let i = 0; i < 5; i += 1) {
    const dx = (i - 2) * 24;
    ctx.fillStyle = i === 3 ? "#fff27d" : "#ff8dc7";
    drawBlob(x + dx, y + Math.sin(i) * 8, i === 3 ? 10 : 6, i === 3 ? 10 : 6);
    ctx.fillStyle = "#206f31";
    ctx.fillRect(x + dx - 1, y + 8, 3, 16);
  }
}

function drawTeamCircle(x, y, kind) {
  const labels = kind === "roles" ? ["F", "S", "C"] : ["A", "B", "C"];
  labels.forEach((label, i) => {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const px = x + Math.cos(angle) * 32;
    const py = y + Math.sin(angle) * 22;
    ctx.fillStyle = "#fff6d8";
    drawBlob(px, py - 10, 10, 10);
    ctx.fillStyle = "#405f8f";
    ctx.fillRect(px - 8, py, 16, 20);
    drawLabel(px, py - 22, label);
  });
}

function drawFallenTree(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  ctx.fillStyle = "#744721";
  ctx.fillRect(-70, -10, 140, 20);
  ctx.fillStyle = "#3b8b3b";
  drawBlob(-62, -10, 28, 24);
  drawBlob(62, 8, 26, 22);
  ctx.restore();
}

function drawRuneGate(x, y) {
  ctx.fillStyle = "#6d6a60";
  ctx.fillRect(x - 58, y - 46, 24, 70);
  ctx.fillRect(x + 34, y - 46, 24, 70);
  ctx.fillRect(x - 58, y - 46, 116, 20);
  ["○", "△", "○", "?"].forEach((rune, i) => {
    ctx.fillStyle = "#fff6d8";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rune, x - 36 + i * 24, y - 31);
  });
}

function drawSwitchWall(x, y) {
  ctx.fillStyle = "#777267";
  ctx.fillRect(x - 58, y - 36, 116, 66);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.fillStyle = "#e6d395";
      ctx.fillRect(x - 40 + col * 32, y - 20 + row * 24, 18, 14);
    }
  }
}

function drawStormShelter(x, y) {
  drawBuilding(x - 56, y - 38);
  ctx.strokeStyle = "rgba(232, 246, 255, 0.9)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 68 + i * 32, y - 72);
    ctx.lineTo(x - 86 + i * 32, y - 30);
    ctx.stroke();
  }
}

function drawToolShore(x, y) {
  ctx.fillStyle = "#1aa4c7";
  ctx.fillRect(x - 70, y, 140, 34);
  drawTinyGem(x + 42, y + 14, false);
  drawSign(x - 52, y - 22, "R");
  ctx.strokeStyle = "#49331f";
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 10);
  ctx.lineTo(x + 16, y - 2);
  ctx.stroke();
}

function drawRouteSigns(x, y) {
  drawSign(x - 42, y - 10, "R");
  drawSign(x, y - 34, "V");
  drawSign(x + 42, y - 10, "M");
}

function drawCompassMap(x, y) {
  ctx.fillStyle = "#fff6d8";
  ctx.fillRect(x - 52, y - 26, 44, 36);
  ctx.fillRect(x + 10, y - 28, 42, 42);
  ctx.strokeStyle = "#49331f";
  ctx.strokeRect(x - 52, y - 26, 44, 36);
  ctx.strokeRect(x + 10, y - 28, 42, 42);
  ctx.beginPath();
  ctx.moveTo(x + 31, y - 22);
  ctx.lineTo(x + 41, y - 7);
  ctx.lineTo(x + 20, y - 9);
  ctx.closePath();
  ctx.stroke();
}

function drawWindTrap(x, y) {
  ctx.strokeStyle = "#d8f6ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 42, 0.4, Math.PI * 1.6);
  ctx.stroke();
  drawSign(x, y - 12, "!");
}

function drawStoneAltar(x, y) {
  ctx.fillStyle = "#7b756a";
  ctx.fillRect(x - 44, y - 12, 88, 28);
  ctx.fillStyle = "#5f5a52";
  ctx.fillRect(x - 28, y - 38, 56, 28);
  for (let i = 0; i < 5; i += 1) {
    drawTinyGem(x - 38 + i * 19, y - 40, i < state.stones);
  }
}

function drawFogBank(x, y) {
  ctx.fillStyle = "rgba(237, 250, 238, 0.72)";
  drawBlob(x - 35, y - 10, 54, 24);
  drawBlob(x + 20, y + 4, 64, 28);
  drawBlob(x + 54, y - 12, 42, 22);
}

function drawSetPieceLabel(x, y, label) {
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  const width = ctx.measureText(label).width + 18;
  ctx.fillStyle = "rgba(255, 246, 216, 0.92)";
  ctx.fillRect(x - width / 2, y - 16, width, 21);
  ctx.strokeStyle = "#49331f";
  ctx.strokeRect(x - width / 2, y - 16, width, 21);
  ctx.fillStyle = "#18241f";
  ctx.fillText(label, x, y);
}

function drawBuilding(x, y) {
  if (assets.shack.complete && assets.shack.naturalWidth > 0) {
    ctx.drawImage(assets.shack, x - 6, y - 4, 134, 115);
    return;
  }
  ctx.fillStyle = "#7b4422";
  ctx.fillRect(x, y + 30, 100, 80);
  ctx.fillStyle = "#b95f2f";
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 36);
  ctx.lineTo(x + 50, y - 20);
  ctx.lineTo(x + 112, y + 36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#41291f";
  ctx.fillRect(x + 38, y + 70, 24, 40);
  ctx.fillStyle = "#f4b738";
  ctx.fillRect(x + 70, y + 48, 18, 18);
}

function drawTinyGem(x, y, collected) {
  if (assets.gem.complete && assets.gem.naturalWidth > 0) {
    const frameW = assets.gem.width / 4;
    const frameH = assets.gem.height;
    const frame = collected ? 3 : Math.floor(performance.now() / 180) % 4;
    ctx.globalAlpha = collected ? 0.45 : 1;
    ctx.drawImage(assets.gem, frame * frameW, 0, frameW, frameH, x - 14, y - 26, 28, 28);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = collected ? "#8ad7ff" : "#ffe24a";
    ctx.fillRect(x - 9, y - 18, 18, 18);
  }
}

function drawGlow(x, y) {
  const pulse = 0.5 + Math.sin(performance.now() / 180) * 0.25;
  ctx.fillStyle = `rgba(255, 235, 72, ${pulse})`;
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 38, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff5a6";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawMarkerShadow(x, y) {
  ctx.fillStyle = "rgba(20, 70, 30, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNpc(x, y, label) {
  if (assets.mole.complete) {
    ctx.drawImage(assets.mole, 0, 0, 24, 24, x - 18, y - 24, 48, 48);
  } else {
    ctx.fillStyle = "#794c2e";
    ctx.fillRect(x - 10, y - 24, 20, 30);
  }
  drawLabel(x, y - 36, label);
}

function drawEnemy(x, y) {
  if (assets.treant.complete) {
    ctx.drawImage(assets.treant, 0, 0, 32, 32, x - 28, y - 40, 64, 64);
  }
}

function drawLabel(x, y, label) {
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  const width = ctx.measureText(label).width + 14;
  ctx.fillStyle = "rgba(255, 246, 216, 0.9)";
  ctx.fillRect(x - width / 2, y - 16, width, 20);
  ctx.strokeStyle = "#49331f";
  ctx.strokeRect(x - width / 2, y - 16, width, 20);
  ctx.fillStyle = "#18241f";
  ctx.fillText(label, x, y - 2);
}

function drawPlayer() {
  const p = state.player;
  const screenX = Math.round(p.x - state.camera.x);
  const screenY = Math.round(p.y - state.camera.y);
  const moving = p.moving;
  let sheet = assets.heroIdleFront;
  if (p.dir === "back") sheet = assets.heroBack;
  if (p.dir === "side") sheet = assets.heroSide;
  if (p.dir === "front" && moving) sheet = assets.heroFront;
  if (sheet.complete && sheet.naturalWidth > 0) {
    const frameCount = p.dir === "front" && !moving ? 4 : 6;
    const frameW = sheet.width / frameCount;
    const frameH = sheet.height;
    const frameIndex = moving ? Math.floor(performance.now() / 120) % frameCount : 0;
    ctx.save();
    if (p.flip) {
      ctx.translate(screenX, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frameIndex * frameW, 0, frameW, frameH, -20, screenY - 46, 40, 46);
    } else {
      ctx.drawImage(sheet, frameIndex * frameW, 0, frameW, frameH, screenX - 20, screenY - 46, 40, 46);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#2c5f34";
    ctx.fillRect(screenX - 10, screenY - 30, 20, 30);
  }
}

function drawOverlayText() {
  if (state.message) {
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(state.message).width + 30;
    ctx.fillStyle = "rgba(255, 246, 216, 0.92)";
    ctx.fillRect(VIEW_W / 2 - w / 2, 22, w, 36);
    ctx.strokeStyle = "#49331f";
    ctx.lineWidth = 3;
    ctx.strokeRect(VIEW_W / 2 - w / 2, 22, w, 36);
    ctx.fillStyle = "#18241f";
    ctx.fillText(state.message, VIEW_W / 2, 46);
  }

  const objective = objectives[state.sceneIndex];
  if (objective && !state.paused) {
    const dx = objective.x - state.player.x;
    const dy = objective.y - state.player.y;
    const near = Math.hypot(dx, dy) < 54;
    if (near) {
      ctx.font = "19px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 240, 148, 0.95)";
      ctx.fillRect(VIEW_W / 2 - 150, VIEW_H - 70, 300, 40);
      ctx.strokeStyle = "#49331f";
      ctx.strokeRect(VIEW_W / 2 - 150, VIEW_H - 70, 300, 40);
      ctx.fillStyle = "#18241f";
      ctx.fillText("E", VIEW_W / 2, VIEW_H - 43);
    }
  }
}

function update(dt) {
  if (!state.started || state.paused) return;
  if (!tickTimer(dt)) return;
  let dx = 0;
  let dy = 0;
  if (state.keys.ArrowLeft || state.keys.KeyA) dx -= 1;
  if (state.keys.ArrowRight || state.keys.KeyD) dx += 1;
  if (state.keys.ArrowUp || state.keys.KeyW) dy -= 1;
  if (state.keys.ArrowDown || state.keys.KeyS) dy += 1;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;
  const speed = 150;
  state.player.moving = Boolean(dx || dy);
  if (dx < 0) {
    state.player.dir = "side";
    state.player.flip = true;
  } else if (dx > 0) {
    state.player.dir = "side";
    state.player.flip = false;
  } else if (dy < 0) {
    state.player.dir = "back";
  } else if (dy > 0) {
    state.player.dir = "front";
  }
  const nx = clamp(state.player.x + dx * speed * dt, 40, WORLD_W - 40);
  const ny = clamp(state.player.y + dy * speed * dt, 60, WORLD_H - 34);
  if (!blocked(nx, state.player.y)) state.player.x = nx;
  if (!blocked(state.player.x, ny)) state.player.y = ny;
  state.camera.x = clamp(state.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  state.camera.y = clamp(state.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  if (state.message && performance.now() % 5000 < 20) state.message = "";
  updateHud();
}

function tickTimer(dt) {
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0) {
    audio.cue("warning");
    state.message = "Time is up.";
    showReport();
    return false;
  }
  updateHud();
  const timeChip = sceneStage.querySelector(".stage-badges span:first-child");
  if (timeChip) timeChip.textContent = `Time Left ${formatTime(state.timeLeft)}`;
  return true;
}

function blocked(x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 1 || ty < 1 || tx > MAP_W - 2 || ty > MAP_H - 2) return true;
  return false;
}

function interact() {
  if (!state.started) return;
  if (state.paused) return;
  const objective = objectives[state.sceneIndex];
  if (!objective) {
    showReport();
    return;
  }
  if (Math.hypot(objective.x - state.player.x, objective.y - state.player.y) < 62) {
    showScenario();
  } else {
    state.message = "Find the glowing marker first.";
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawWorld();
  drawPlayer();
  drawOverlayText();
}

function loop(now) {
  const dt = Math.min(0.05, (now - state.last) / 1000);
  state.last = now;
  if (state.started && state.paused && state.activeScenario) tickTimer(dt);
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  state.keys[event.code] = true;
  if (event.code === "KeyE" || event.code === "Space") {
    event.preventDefault();
    if (!dialog.hidden && state.activeScenario && !dialog.querySelector("[data-choice]")) {
      const button = document.querySelector(".continue-button");
      if (button) button.click();
      return;
    }
    interact();
  }
  if (!dialog.hidden && /^Digit[123]$/.test(event.code)) {
    const button = dialog.querySelector(`[data-choice="${Number(event.code.slice(-1)) - 1}"]`);
    if (button) button.click();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys[event.code] = false;
});

document.querySelectorAll("[data-move]").forEach((button) => {
  const keyFor = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  };
  const key = keyFor[button.dataset.move];
  button.addEventListener("pointerdown", () => {
    state.keys[key] = true;
  });
  button.addEventListener("pointerup", () => {
    state.keys[key] = false;
  });
  button.addEventListener("pointerleave", () => {
    state.keys[key] = false;
  });
});

document.querySelector("[data-action='interact']").addEventListener("click", interact);
soundButton.addEventListener("click", () => audio.toggle());
restartButton.addEventListener("click", reset);

window.__verdianDebug = {
  state,
  objectives,
  scenarios,
  interact,
  resolveScenario,
  showReport,
  blocked,
};

reset();
requestAnimationFrame(loop);
