// Skylark Courier — deterministic screenshot scenes. Loading the game with
// ?shot=start|play|end&seed=N arranges one composed frame of the real game
// (no mock scene, no separate art) so the screenshots are renders of the
// game's own code.

import { stepPlane, createPlane } from './physics.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { shot, seed: Number(q.get('seed') || 7) };
}

// Arrange the game for a screenshot, then let the normal loop render it.
export function applyShot(game, shot) {
  const { plane, world } = game;
  if (shot.shot === 'start') {
    game.state = 'title';
    plane.x = 320;
    plane.alt = world.terrainHeight(320) + 2;
    plane.onGround = true;
    plane.throttle = 0;
    plane.speed = 0;
    game.cam.alt = plane.alt;
    game.cam.x = plane.x;
    return;
  }
  if (shot.shot === 'play') {
    // Fly the second sortie for a while with a scripted hand so the frame
    // shows the plane mid-flight low over the islands, a ring just ahead,
    // terrain and sea below, HUD lit.
    game.state = 'fly';
    game.missionIndex = 1;
    game.mission = game.missions[1];
    game.mission.done = 2;
    game.scoreParts.rings = 300;
    plane.x = 4300;
    plane.alt = 650;
    plane.speed = 170;
    plane.throttle = 0.75;
    plane.pitch = 4;
    plane.onGround = false;
    plane.fuel = 68;
    plane.hull = 92;
    game.score = 1300;
    game.timeLeft = 342;
    const scripted = { pitchUp: false, pitchDown: false, throttleUp: false, throttleDown: false };
    for (let i = 0; i < 140; i += 1) {
      scripted.pitchUp = Math.sin(i / 55) > 0.2;
      scripted.pitchDown = Math.sin(i / 55) < -0.2;
      stepPlane(plane, scripted, world, game.mission, 1 / 60);
      world.update(1 / 60, i / 60);
    }
    // Rings 1 and 2 are already threaded; ring 3 waits just ahead. Compose
    // the frame so the ring, the islands and the sea are all in view.
    world.rings[0].passed = true;
    world.rings[0].glow = 1;
    world.rings[1].passed = true;
    world.rings[1].glow = 1;
    world.rings[2].passed = false;
    world.rings[2].glow = 0;
    game.mission.done = 2;
    plane.x = 4550;
    plane.alt = 620;
    plane.pitch = 2;
    game.cam.alt = plane.alt;
    game.cam.x = plane.x;
    game.messages.push({ text: 'THREAD THE GOLD RINGS', life: 3, color: '#ffd24a' });
    return;
  }
  if (shot.shot === 'end') {
    // The win frame: wheels down on the home runway, all sorties done.
    game.state = 'won';
    game.missionIndex = 2;
    game.mission = game.missions[2];
    game.mission.done = 1;
    game.missions[0].done = 2;
    game.missions[1].done = 8;
    plane.x = 13550;
    plane.alt = world.terrainHeight(13550) + 2;
    plane.onGround = true;
    plane.throttle = 0;
    plane.speed = 0;
    plane.pitch = 0;
    plane.fuel = 41;
    plane.hull = 88;
    game.score = 4650;
    game.scoreParts = { deliveries: 1000, rings: 1200, landing: 1000, fuelBonus: 205 };
    game.best = 4650;
    game.cam.alt = plane.alt;
    game.cam.x = plane.x;
  }
}

export function freshPlaneForShot() {
  return createPlane();
}
