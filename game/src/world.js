// Skylark Courier — the world: terrain height, island strips, rings, clouds
// and storms. Terrain is a seeded smooth curve with island bumps at the
// strips, so the runway always sits on flat, landable ground.

import { STRIPS, RINGS, STORMS, WORLD_W } from './config.js';
import { makeNoise, mulberry32, clamp } from './random.js';

export function createWorld(seed) {
  const noise = makeNoise(seed);
  const rnd = mulberry32(seed ^ 0x9e3779b9);

  // Island bumps: a raised plateau around each strip so the runway is flat.
  const bumps = Object.values(STRIPS).map((s) => ({ x: s.x, w: s.w * 2.4, h: s.h }));

  function terrainHeight(x) {
    if (x < 0 || x > WORLD_W) return 0;
    let h = 40 + noise(x) * 55;
    // Rolling hills grow taller toward the middle of the map.
    h += Math.sin((x / WORLD_W) * Math.PI) * 60;
    for (const b of bumps) {
      const d = Math.abs(x - b.x) / (b.w / 2);
      if (d < 1) h = Math.max(h, b.h * (1 - d * d) + 10);
    }
    return Math.max(0, h);
  }

  function stripAt(x) {
    for (const [id, s] of Object.entries(STRIPS)) {
      if (Math.abs(x - s.x) <= s.w / 2) return { id, ...s };
    }
    return null;
  }

  function isSea(x) {
    return terrainHeight(x) <= 2;
  }

  // Clouds drift slowly east; storms drift too, and slowly pulse.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: rnd() * WORLD_W,
      alt: 900 + rnd() * 1800,
      s: 90 + rnd() * 160,
      speed: 6 + rnd() * 10,
      shade: 0.75 + rnd() * 0.25,
    });
  }

  const storms = STORMS.map((s) => ({ ...s, phase: rnd() * Math.PI * 2, flash: 0 }));

  const rings = RINGS.map((r) => ({ ...r, passed: false, glow: 0 }));

  const parcels = []; // falling parcels: {x, alt, vy, state}

  function update(dt, time) {
    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x > WORLD_W + 400) c.x = -400;
    }
    for (const s of storms) {
      s.x += 4 * dt;
      if (s.x > WORLD_W + 300) s.x = -300;
      s.flash = Math.max(0, s.flash - dt * 2);
      if (rnd() < dt * 0.06) s.flash = 1;
    }
    for (const p of parcels) {
      if (p.state !== 'falling') continue;
      p.vy += 260 * dt;
      p.alt -= p.vy * dt;
      const ground = terrainHeight(p.x);
      if (p.alt <= ground) {
        p.alt = ground;
        p.state = 'landed';
      }
    }
    for (const r of rings) r.glow = Math.max(0, r.glow - dt * 1.5);
  }

  return {
    seed,
    terrainHeight,
    stripAt,
    isSea,
    clouds,
    storms,
    rings,
    parcels,
    update,
    worldWidth: WORLD_W,
    clampX: (x) => clamp(x, 0, WORLD_W),
  };
}
