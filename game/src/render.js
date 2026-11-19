// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is the canvas's own size and CSS scales it to the window,
// so no rule depends on the screen size. Flat shapes and canvas text; the HUD,
// the minimap and the screens are all drawn here, so the screenshots show them.
import { FONT, PALETTE, ROAD_W, ROAD_X, ROAD_Y, VIEW, WORLD } from './config.js';
import { missionObjectiveText, missionTarget } from './missions.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_COMPLETE = 4;

const MINIMAP = { x: VIEW.width - 216, y: 12, w: 204, h: 148 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarBody(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
  // Wheels.
  ctx.fillStyle = '#14161c';
  const wl = car.length / 2 - 8;
  const ww = car.width / 2 - 1;
  ctx.fillRect(-wl, -ww - 3, 12, 5);
  ctx.fillRect(wl - 8, -ww - 3, 12, 5);
  ctx.fillRect(-wl, ww - 2, 12, 5);
  ctx.fillRect(wl - 8, ww - 2, 12, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -car.length * 0.18, -car.width / 2 + 3, car.length * 0.36, car.width - 6, 4);
  ctx.fill();
  ctx.fillStyle = '#bfe3f2';
  ctx.fillRect(car.length * 0.22, -car.width / 2 + 4, 6, car.width - 8);
  // Headlights and brake lights.
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(car.length / 2 - 2, -car.width / 2 + 3, 3, 4);
  ctx.fillRect(car.length / 2 - 2, car.width / 2 - 7, 3, 4);
  ctx.fillStyle = car.brakeLight ? '#ff2d2d' : '#7a2020';
  ctx.fillRect(-car.length / 2, -car.width / 2 + 3, 3, 4);
  ctx.fillRect(-car.length / 2, car.width / 2 - 7, 3, 4);
  if (car.model === 'taxi') {
    ctx.fillStyle = '#14161c';
    ctx.fillRect(-6, -car.width / 2 + 2, 12, 5);
  }
  if (car.isPolice) {
    ctx.fillStyle = '#f2f0e8';
    ctx.fillRect(-car.length * 0.1, -car.width / 2 + 2, car.length * 0.2, car.width - 4);
    // Flashing light bar.
    const phase = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-4, -car.width / 2 - 1, 8, 5);
    ctx.fillStyle = phase ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-4, car.width / 2 - 4, 8, 5);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, down, isPlayer, time) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#0e2a28';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();
    // Gun line when aiming.
    ctx.strokeStyle = '#14161c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
    ctx.stroke();
    if (Math.floor(time * 6) % 2 === 0) {
      ctx.fillStyle = '#12b5a5';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawWorld(state) {
    const cam = state.camera;
    const vx0 = cam.x - VIEW.width / 2;
    const vy0 = cam.y - VIEW.height / 2;
    const vx1 = cam.x + VIEW.width / 2;
    const vy1 = cam.y + VIEW.height / 2;
    const time = state.time;

    ctx.save();
    ctx.translate(VIEW.width / 2 - cam.x, VIEW.height / 2 - cam.y);

    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(vx0, vy0, VIEW.width, VIEW.height);

    // Beach and sea.
    if (vy1 > 2300) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(vx0, 2300, VIEW.width, 190);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(vx0, 2490, VIEW.width, 110);
      ctx.fillStyle = PALETTE.waterDeep;
      for (let x = Math.floor(vx0 / 90) * 90; x < vx1; x += 90) {
        ctx.fillRect(x, 2510 + Math.sin(time * 1.5 + x * 0.02) * 6, 46, 4);
        ctx.fillRect(x + 30, 2550 + Math.cos(time * 1.2 + x * 0.02) * 6, 40, 4);
      }
    }

    // Docks concrete.
    if (vx1 > 3195) {
      ctx.fillStyle = '#9a938a';
      ctx.fillRect(3195, 150, WORLD.width - 3195, 2100);
    }

    // Roads: sidewalks, then asphalt, then lane dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2 - 12, vy0, ROAD_W + 24, VIEW.height);
    for (const ry of ROAD_Y) ctx.fillRect(vx0, ry - ROAD_W / 2 - 12, VIEW.width, ROAD_W + 24);
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2, vy0, ROAD_W, VIEW.height);
    for (const ry of ROAD_Y) ctx.fillRect(vx0, ry - ROAD_W / 2, VIEW.width, ROAD_W);
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROAD_X) {
      for (let y = Math.floor(vy0 / 44) * 44; y < vy1; y += 44) ctx.fillRect(rx - 2, y, 4, 24);
    }
    for (const ry of ROAD_Y) {
      for (let x = Math.floor(vx0 / 44) * 44; x < vx1; x += 44) ctx.fillRect(x, ry - 2, 24, 4);
    }

    // Warehouses and containers.
    for (const wh of state.city.warehouses) {
      ctx.fillStyle = PALETTE.buildingShadow;
      ctx.fillRect(wh.x + 6, wh.y + 8, wh.w, wh.h);
      ctx.fillStyle = '#6a707c';
      ctx.fillRect(wh.x, wh.y, wh.w, wh.h);
      ctx.fillStyle = '#565c68';
      ctx.fillRect(wh.x + 8, wh.y + 8, wh.w - 16, 18);
      ctx.fillStyle = '#3d414c';
      for (let x = wh.x + 20; x < wh.x + wh.w - 10; x += 34) ctx.fillRect(x, wh.y + 44, 20, 60);
    }
    for (const box of state.city.containers) {
      ctx.fillStyle = box.color;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }

    // Buildings, culled to the view.
    for (const b of state.city.buildings) {
      if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
      ctx.fillStyle = PALETTE.buildingShadow;
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      if (b.tall) {
        ctx.fillStyle = 'rgba(20,24,34,0.55)';
        const cols = b.windows;
        const rows = Math.max(2, Math.floor(b.h / 34));
        for (let i = 0; i < cols; i += 1) {
          for (let j = 0; j < rows; j += 1) {
            ctx.fillRect(b.x + 12 + (i * (b.w - 24)) / cols, b.y + 12 + (j * (b.h - 24)) / rows, 10, 12);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
      }
    }

    // Named places get a sign so the city reads at a glance.
    drawSiteSign(ctx, state);

    // Trees.
    for (const tree of state.city.trees) {
      if (tree.x < vx0 - 20 || tree.x > vx1 + 20 || tree.y < vy0 - 20 || tree.y > vy1 + 20) continue;
      ctx.fillStyle = tree.palm ? '#5d8a4a' : '#4a7a3d';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tree.palm ? '#7fae5c' : '#5d8a4a';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pickups.
    for (const pickup of state.city.pickups) {
      if (pickup.taken) continue;
      if (pickup.x < vx0 - 20 || pickup.x > vx1 + 20 || pickup.y < vy0 - 20 || pickup.y > vy1 + 20) continue;
      const bob = Math.sin(time * 3 + pickup.x) * 2;
      if (pickup.kind === 'cash') {
        ctx.fillStyle = '#2fae5d';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', pickup.x, pickup.y + bob + 1);
      } else if (pickup.kind === 'health') {
        ctx.fillStyle = '#f2f0e8';
        ctx.fillRect(pickup.x - 11, pickup.y - 11 + bob, 22, 22);
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(pickup.x - 3, pickup.y - 8 + bob, 6, 16);
        ctx.fillRect(pickup.x - 8, pickup.y - 3 + bob, 16, 6);
      } else {
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(pickup.x - 11, pickup.y - 8 + bob, 22, 16);
        ctx.fillStyle = '#14161c';
        ctx.font = 'bold 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', pickup.x, pickup.y + bob + 1);
      }
    }

    // Mission marker: a beam, a pulsing diamond, and an edge arrow when off-screen.
    const target = missionTarget(state.missions);
    if (target && !state.missions.done) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      ctx.fillStyle = 'rgba(255,210,63,0.18)';
      ctx.fillRect(target.x - 14, target.y - 90, 28, 90);
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.marker;
      const s = 13 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 24 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      // Edge arrow.
      const sx = target.x - cam.x + VIEW.width / 2;
      const sy = target.y - cam.y + VIEW.height / 2;
      if (sx < 30 || sx > VIEW.width - 30 || sy < 30 || sy > VIEW.height - 30) {
        const ax = Math.max(40, Math.min(VIEW.width - 40, sx));
        const ay = Math.max(40, Math.min(VIEW.height - 40, sy));
        const ang = Math.atan2(sy - ay, sx - ax);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-8, -10);
        ctx.lineTo(-8, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Cars, people, bullets, particles.
    for (const car of state.cars) {
      if (!car.dead) drawCarBody(ctx, car, time);
    }
    for (const ped of state.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.down, false, time);
    for (const gunman of state.gunmen) drawPerson(ctx, gunman.x, gunman.y, gunman.angle, '#3a3f4a', gunman.down, false, time);
    for (const cop of state.footCops) drawPerson(ctx, cop.x, cop.y, cop.angle, '#1e3a5f', cop.down, false, time);
    const player = state.player;
    if (!player.inCar) {
      ctx.save();
      if (player.invulnerable > 0 && Math.floor(time * 10) % 2 === 0) ctx.globalAlpha = 0.45;
      drawPerson(ctx, player.x, player.y, player.angle, '#12b5a5', false, true, time);
      ctx.restore();
    } else {
      // A white ring marks your car.
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.inCar.x, player.inCar.y, 34, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fff6b0';
    ctx.lineWidth = 2;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSiteSign(ctx, state) {
    const signs = [
      { x: 295, y: 280, label: 'SAFEHOUSE', color: '#58d68d' },
      { x: 1800, y: 285, label: 'ST. MARINA', color: '#f2f0e8' },
      { x: 600, y: 2085, label: 'AMMO & CO', color: '#f2c230' },
      { x: 2680, y: 2085, label: 'RESPRAY', color: '#ff9a3c' },
      { x: 1800, y: 1200, label: 'SYNDICATE TOWER', color: '#e5534b' },
      { x: 900, y: 1180, label: 'HARBOR DINER', color: '#f2c230' },
    ];
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const sign of signs) {
      ctx.fillStyle = 'rgba(16,18,26,0.7)';
      const w = ctx.measureText(sign.label).width + 14;
      ctx.fillRect(sign.x - w / 2, sign.y - 10, w, 20);
      ctx.fillStyle = sign.color;
      ctx.fillText(sign.label, sign.x, sign.y + 1);
    }
  }

  function drawMinimap(state) {
    const m = MINIMAP;
    const sx = m.w / WORLD.width;
    const sy = m.h / WORLD.height;
    ctx.fillStyle = 'rgba(10,12,18,0.85)';
    ctx.fillRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.strokeRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.x, m.y, m.w, m.h);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(m.x, m.y + 2490 * sy, m.w, 110 * sy);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(m.x, m.y + 2300 * sy, m.w, 190 * sy);
    ctx.strokeStyle = '#3d414c';
    ctx.lineWidth = 3;
    for (const rx of ROAD_X) {
      ctx.beginPath();
      ctx.moveTo(m.x + rx * sx, m.y);
      ctx.lineTo(m.x + rx * sx, m.y + m.h);
      ctx.stroke();
    }
    for (const ry of ROAD_Y) {
      ctx.beginPath();
      ctx.moveTo(m.x, m.y + ry * sy);
      ctx.lineTo(m.x + m.w, m.y + ry * sy);
      ctx.stroke();
    }
    // The safehouse, in green, is the one fixed dot on the map.
    ctx.fillStyle = '#58d68d';
    ctx.fillRect(m.x + 295 * sx - 2, m.y + 280 * sy - 2, 4, 4);
    const target = missionTarget(state.missions);
    if (target && !state.missions.done) {
      const pulse = 3 + Math.sin(state.time * 4) * 1.5;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x + target.x * sx, m.y + target.y * sy, pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(m.x + target.x * sx, m.y + target.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#9a938a';
    for (const car of state.cars) {
      if (car.dead || car.driver === 'player') continue;
      ctx.fillStyle = car.isPolice ? (Math.floor(state.time * 4) % 2 === 0 ? '#ff2d2d' : '#2d7dff') : '#c9c2b2';
      ctx.fillRect(m.x + car.x * sx - 1.5, m.y + car.y * sy - 1.5, 3, 3);
    }
    for (const cop of state.footCops) {
      ctx.fillStyle = '#2d7dff';
      ctx.fillRect(m.x + cop.x * sx - 1.5, m.y + cop.y * sy - 1.5, 3, 3);
    }
    const player = state.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(m.x + state.camera.x * sx - 640 * sx, m.y + state.camera.y * sy - 360 * sy, 1280 * sx, 720 * sy);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(m.x + px * sx, m.y + py * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14161c';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 10px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('PORT SOLANO', m.x, m.y + m.h + 14);
  }

  function drawHUD(state, ui) {
    const player = state.player;
    const police = state.police;
    // Top-left: money, health, wanted stars.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 12, 250, 86, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.stroke();
    ctx.fillStyle = PALETTE.money;
    ctx.font = 'bold 24px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('$' + player.money.toLocaleString('en-US'), 24, 42);
    ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(24, 52, 150 * Math.max(0, player.health / 100), 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(24, 52, 150, 12);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < police.stars ? PALETTE.star : PALETTE.starEmpty;
      drawStar(ctx, 190 + i * 15, 58, 7);
    }
    // Top-centre: the job and its objective.
    const mission = state.missions.done ? null : state.missions;
    const title = state.missions.done ? 'STORY COMPLETE' : (mission && mission.index < 5 ? 'JOB ' + (mission.index + 1) + ' OF 5' : '');
    const objective = missionObjectiveText(state.missions);
    ctx.fillStyle = PALETTE.panel;
    const panelW = 560;
    roundRect(ctx, (VIEW.width - panelW) / 2, 12, panelW, 62, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW.width / 2, 32);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '14px ' + FONT;
    ctx.fillText(objective, VIEW.width / 2, 56);
    // Minimap.
    drawMinimap(state);
    // Bottom-right: speed or ammo.
    ctx.textAlign = 'right';
    if (player.inCar) {
      const car = player.inCar;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, VIEW.width - 190, VIEW.height - 76, 178, 64, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '10px ' + FONT;
      ctx.fillText('NITRO — SHIFT', VIEW.width - 24, VIEW.height - 62);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 26px ' + FONT;
      ctx.fillText(Math.round(Math.abs(car.speed) * 0.22) + ' mph', VIEW.width - 24, VIEW.height - 34);
      ctx.fillStyle = '#ff9a3c';
      ctx.fillRect(VIEW.width - 178, VIEW.height - 24, 154 * (car.nitroMeter || 0), 5);
    } else {
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, VIEW.width - 190, VIEW.height - 76, 178, 64, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '10px ' + FONT;
      ctx.fillText('AMMO — R RELOAD', VIEW.width - 24, VIEW.height - 62);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillText(player.mag + ' / ' + player.ammo, VIEW.width - 24, VIEW.height - 34);
    }
    // Bottom-centre: context hint.
    let hint = '';
    if (state.nearCar) hint = 'E — Steal the ' + state.nearCar.name;
    else if (state.nearSite === 'gunshop') hint = 'E — Buy ammo at Ammo & Co ($50)';
    else if (state.nearSite === 'garage' && police.stars > 0) hint = 'Respray — new plates, heat cleared ($200)';
    else if (state.nearSite === 'hospital') hint = 'St. Marina Hospital — healed for $100';
    if (hint) {
      ctx.fillStyle = PALETTE.panel;
      const w = ctx.measureText(hint).width + 28;
      roundRect(ctx, (VIEW.width - w) / 2, VIEW.height - 44, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(hint, VIEW.width / 2, VIEW.height - 24);
    }
    // Toasts.
    ctx.textAlign = 'center';
    let toastY = 92;
    for (const toast of state.toasts) {
      ctx.globalAlpha = Math.min(1, toast.timer);
      ctx.fillStyle = PALETTE.panel;
      const w = ctx.measureText(toast.text).width + 28;
      roundRect(ctx, (VIEW.width - w) / 2, toastY, w, 28, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText(toast.text, VIEW.width / 2, toastY + 19);
      toastY += 34;
    }
    ctx.globalAlpha = 1;
    // Low health vignette; heavy heat flashes red.
    if (player.health < 30 && player.health > 0) {
      ctx.strokeStyle = 'rgba(229,83,75,' + (0.4 + 0.3 * Math.sin(state.time * 5)) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, VIEW.width, VIEW.height);
    } else if (police.stars >= 4) {
      ctx.strokeStyle = 'rgba(229,83,75,' + (0.15 + 0.1 * Math.sin(state.time * 4)) + ')';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, VIEW.width, VIEW.height);
    }
    void ui;
  }

  function drawStar(ctx2, x, y, r) {
    ctx2.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) ctx2.moveTo(px, py);
      else ctx2.lineTo(px, py);
    }
    ctx2.closePath();
    ctx2.fill();
  }

  function panel(ctx2, lines, title) {
    ctx2.fillStyle = 'rgba(10,12,18,0.78)';
    ctx2.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'alphabetic';
    let y = 210;
    if (title) {
      ctx2.fillStyle = PALETTE.marker;
      ctx2.font = 'bold 64px ' + FONT;
      ctx2.fillText(title, VIEW.width / 2, y);
      y += 40;
    }
    for (const line of lines) {
      ctx2.fillStyle = line.color || PALETTE.text;
      ctx2.font = line.font || '18px ' + FONT;
      ctx2.fillText(line.text, VIEW.width / 2, y);
      y += line.gap || 30;
    }
  }

  function drawTitle(state, ui) {
    panel(ctx, [
      { text: 'A PORT SOLANO STORY', font: 'bold 18px ' + FONT, color: PALETTE.muted, gap: 44 },
      { text: 'You owe the Harbor Syndicate $50,000. Five jobs stand between you and freedom.', gap: 34 },
      { text: ui.save ? `CONTINUE — $${ui.save.money.toLocaleString('en-US')}  •  Job ${Math.min(5, ui.save.missionIndex + 1)} of 5  (press Enter)` : '', color: PALETTE.money, gap: 34 },
      { text: 'NEW GAME — press Space or click', color: PALETTE.marker, gap: 40 },
      { text: 'WASD move / drive  •  E steal a car  •  Mouse aim  •  Click shoot  •  Space punch / handbrake', color: PALETTE.muted, gap: 28 },
      { text: 'Steal cars, lose the cops, run the jobs. Your money, jobs and best run are saved in this browser.', color: PALETTE.muted, gap: 28 },
      { text: 'Best run: $' + (ui.best || 0).toLocaleString('en-US'), color: PALETTE.muted, gap: 48 },
      { text: 'An original city, story and soundtrack — made for make.fun', font: '13px ' + FONT, color: PALETTE.muted },
    ], 'NEON HARBOR');
  }

  function draw(state, screen, ui) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawWorld(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(state, ui);
    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    else if (screen === SCREEN_PAUSED) {
      panel(ctx, [
        { text: 'Enter — resume', gap: 34 },
        { text: 'S — save and quit to title', color: PALETTE.muted, gap: 30 },
        { text: 'M — ' + (ui.muted ? 'unmute' : 'mute') + ' sound', color: PALETTE.muted },
      ], 'PAUSED');
    } else if (screen === SCREEN_OVER) {
      panel(ctx, [
        { text: ui.overKind === 'busted' ? 'The cops hauled you in.' : 'You wake up at St. Marina Hospital.', gap: 34 },
        { text: 'Lost $' + (ui.lost || 0).toLocaleString('en-US') + ' — the job goes on.', color: PALETTE.muted, gap: 40 },
        { text: 'Press Enter to get back out there', color: PALETTE.marker },
      ], ui.overKind === 'busted' ? 'BUSTED' : 'WASTED');
    } else if (screen === SCREEN_COMPLETE) {
      panel(ctx, [
        { text: 'Five jobs. No debt. Port Solano is yours.', gap: 34 },
        { text: 'You finished with $' + state.player.money.toLocaleString('en-US') + ' in your pocket.', color: PALETTE.money, gap: 40 },
        { text: 'Press Enter to keep playing — free roam', color: PALETTE.marker },
      ], 'KING OF THE HARBOR');
    }
  }

  return { draw };
}
