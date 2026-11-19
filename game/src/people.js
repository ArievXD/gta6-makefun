// People: Rex on foot, the city's pedestrians, and the syndicate gunmen.
// Pedestrians wander the sidewalks and flee from gunfire and speeding cars; a
// pedestrian run over or shot is a crime the police notice. Gunmen only appear in
// the final job, hold their ground at the tower, and shoot back.
import { PLAYER, ROAD_W, ROAD_X, ROAD_Y, WORLD } from './config.js';
import { resolveCircle } from './city.js';

let nextPersonId = 1;

export function createPlayer(x, y) {
  return {
    id: 0,
    kind: 'player',
    x, y,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    health: PLAYER.health,
    ammo: PLAYER.startAmmo,
    mag: PLAYER.magSize,
    money: PLAYER.startMoney,
    punchCooldown: 0,
    shotCooldown: 0,
    reloadTimer: 0,
    invulnerable: 0,
    inCar: null,
    moving: false,
  };
}

export function createPedestrian(random) {
  const onVertical = random.chance(0.5);
  const road = onVertical ? random.pick(ROAD_X) : random.pick(ROAD_Y);
  const along = random.range(120, onVertical ? WORLD.height - 120 : WORLD.width - 120);
  const side = random.chance(0.5) ? 1 : -1;
  const x = onVertical ? road + side * (ROAD_W / 2 + 9) : along;
  const y = onVertical ? along : road + side * (ROAD_W / 2 + 9);
  return {
    id: nextPersonId,
    kind: 'ped',
    x, y,
    angle: random.range(0, Math.PI * 2),
    radius: 11,
    speed: random.range(45, 75),
    state: 'walk',
    stateTimer: 0,
    target: { x, y },
    color: ['#e8b4b8', '#a8c8e8', '#e8d8a8', '#b8e8c8', '#d8b8e8', '#e8a878'][nextPersonId % 6],
    down: false,
    downTimer: 0,
  };
}

export function createGunman(x, y) {
  return {
    id: nextPersonId,
    kind: 'gunman',
    x, y,
    angle: 0,
    radius: 12,
    health: 50,
    shotTimer: 0.5 + Math.random() * 0.8,
    down: false,
    color: '#3a3f4a',
  };
}

export function resetPersonIds() { nextPersonId = 1; }

function pickSidewalkTarget(ped, random) {
  const onVertical = random.chance(0.5);
  const road = onVertical ? random.pick(ROAD_X) : random.pick(ROAD_Y);
  const along = random.range(120, onVertical ? WORLD.height - 120 : WORLD.width - 120);
  const side = random.chance(0.5) ? 1 : -1;
  return onVertical
    ? { x: road + side * (ROAD_W / 2 + 9), y: along }
    : { x: along, y: road + side * (ROAD_W / 2 + 9) };
}

/** A pedestrian walks to its target, then picks another. Fear makes it run. */
export function stepPedestrian(ped, dt, city, random, threat) {
  if (ped.down) {
    ped.downTimer -= dt;
    return;
  }
  if (threat) {
    const dist = Math.hypot(ped.x - threat.x, ped.y - threat.y);
    if (dist < 260 && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.stateTimer = 2.5;
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.target = { x: ped.x + Math.cos(away) * 320, y: ped.y + Math.sin(away) * 320 };
    }
  }
  if (ped.state === 'flee') {
    ped.stateTimer -= dt;
    if (ped.stateTimer <= 0) { ped.state = 'walk'; ped.target = pickSidewalkTarget(ped, random); }
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    ped.target = pickSidewalkTarget(ped, random);
    return;
  }
  const speed = ped.state === 'flee' ? 210 : ped.speed;
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / dist) * speed * dt;
  ped.y += (dy / dist) * speed * dt;
  resolveCircle(city, ped, ped.radius);
}

/** Rex on foot: WASD to move, mouse to aim, click or F to shoot, Space to punch. */
export function stepPlayerOnFoot(player, input, dt, city, bullets, events) {
  const move = input.moveVector();
  player.moving = move.x !== 0 || move.y !== 0;
  if (player.moving) {
    player.x += move.x * PLAYER.walkSpeed * dt;
    player.y += move.y * PLAYER.walkSpeed * dt;
    if (!input.mouse.down) player.angle = Math.atan2(move.y, move.x);
  }
  resolveCircle(city, player, player.radius);
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shotCooldown > 0) player.shotCooldown -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      const need = PLAYER.magSize - player.mag;
      const take = Math.min(need, player.ammo);
      player.mag += take;
      player.ammo -= take;
    }
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
  // Aim follows the mouse (mouse is in screen space; the caller sets player.aimWorld).
  if (player.aimWorld) player.angle = Math.atan2(player.aimWorld.y - player.y, player.aimWorld.x - player.x);
  const wantShot = input.mouse.down || input.takeClick();
  if (wantShot && player.shotCooldown <= 0 && player.reloadTimer <= 0) {
    if (player.mag > 0) {
      player.mag -= 1;
      player.shotCooldown = PLAYER.shotCooldown;
      bullets.push({
        x: player.x + Math.cos(player.angle) * 20,
        y: player.y + Math.sin(player.angle) * 20,
        vx: Math.cos(player.angle) * PLAYER.bulletSpeed,
        vy: Math.sin(player.angle) * PLAYER.bulletSpeed,
        life: 0.6,
        from: 'player',
        damage: PLAYER.shotDamage,
      });
      events.shot = true;
    } else {
      player.shotCooldown = 0.3;
      events.emptyClick = true;
    }
  }
  return events;
}

/** A gunman stands its ground and shoots at the player when close enough. */
export function stepGunman(gunman, dt, player, bullets) {
  if (gunman.down) return;
  const dist = Math.hypot(player.x - gunman.x, player.y - gunman.y);
  gunman.angle = Math.atan2(player.y - gunman.y, player.x - gunman.x);
  gunman.shotTimer -= dt;
  if (dist < 420 && gunman.shotTimer <= 0) {
    gunman.shotTimer = 0.9 + Math.random() * 0.5;
    const spread = (Math.random() - 0.5) * 0.35;
    const a = gunman.angle + spread;
    bullets.push({
      x: gunman.x + Math.cos(a) * 20,
      y: gunman.y + Math.sin(a) * 20,
      vx: Math.cos(a) * 620,
      vy: Math.sin(a) * 620,
      life: 0.8,
      from: 'gunman',
      damage: 8,
    });
  }
}

/** Bullets fly until they hit a wall, a person or a car. Returns hit reports. */
export function stepBullets(bullets, dt, city, player, peds, gunmen, footCops, cars) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
    if (!dead) {
      // A wall stops the bullet.
      const probe = { x: b.x, y: b.y };
      if (resolveCircle(city, probe, 1) && (probe.x !== b.x || probe.y !== b.y)) dead = true;
    }
    if (!dead) {
      const targets = [];
      if (b.from !== 'player') targets.push(player);
      for (const p of peds) if (!p.down) targets.push(p);
      for (const g of gunmen) if (!g.down) targets.push(g);
      for (const c of footCops) if (!c.down) targets.push(c);
      for (const t of targets) {
        if (Math.hypot(t.x - b.x, t.y - b.y) < t.radius + 4) {
          hits.push({ bullet: b, target: t });
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const car of cars) {
        if (car.dead) continue;
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        const localX = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const localY = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (Math.abs(localX) < car.length / 2 && Math.abs(localY) < car.width / 2) {
          car.health -= b.damage;
          hits.push({ bullet: b, target: car });
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return hits;
}
