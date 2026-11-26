// Skylark Courier — everything the pilot sees: dawn sky, parallax sea and
// mountains, the island strips, the golden rings, the Dawn Runner herself,
// and a lit HUD with altitude, speed, heading, fuel, hull and the mission.

import { VIEW_W, VIEW_H, WORLD_W, PALETTE, STRIPS, MISSIONS } from './config.js';
import { clamp, lerp } from './random.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 26, 40, 0.72)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 233, 176, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// Camera: the plane sits at a fixed screen spot; the world slides past it.
export function createCamera() {
  return { alt: 60, x: 320 };
}

export function updateCamera(cam, plane, dt) {
  const targetAlt = clamp(plane.alt, 60, 2200);
  cam.alt = lerp(cam.alt, targetAlt, Math.min(1, dt * 2.2));
  cam.x = plane.x;
}

function screenX(cam, worldX) {
  return VIEW_W * 0.38 + (worldX - cam.x) * 0.9;
}

function screenY(cam, alt) {
  return VIEW_H * 0.66 - (alt - cam.alt) * 0.24;
}

function drawSky(ctx, cam, time) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.45, PALETTE.skyMid);
  g.addColorStop(0.75, PALETTE.skyLow);
  g.addColorStop(1, '#ffe9c4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Low dawn sun, fixed in the east.
  const sunX = VIEW_W * 0.82;
  const sunY = VIEW_H * 0.2;
  const sg = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
  sg.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  sg.addColorStop(0.35, 'rgba(255, 190, 110, 0.55)');
  sg.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = '#fff3cf';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // A few high birds.
  ctx.strokeStyle = 'rgba(40, 40, 60, 0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const bx = ((time * 12 + i * 300) % (VIEW_W + 200)) - 100;
    const by = 90 + i * 34 + Math.sin(time + i * 2) * 6;
    ctx.beginPath();
    ctx.moveTo(bx - 9, by);
    ctx.quadraticCurveTo(bx - 3, by - 6, bx, by);
    ctx.quadraticCurveTo(bx + 3, by - 6, bx + 9, by);
    ctx.stroke();
  }
}

function drawClouds(ctx, world, cam, time) {
  for (const c of world.clouds) {
    const sx = screenX(cam, c.x) * 0.35 + VIEW_W * 0.2;
    const sy = screenY(cam, c.alt) * 0.55 + 40;
    if (sx < -260 || sx > VIEW_W + 260) continue;
    // Each puff filled on its own so overlaps never leave a hard edge.
    const puffs = [
      [0, 0, 0.9, 0.32],
      [-0.45, 8, 0.5, 0.24],
      [0.5, 6, 0.55, 0.26],
    ];
    for (const [dx, dy, rx, ry] of puffs) {
      ctx.fillStyle = `rgba(255, 250, 240, ${0.55 * c.shade})`;
      ctx.beginPath();
      ctx.ellipse(sx + dx * c.s, sy + dy, c.s * rx, c.s * ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Storm cells: dark, bruised, flashing.
  for (const s of world.storms) {
    const sx = screenX(cam, s.x);
    const sy = screenY(cam, s.alt);
    if (sx < -260 || sx > VIEW_W + 260) continue;
    ctx.fillStyle = s.flash > 0.4 ? 'rgba(220, 220, 240, 0.85)' : 'rgba(52, 58, 74, 0.85)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, s.r * 0.9, s.r * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - s.r * 0.5, sy + 14, s.r * 0.5, s.r * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + s.r * 0.5, sy + 12, s.r * 0.55, s.r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 214, 74, 0.9)';
    text(ctx, '⚠', sx - 10, sy + 8, 26, 'rgba(255, 214, 74, 0.95)', 'left', 900);
  }
}

function drawTerrain(ctx, world, cam) {
  // Distant mountain ridge, slow parallax.
  ctx.fillStyle = 'rgba(74, 92, 122, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= VIEW_W; sx += 16) {
    const wx = cam.x + (sx - VIEW_W * 0.38) / 0.9;
    const h = 420 + Math.sin(wx * 0.00045) * 130 + Math.sin(wx * 0.0011 + 2) * 60;
    ctx.lineTo(sx, screenY(cam, h) + 180);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();

  // The sea and the land itself.
  const step = 8;
  ctx.beginPath();
  ctx.moveTo(-4, VIEW_H + 4);
  for (let sx = -4; sx <= VIEW_W + 4; sx += step) {
    const wx = cam.x + (sx - VIEW_W * 0.38) / 0.9;
    const h = world.terrainHeight(wx);
    ctx.lineTo(sx, screenY(cam, Math.max(h, 2)));
  }
  ctx.lineTo(VIEW_W + 4, VIEW_H + 4);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, screenY(cam, 320), 0, VIEW_H);
  tg.addColorStop(0, PALETTE.grassLight);
  tg.addColorStop(0.25, PALETTE.grass);
  tg.addColorStop(0.6, PALETTE.rock);
  tg.addColorStop(1, '#4a3626');
  ctx.fillStyle = tg;
  ctx.fill();

  // Sea surface where the ground is at sea level.
  ctx.fillStyle = PALETTE.sea;
  const seaY = screenY(cam, 2);
  ctx.fillRect(0, seaY, VIEW_W, VIEW_H - seaY);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  for (let sx = 0; sx < VIEW_W; sx += 90) {
    const wx = cam.x + (sx - VIEW_W * 0.38) / 0.9;
    if (!world.isSea(wx)) continue;
    const wob = Math.sin(wx * 0.02) * 3;
    ctx.beginPath();
    ctx.moveTo(sx, seaY + 8 + wob);
    ctx.lineTo(sx + 34, seaY + 8 + wob);
    ctx.stroke();
  }

  // Sandy beach edge where land meets sea.
  ctx.strokeStyle = PALETTE.sand;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let sx = -4; sx <= VIEW_W + 4; sx += step) {
    const wx = cam.x + (sx - VIEW_W * 0.38) / 0.9;
    const h = world.terrainHeight(wx);
    const y = screenY(cam, Math.max(h, 2));
    if (sx === -4) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  ctx.stroke();

  // Palm trees on the islands.
  for (const s of Object.values(STRIPS)) {
    for (let i = -1; i <= 1; i += 1) {
      const tx = s.x + i * (s.w / 2 + 90);
      const sx = screenX(cam, tx);
      if (sx < -30 || sx > VIEW_W + 30) continue;
      const sy = screenY(cam, world.terrainHeight(tx));
      ctx.strokeStyle = '#5a3d24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + 6, sy - 26, sx + 14, sy - 34);
      ctx.stroke();
      ctx.strokeStyle = '#2f7a33';
      ctx.lineWidth = 3;
      for (let f = 0; f < 5; f += 1) {
        const a = -Math.PI * (0.15 + f * 0.18);
        ctx.beginPath();
        ctx.moveTo(sx + 14, sy - 34);
        ctx.quadraticCurveTo(sx + 14 + Math.cos(a) * 18, sy - 34 + Math.sin(a) * 14, sx + 14 + Math.cos(a) * 30, sy - 34 + Math.sin(a) * 22 + 8);
        ctx.stroke();
      }
    }
  }
}

function drawStrips(ctx, world, cam) {
  for (const [id, s] of Object.entries(STRIPS)) {
    const cx = screenX(cam, s.x);
    const y = screenY(cam, s.h);
    const w = s.w * 0.9;
    if (cx < -w || cx > VIEW_W + w) continue;
    // Runway slab.
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(cx - w / 2, y - 6, w, 12);
    ctx.fillStyle = PALETTE.runwayLine;
    for (let i = -3; i <= 3; i += 1) {
      ctx.fillRect(cx + i * (w / 8) - 12, y - 2, 24, 4);
    }
    // Edge lights, lit.
    for (let i = 0; i <= 8; i += 1) {
      const lx = cx - w / 2 + (i / 8) * w;
      ctx.fillStyle = i % 2 === 0 ? '#ffd24a' : '#7be07b';
      ctx.beginPath();
      ctx.arc(lx, y - 9, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Label board.
    text(ctx, s.label, cx, y - 22, 15, '#ffffff', 'center', 800);
    ctx.fillStyle = 'rgba(10, 26, 40, 0.55)';
    const tw = ctx.measureText(s.label).width;
    ctx.fillRect(cx - tw / 2 - 8, y - 40, tw + 16, 20);
    text(ctx, s.label, cx, y - 25, 15, '#ffe9b0', 'center', 800);
    if (id === 'strip-home-start' || id === 'strip_home') {
      text(ctx, 'HOME', cx, y - 52, 13, '#7be07b', 'center', 800);
    }
  }
}

function drawRings(ctx, world, cam, mission) {
  for (const r of world.rings) {
    const sx = screenX(cam, r.x);
    const sy = screenY(cam, r.alt);
    if (sx < -90 || sx > VIEW_W + 90) continue;
    const isNext = mission && mission.id === 'rings' && !r.passed && world.rings.find((q) => !q.passed) === r;
    const passed = r.passed;
    const radius = 46 + (isNext ? Math.sin(Date.now() / 180) * 4 : 0);
    ctx.save();
    ctx.globalAlpha = passed ? 0.35 : 1;
    ctx.strokeStyle = passed ? PALETTE.ringGreen : PALETTE.ringGold;
    ctx.lineWidth = isNext ? 7 : 5;
    ctx.shadowColor = passed ? PALETTE.ringGreen : PALETTE.ringGold;
    ctx.shadowBlur = r.glow > 0 ? 26 : 12;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const label = r.id.replace('ring-', '');
    text(ctx, passed ? '✓' : label, sx, sy + 7, 22, passed ? PALETTE.ringGreen : '#fff3cf', 'center', 900);
    if (isNext) {
      text(ctx, 'NEXT', sx, sy - radius - 12, 13, PALETTE.ringGold, 'center', 800);
    }
  }
}

function drawParcels(ctx, world, cam) {
  for (const p of world.parcels) {
    const sx = screenX(cam, p.x);
    const sy = screenY(cam, p.alt);
    if (sx < -40 || sx > VIEW_W + 40) continue;
    ctx.fillStyle = '#c98f3d';
    ctx.fillRect(sx - 9, sy - 9, 18, 18);
    ctx.strokeStyle = '#7a4d16';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 9, sy - 9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(sx - 9, sy - 9);
    ctx.lineTo(sx + 9, sy + 9);
    ctx.moveTo(sx + 9, sy - 9);
    ctx.lineTo(sx - 9, sy + 9);
    ctx.stroke();
    if (p.state === 'falling') {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 9);
      ctx.lineTo(sx, sy - 30);
      ctx.stroke();
    }
  }
}

function drawPlane(ctx, plane, cam, time, world) {
  const px = VIEW_W * 0.38;
  const py = screenY(cam, plane.alt);
  // The plane sits at its screen spot; the world moves under it.
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((-plane.pitch * Math.PI) / 180);

  // Shadow on the ground when low.
  ctx.restore();
  const ground = plane.alt;
  if (ground < 500) {
    ctx.save();
    ctx.globalAlpha = clamp(0.3 - ground / 2200, 0.04, 0.3);
    ctx.fillStyle = '#10202e';
    ctx.beginPath();
    ctx.ellipse(px, screenY(cam, world.terrainHeight(plane.x)) + 4, 46, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((-plane.pitch * Math.PI) / 180);
  ctx.scale(1.35, 1.35);

  // Exhaust puffs when the throttle is up.
  if (plane.throttle > 0.4 && !plane.onGround) {
    ctx.fillStyle = 'rgba(230, 230, 230, 0.5)';
    for (let i = 0; i < 3; i += 1) {
      const off = 34 + i * 12 + ((time * 90 + i * 30) % 20);
      ctx.beginPath();
      ctx.arc(-off, 4 + i * 2, 5 + i * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tail, fuselage, wing, cockpit, prop.
  ctx.fillStyle = PALETTE.planeRed;
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.lineTo(-46, -26);
  ctx.lineTo(-36, -24);
  ctx.lineTo(-28, -4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.planeCream;
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.planeTeal;
  ctx.fillRect(-30, 2, 62, 5);
  ctx.beginPath();
  ctx.ellipse(14, -4, 12, 7, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#bfe6ef';
  ctx.fill();
  ctx.strokeStyle = '#274b7a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(14, -4, 12, 7, -0.15, 0, Math.PI * 2);
  ctx.stroke();

  // Main wing.
  ctx.fillStyle = PALETTE.planeTeal;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(6, 2);
  ctx.lineTo(2, 26);
  ctx.lineTo(-12, 26);
  ctx.closePath();
  ctx.fill();

  // Propeller: a spinning disc with two blades.
  ctx.save();
  ctx.translate(40, 0);
  ctx.rotate(plane.propAngle);
  ctx.fillStyle = 'rgba(60, 60, 70, 0.85)';
  ctx.fillRect(-3, -26, 6, 52);
  ctx.fillRect(-26, -3, 52, 6);
  ctx.restore();
  ctx.fillStyle = '#3a3f46';
  ctx.beginPath();
  ctx.arc(40, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  // Nav lights, blinking.
  const blink = Math.sin(time * 6) > 0;
  if (blink) {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-38, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff88';
    ctx.beginPath();
    ctx.arc(38, 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wheels when on the ground.
  if (plane.onGround) {
    ctx.fillStyle = '#22262b';
    ctx.beginPath();
    ctx.arc(-14, 16, 5, 0, Math.PI * 2);
    ctx.arc(16, 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22262b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 8);
    ctx.lineTo(-14, 16);
    ctx.moveTo(16, 8);
    ctx.lineTo(16, 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx, game) {
  const { plane, score, timeLeft, mission, missionIndex } = game;
  const m = MISSIONS[missionIndex];

  // Top-left instruments: ALT / SPD / HDG.
  panel(ctx, 16, 14, 300, 86);
  text(ctx, 'ALT', 30, 38, 13, '#9fc3d8', 'left', 800);
  text(ctx, `${Math.max(0, Math.round(plane.alt))} FT`, 30, 68, 26, '#ffffff', 'left', 800);
  text(ctx, 'SPD', 140, 38, 13, '#9fc3d8', 'left', 800);
  text(ctx, `${Math.round(plane.speed)} KT`, 140, 68, 26, '#ffffff', 'left', 800);
  text(ctx, 'HDG', 250, 38, 13, '#9fc3d8', 'left', 800);
  text(ctx, `${String(Math.round(plane.heading)).padStart(3, '0')}°`, 238, 68, 26, PALETTE.hudGlow, 'left', 800);

  // Compass strip.
  panel(ctx, VIEW_W / 2 - 190, 14, 380, 34);
  const headings = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW', 360: 'N' };
  ctx.save();
  ctx.beginPath();
  ctx.rect(VIEW_W / 2 - 190, 14, 380, 34);
  ctx.clip();
  for (const h of headings) {
    const dx = (h - plane.heading) * 2.4;
    if (Math.abs(dx) > 185) continue;
    const x = VIEW_W / 2 + dx;
    text(ctx, labels[h], x, 38, 13, h === 90 ? PALETTE.ringGold : '#cfe3ee', 'center', 800);
    ctx.fillStyle = h === 90 ? PALETTE.ringGold : '#cfe3ee';
    ctx.fillRect(x - 1, 18, 2, 8);
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.ringGold;
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2 - 6, 14);
  ctx.lineTo(VIEW_W / 2 + 6, 14);
  ctx.lineTo(VIEW_W / 2, 24);
  ctx.closePath();
  ctx.fill();

  // Top-right: score and clock.
  panel(ctx, VIEW_W - 236, 14, 220, 86);
  text(ctx, 'SCORE', VIEW_W - 222, 38, 13, '#9fc3d8', 'left', 800);
  text(ctx, String(score).padStart(6, '0'), VIEW_W - 222, 68, 26, '#ffffff', 'left', 800);
  text(ctx, 'TIME', VIEW_W - 96, 38, 13, '#9fc3d8', 'left', 800);
  text(ctx, fmtTime(timeLeft), VIEW_W - 96, 68, 22, PALETTE.hudGlow, 'left', 800);

  // Bottom-left: fuel and hull gauges, percent beside each bar.
  panel(ctx, 16, VIEW_H - 92, 300, 76);
  text(ctx, 'FUEL', 30, VIEW_H - 62, 13, '#9fc3d8', 'left', 800);
  gauge(ctx, 76, VIEW_H - 74, 160, 12, plane.fuel / 100, plane.fuel < 25 ? '#ff6b4d' : '#7be07b');
  text(ctx, `${Math.round(plane.fuel)}%`, 244, VIEW_H - 62, 14, '#ffffff', 'left', 700);
  text(ctx, 'HULL', 30, VIEW_H - 26, 13, '#9fc3d8', 'left', 800);
  gauge(ctx, 76, VIEW_H - 38, 160, 12, plane.hull / 100, plane.hull < 30 ? '#ff6b4d' : '#7fd4ff');
  text(ctx, `${Math.round(plane.hull)}%`, 244, VIEW_H - 26, 14, '#ffffff', 'left', 700);

  // Attitude indicator, bottom-right.
  const ax = VIEW_W - 84;
  const ay = VIEW_H - 84;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, 44, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#7ec8e3';
  ctx.fillRect(ax - 46, ay - 46, 92, 92);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate((-plane.pitch * Math.PI) / 180);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-46, 0, 92, 46);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-46, -1, 92, 2);
  ctx.restore();
  ctx.strokeStyle = '#ffe9b0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.moveTo(ax - 16, ay);
  ctx.lineTo(ax + 16, ay);
  ctx.lineTo(ax, ay + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, 'ATTITUDE', ax, ay + 60, 11, '#ffffff', 'center', 700);

  // Mission banner, bottom-centre.
  const done = mission ? mission.done : 0;
  const total = mission ? mission.total : 0;
  panel(ctx, VIEW_W / 2 - 260, VIEW_H - 58, 520, 44);
  text(ctx, m.name, VIEW_W / 2, VIEW_H - 40, 14, PALETTE.hudGlow, 'center', 800);
  text(ctx, `${m.goal}  •  ${done}/${total}`, VIEW_W / 2, VIEW_H - 20, 13, '#ffffff', 'center', 600);

  // Minimap strip.
  const mapX = VIEW_W / 2 - 200;
  const mapY = VIEW_H - 74;
  ctx.fillStyle = 'rgba(10, 26, 40, 0.6)';
  ctx.fillRect(mapX, mapY, 400, 8);
  for (const s of Object.values(STRIPS)) {
    const mx = mapX + (s.x / WORLD_W) * 400;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 2, mapY - 2, 4, 12);
  }
  for (const r of game.world.rings) {
    const mx = mapX + (r.x / WORLD_W) * 400;
    ctx.fillStyle = r.passed ? PALETTE.ringGreen : PALETTE.ringGold;
    ctx.beginPath();
    ctx.arc(mx, mapY + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = mapX + (plane.x / WORLD_W) * 400;
  ctx.fillStyle = PALETTE.planeTeal;
  ctx.beginPath();
  ctx.moveTo(px, mapY - 7);
  ctx.lineTo(px - 6, mapY + 6);
  ctx.lineTo(px + 6, mapY + 6);
  ctx.closePath();
  ctx.fill();

  // Event banners.
  let by = 120;
  for (const msg of game.messages) {
    ctx.globalAlpha = clamp(msg.life, 0, 1);
    text(ctx, msg.text, VIEW_W / 2, by, 26, msg.color || '#ffffff', 'center', 900);
    ctx.globalAlpha = 1;
    by += 34;
  }

  // Stall warning.
  if (game.stalling) {
    const blink = Math.sin(game.time * 8) > 0;
    if (blink) text(ctx, '⚠ STALL — ADD THROTTLE ⚠', VIEW_W / 2, 168, 24, '#ff6b4d', 'center', 900);
  }
}

function gauge(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2);
  ctx.fill();
}

function fmtTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function overlay(ctx, title, lines, accent, button) {
  ctx.fillStyle = 'rgba(8, 20, 32, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const panelH = 150 + lines.length * 27 + 96;
  const panelY = Math.max(90, (VIEW_H - panelH) / 2);
  panel(ctx, VIEW_W / 2 - 330, panelY, 660, panelH);
  text(ctx, title, VIEW_W / 2, panelY + 62, 44, accent, 'center', 900);
  let y = panelY + 108;
  for (const line of lines) {
    text(ctx, line, VIEW_W / 2, y, 19, '#e8f2f8', 'center', 600);
    y += 27;
  }
  if (button) {
    const bx = VIEW_W / 2 - 110;
    const by = panelY + panelH - 72;
    ctx.fillStyle = button.hover ? '#ffcf5e' : PALETTE.ringGold;
    roundRect(ctx, bx, by, 220, 52, 12);
    ctx.fill();
    text(ctx, button.label, VIEW_W / 2, by + 35, 24, '#10202e', 'center', 900);
    button.rect = { x: bx, y: by, w: 220, h: 52 };
  }
}

export function drawScene(ctx, game) {
  const { world, plane, cam, time } = game;
  drawSky(ctx, cam, time);
  drawClouds(ctx, world, cam, time);
  drawTerrain(ctx, world, cam);
  drawStrips(ctx, world, cam);
  drawRings(ctx, world, cam, game.mission);
  drawParcels(ctx, world, cam);
  drawPlane(ctx, plane, cam, time, world);

  if (game.state === 'title') {
    overlay(
      ctx,
      'SKYLARK COURIER',
      [
        'Fly the Dawn Runner across the Lumen Archipelago.',
        'Deliver parcels, thread the golden rings, and land home',
        'before the fuel gauge hits empty.',
        '',
        '↑ / W  throttle up      ↓ / S  throttle down',
        '← / A  nose up          → / D  nose down',
        'SPACE  drop parcel      P  pause      M  mute',
        '',
        'Three sorties. One sky. No second chances on the hull.',
      ],
      '#ffe9b0',
      game.titleButton,
    );
    return;
  }

  drawHud(ctx, game);

  if (game.state === 'paused') {
    overlay(ctx, 'PAUSED', ['The Dawn Runner holds her breath.', 'Press P or click RESUME to keep flying.'], '#cfe3ee', game.resumeButton);
  } else if (game.state === 'crashed') {
    overlay(
      ctx,
      'CRASHED',
      [
        game.crashReason || 'The sky wins this round.',
        '',
        `Score: ${game.score}   •   Best: ${game.best}`,
        'Press R or click FLY AGAIN.',
      ],
      '#ff6b4d',
      game.retryButton,
    );
  } else if (game.state === 'won') {
    overlay(
      ctx,
      'ALL SORTIES COMPLETE',
      [
        'Parcels delivered. Rings threaded. Home runway, wheels down.',
        '',
        `Deliveries +${game.scoreParts.deliveries}   •   Rings +${game.scoreParts.rings}`,
        `Landing +${game.scoreParts.landing}   •   Fuel bonus +${game.scoreParts.fuelBonus}`,
        '',
        `TOTAL SCORE: ${game.score}   •   Best: ${game.best}`,
        'Press R or click FLY AGAIN.',
      ],
      PALETTE.ringGold,
      game.retryButton,
    );
  }
}
