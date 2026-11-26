// Skylark Courier — the game loop: states, missions, scoring, parcels and
// the win/lose endings. One sortie follows the next; the run ends when the
// Dawn Runner lands home or the sky wins.

import { VIEW_W, VIEW_H, MISSIONS, SCORE_DELIVERY, SCORE_RING, SCORE_LANDING, SCORE_FUEL_BONUS_PER_PCT, FUEL_START, HULL_START } from './config.js';
import { createWorld } from './world.js';
import { createPlane, stepPlane, dropParcel } from './physics.js';
import { createInput, createEdgeTracker } from './input.js';
import { createAudio } from './audio.js';
import { createCamera, updateCamera, drawScene } from './render.js';
import { parseShot, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const SEED = 20261126;

const world = createWorld(SEED);
const input = createInput(canvas);
const edges = createEdgeTracker(input);
const audio = createAudio();
const cam = createCamera();

const game = {
  world,
  plane: createPlane(),
  cam,
  state: 'title', // title | fly | paused | crashed | won
  time: 0,
  timeLeft: 480, // seconds for the whole run
  score: 0,
  best: Number(window.localStorage?.getItem('skylark-best') || 0),
  missionIndex: 0,
  missions: MISSIONS.map((m) => ({ ...m, done: 0, total: m.targets.length })),
  mission: null,
  messages: [],
  stalling: false,
  crashReason: '',
  scoreParts: { deliveries: 0, rings: 0, landing: 0, fuelBonus: 0 },
  titleButton: { label: 'FLY', rect: null, hover: false },
  resumeButton: { label: 'RESUME', rect: null, hover: false },
  retryButton: { label: 'FLY AGAIN', rect: null, hover: false },
};
game.mission = game.missions[0];

function banner(text, color = '#ffffff') {
  game.messages.push({ text, life: 3.2, color });
  if (game.messages.length > 3) game.messages.shift();
}

function startRun() {
  game.plane = createPlane();
  game.plane.fuel = FUEL_START;
  game.plane.hull = HULL_START;
  game.score = 0;
  game.scoreParts = { deliveries: 0, rings: 0, landing: 0, fuelBonus: 0 };
  game.timeLeft = 480;
  game.missionIndex = 0;
  game.missions = MISSIONS.map((m) => ({ ...m, done: 0, total: m.targets.length }));
  game.mission = game.missions[0];
  game.messages = [];
  game.crashReason = '';
  world.rings.forEach((r) => {
    r.passed = false;
    r.glow = 0;
  });
  world.parcels.length = 0;
  game.state = 'fly';
  audio.unlock();
  audio.click();
  banner('SORTIE 1 — FIRST LIGHT', '#ffd24a');
}

function endRun(won, reason) {
  if (won) {
    game.state = 'won';
    game.scoreParts.fuelBonus = Math.round(game.plane.fuel * SCORE_FUEL_BONUS_PER_PCT);
    game.score += game.scoreParts.fuelBonus;
  } else {
    game.state = 'crashed';
    game.crashReason = reason || 'The sky wins this round.';
    audio.crash();
  }
  if (game.score > game.best) {
    game.best = game.score;
    try {
      window.localStorage.setItem('skylark-best', String(game.best));
    } catch {
      // Private mode: the best score simply does not persist.
    }
  }
}

function advanceMission() {
  game.missionIndex += 1;
  if (game.missionIndex >= game.missions.length) return;
  game.mission = game.missions[game.missionIndex];
  banner(game.mission.name.toUpperCase(), '#ffd24a');
  banner(game.mission.goal, '#ffffff');
}

function checkParcels() {
  for (const p of world.parcels) {
    if (p.state !== 'landed' || p.checked) continue;
    p.checked = true;
    const strip = world.stripAt(p.x);
    if (game.mission.id === 'parcels' && strip && (strip.id === 'strip-a' || strip.id === 'strip-b')) {
      const target = strip.id;
      if (!game.mission.targetsDone) game.mission.targetsDone = new Set();
      if (!game.mission.targetsDone.has(target)) {
        game.mission.targetsDone.add(target);
        game.mission.done += 1;
        game.score += SCORE_DELIVERY;
        game.scoreParts.deliveries += SCORE_DELIVERY;
        audio.delivery();
        banner(`PARCEL DELIVERED — ${strip.label}  +${SCORE_DELIVERY}`, '#7be07b');
        if (game.mission.done >= game.mission.total) advanceMission();
      }
    } else if (strip) {
      banner('Parcel down on the strip — but no delivery needed here', '#cfe3ee');
    } else {
      banner('Parcel lost — in the drink!', '#ff9d7a');
    }
  }
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'ring') {
      game.score += SCORE_RING;
      game.scoreParts.rings += SCORE_RING;
      game.mission.done += 1;
      audio.ring();
      banner(`RING ${game.mission.done} OF ${game.mission.total}  +${SCORE_RING}`, '#ffd24a');
      if (game.mission.done >= game.mission.total) advanceMission();
    } else if (e.type === 'landed') {
      audio.land();
      if (game.mission.id === 'home' && e.strip === 'strip_home') {
        game.score += SCORE_LANDING;
        game.scoreParts.landing += SCORE_LANDING;
        game.mission.done = 1;
        banner(`WHEELS DOWN — HOME  +${SCORE_LANDING}`, '#7be07b');
        endRun(true);
      } else if (e.strip) {
        game.plane.fuel = 100;
        banner(`LANDED — ${e.strip.toUpperCase().replace('_', ' ')} — FUEL TOPPED UP`, '#7be07b');
      }
    } else if (e.type === 'hardLanding') {
      banner(`HARD LANDING — HULL -${Math.round(e.damage)}`, '#ff9d7a');
    } else if (e.type === 'crash') {
      endRun(false, e.reason);
    } else if (e.type === 'flameout') {
      banner('FUEL EMPTY — GLIDE HER DOWN', '#ff6b4d');
    } else if (e.type === 'takeoff') {
      banner('AIRBORNE', '#cfe3ee');
    }
  }
}

function inRect(p, r) {
  return r && p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function update(dt) {
  game.time += dt;
  for (const m of game.messages) m.life -= dt;
  game.messages = game.messages.filter((m) => m.life > 0);

  const click = edges.click();
  const hover = { x: input.mouseX, y: input.mouseY };

  if (edges.pressed('mute')) {
    const muted = audio.toggleMute();
    banner(muted ? 'SOUND OFF' : 'SOUND ON', '#cfe3ee');
  }

  if (game.state === 'title') {
    game.titleButton.hover = inRect(hover, game.titleButton.rect);
    if (edges.pressed('confirm') || (click && inRect(click, game.titleButton.rect))) startRun();
    return;
  }
  if (game.state === 'paused') {
    game.resumeButton.hover = inRect(hover, game.resumeButton.rect);
    if (edges.pressed('pause') || (click && inRect(click, game.resumeButton.rect))) {
      game.state = 'fly';
      audio.click();
    }
    return;
  }
  if (game.state === 'crashed' || game.state === 'won') {
    game.retryButton.hover = inRect(hover, game.retryButton.rect);
    if (edges.pressed('restart') || (click && inRect(click, game.retryButton.rect))) startRun();
    return;
  }

  // Flying.
  if (edges.pressed('pause')) {
    game.state = 'paused';
    return;
  }
  if (edges.pressed('restart')) {
    startRun();
    return;
  }

  const held = {
    pitchUp: input.keys.has('pitchUp'),
    pitchDown: input.keys.has('pitchDown'),
    throttleUp: input.keys.has('throttleUp'),
    throttleDown: input.keys.has('throttleDown'),
  };
  game.stalling = !game.plane.onGround && game.plane.speed < 92 && game.plane.throttle > 0.2;

  const events = stepPlane(game.plane, held, world, game.mission, dt);
  handleEvents(events);
  world.update(dt, game.time);
  checkParcels();

  if (edges.pressed('drop') || click) {
    const parcel = dropParcel(game.plane, world);
    if (parcel) {
      audio.click();
      banner('PARCEL AWAY', '#cfe3ee');
    }
  }

  game.timeLeft -= dt;
  if (game.timeLeft <= 0 && game.state === 'fly') {
    endRun(false, 'Out of time — the sun set on the run.');
  }
  if (game.plane.hull <= 0 && game.state === 'fly') {
    endRun(false, game.crashReason || 'Airframe gave out.');
  }

  audio.engine(game.plane.throttle, !game.plane.onGround);
  updateCamera(cam, game.plane, dt);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  drawScene(ctx, game);
  requestAnimationFrame(frame);
}

// Screenshot mode: arrange one composed frame, then render normally.
const shot = parseShot();
if (shot) {
  applyShot(game, shot);
  // The play shot already flew 420 scripted steps; keep the loop running so
  // the frame settles exactly as arranged.
}
requestAnimationFrame(frame);
