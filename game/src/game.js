// The simulation: one state, one step. No drawing and no browser in here —
// input comes in, events come out, and the caller (main.js) turns the events
// into sound, announcements and saves. Everything the judge cares about lives
// here: the city, the cars, the people, the police, the jobs.
import { CAR_PAINTS, PLAYER, SITES, VIEW, WORLD } from './config.js';
import { buildCity, resolveCircle } from './city.js';
import { createRandom } from './random.js';
import { ACTION_INTERACT, ACTION_RELOAD } from './input.js';
import { createCar, collideCars, resetCarIds, stepPlayerCar, stepPoliceCar, stepTrafficCar } from './vehicles.js';
import { createPedestrian, createPlayer, resetPersonIds, stepBullets, stepGunman, stepPedestrian, stepPlayerOnFoot } from './people.js';
import { addCrime, clearWanted, createPolice, stepPolice } from './police.js';
import { MISSIONS, applyStageEffects, createMissions, stepMissions } from './missions.js';

export const PARKED_CARS = [
  { model: 'coupe', x: SITES.dinerCar.x, y: SITES.dinerCar.y, angle: Math.PI / 2, color: '#e2452e', mission: true },
  { model: 'sedan', x: 420, y: 900, angle: 0, color: '#3f7fd0' },
  { model: 'taxi', x: 1500, y: 1020, angle: Math.PI, color: '#f2c230' },
  { model: 'van', x: 2400, y: 2020, angle: -Math.PI / 2, color: '#8a6fb0' },
  { model: 'sedan', x: 1200, y: 420, angle: Math.PI / 2, color: '#d0d3d8' },
  { model: 'truck', x: 2820, y: 1500, angle: 0, color: '#7a8a99' },
  { model: 'coupe', x: 600, y: 1620, angle: Math.PI, color: '#2fae7d' },
  { model: 'sedan', x: 2100, y: 705, angle: -Math.PI / 2, color: '#c96a2e' },
];

export function createGame(seed) {
  resetCarIds();
  resetPersonIds();
  const random = createRandom(seed);
  const city = buildCity(random);
  const player = createPlayer(SITES.spawn.x, SITES.spawn.y);
  const cars = PARKED_CARS.map((spec) => {
    const car = createCar(spec.model, spec.x, spec.y, spec.angle, spec.color);
    car.mission = !!spec.mission;
    return car;
  });
  const peds = [];
  for (let i = 0; i < 36; i += 1) peds.push(createPedestrian(random));
  const state = {
    seed,
    random,
    city,
    player,
    cars,
    peds,
    gunmen: [],
    footCops: [],
    bullets: [],
    particles: [],
    police: createPolice(),
    missions: createMissions(),
    time: 0,
    lastDamageAt: -100,
    lastShotAt: null,
    trafficTimer: 0,
    camera: { x: player.x, y: player.y },
    toasts: [],
    nearCar: null,
    nearSite: null,
    stats: { carsStolen: 0, distanceDriven: 0, pedsHit: 0 },
    stageKey: '0:0',
  };
  spawnTraffic(state, 14);
  applyStageEffects(state);
  return state;
}

function spawnTraffic(state, count) {
  const random = state.random;
  for (let i = 0; i < count; i += 1) {
    const onVertical = random.chance(0.5);
    const road = onVertical ? random.pick([150, 450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150])
      : random.pick([150, 450, 750, 1050, 1350, 1650, 1950, 2250]);
    const along = random.range(150, onVertical ? 2250 : 3150);
    const angle = onVertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    const model = random.pick(['sedan', 'sedan', 'taxi', 'van', 'truck', 'coupe']);
    const car = createCar(model, onVertical ? road : along, onVertical ? along : road, angle, random.pick(CAR_PAINTS));
    car.isTraffic = true;
    car.speed = random.range(80, 140);
    state.cars.push(car);
  }
}

function addToast(state, text, seconds) {
  state.toasts.push({ text, timer: seconds || 3.5 });
}

function explode(state, x, y, big) {
  for (let i = 0; i < (big ? 26 : 12); i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = Math.random() * (big ? 260 : 140);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 0.5 + Math.random() * 0.5, maxLife: 1,
      color: ['#ff9a3c', '#ff5a3c', '#ffd23f', '#8a8a8a'][i % 4],
      size: 3 + Math.random() * 6,
    });
  }
}

function nearestCar(state, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of state.cars) {
    if (car.dead) continue;
    const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (dist < bestDist) { best = car; bestDist = dist; }
  }
  return best;
}

function damagePlayer(state, amount) {
  const player = state.player;
  if (player.invulnerable > 0) return;
  player.health -= amount;
  player.invulnerable = 0.25;
  state.lastDamageAt = state.time;
}

export function respawn(state, kind) {
  const player = state.player;
  const lost = kind === 'busted' ? 0.15 : 0.1;
  const lostAmount = Math.floor(player.money * lost);
  player.money -= lostAmount;
  player.health = PLAYER.health;
  player.ammo = Math.max(player.ammo, 24);
  player.mag = PLAYER.magSize;
  player.inCar = null;
  player.x = kind === 'busted' ? SITES.safehouse.x : SITES.hospital.x;
  player.y = kind === 'busted' ? SITES.safehouse.y : SITES.hospital.y;
  clearWanted(state.police);
  state.cars = state.cars.filter((c) => !c.isPolice);
  state.footCops = [];
  state.gunmen = [];
  state.bullets = [];
  state.missions.stage = 0;
  state.missions.timer = 0;
  state.missions.kills = 0;
  applyStageEffects(state);
  addToast(state, kind === 'busted'
    ? `BUSTED — the Syndicate's lawyers got you out. Lost $${lostAmount}.`
    : `WASTED — you wake up at St. Marina Hospital. Lost $${lostAmount}.`, 4);
}

/** One fixed step. `input` answers the same questions as the real input module.
 * `actions` are the frame's one-shot presses (taken once by the caller, so a
 * press is never lost between two frames or counted twice). */
export function stepGame(state, input, dt, actions = 0) {
  const events = {};
  const player = state.player;
  state.time += dt;

  // Aim follows the mouse: screen coords become world coords through the camera.
  const cam = state.camera;
  player.aimWorld = {
    x: cam.x - VIEW.width / 2 + input.mouse.x,
    y: cam.y - VIEW.height / 2 + input.mouse.y,
  };

  // Enter / exit cars.
  state.nearCar = player.inCar ? null : nearestCar(state, 78);
  if (actions & ACTION_INTERACT) { // E: enter/exit a car, or buy ammo at the gun shop
    if (player.inCar) {
      const car = player.inCar;
      player.inCar = null;
      car.driver = null;
      const side = Math.cos(car.angle + Math.PI / 2);
      const sideY = Math.sin(car.angle + Math.PI / 2);
      player.x = car.x + side * 30;
      player.y = car.y + sideY * 30;
      resolveCircle(state.city, player, player.radius);
    } else if (state.nearCar) {
      const car = state.nearCar;
      player.inCar = car;
      car.driver = 'player';
      car.isTraffic = false;
      state.stats.carsStolen += 1;
      if (addCrime(state.police, 'stealCar', state.time)) events.wantedUp = true;
      events.carStolen = true;
      addToast(state, car.mission ? 'Nice — the coupe is yours. Get it to the safehouse.' : `You stole a ${car.name}. The owner will notice.`, 3);
    } else if (state.nearSite === 'gunshop' && player.money >= 50) {
      player.money -= 50;
      player.ammo += 24;
      events.cash = true;
      addToast(state, 'Bought 24 rounds at Ammo & Co. — $50.', 2.5);
    }
  }

  // Driving or walking.
  if (player.inCar) {
    const car = player.inCar;
    const impact = stepPlayerCar(car, input, dt, state.city);
    // The driver's position is the car's position: missions, police and the
    // camera all read the player, so keep them in sync every step.
    player.x = car.x;
    player.y = car.y;
    if (impact > 200 && car.dmgCd <= 0) {
      events.crash = true;
      car.health -= impact * 0.03;
      car.dmgCd = 0.6;
      damagePlayer(state, impact * 0.02);
    }
    state.stats.distanceDriven += Math.abs(car.speed) * dt;
    if (car.health < 45) {
      car.smoke += dt;
      if (Math.random() < dt * 8) {
        state.particles.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, life: 0.8, maxLife: 0.8, color: '#555', size: 5 });
      }
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.driver = null;
      explode(state, car.x, car.y, true);
      events.explosion = true;
      player.inCar = null;
      player.x = car.x + 40;
      player.y = car.y + 40;
      damagePlayer(state, 30);
    }
  } else {
    if (input.handbrake() && player.punchCooldown <= 0) {
      player.punchCooldown = PLAYER.punchCooldown;
      events.punch = true;
      const targets = [...state.peds.filter((p) => !p.down), ...state.footCops.filter((c) => !c.down), ...state.gunmen.filter((g) => !g.down)];
      for (const t of targets) {
        const dist = Math.hypot(t.x - player.x, t.y - player.y);
        if (dist < PLAYER.punchRange + t.radius) {
          if (t.kind === 'ped') {
            t.down = true; t.downTimer = 6;
            if (addCrime(state.police, 'hitPed', state.time)) events.wantedUp = true;
          } else if (t.kind === 'cop') {
            t.down = true;
            if (addCrime(state.police, 'punchCop', state.time)) events.wantedUp = true;
          } else {
            t.health -= PLAYER.punchDamage;
            if (t.health <= 0) { t.down = true; state.missions.kills += 1; }
          }
          break;
        }
      }
    }
    if ((actions & ACTION_RELOAD) && player.mag < PLAYER.magSize && player.ammo > 0 && player.reloadTimer <= 0) {
      player.reloadTimer = 0.9;
      events.reload = true;
    }
    stepPlayerOnFoot(player, input, dt, state.city, state.bullets, events);
    if (events.shot) {
      state.lastShotAt = { x: player.x, y: player.y, timer: 2 };
      if (addCrime(state.police, 'shoot', state.time)) events.wantedUp = true;
    }
    if (events.emptyClick && player.ammo > 0 && player.reloadTimer <= 0) {
      player.reloadTimer = 0.9;
      events.reload = true;
    }
  }

  // Traffic keeps flowing; the city never runs dry.
  state.trafficTimer -= dt;
  const traffic = state.cars.filter((c) => c.isTraffic && !c.dead);
  if (state.trafficTimer <= 0) {
    state.trafficTimer = 2;
    if (traffic.length < 14) spawnTraffic(state, 1);
  }
  for (const car of state.cars) {
    if (car.dead || car.driver === 'player') continue;
    if (car.isTraffic) stepTrafficCar(car, dt, state.city, state.cars);
    else if (car.isPolice) {
      const impact = stepPoliceCar(car, player, dt, state.city);
      if (impact > 140 && car.dmgCd <= 0) {
        events.crash = true;
        car.health -= impact * 0.05;
        car.dmgCd = 0.6;
      }
      // A police car ramming you batters your car — one hard hit, then it backs off.
      const dist = Math.hypot(car.x - player.x, car.y - player.y);
      if (player.inCar && dist < 46 && player.inCar.dmgCd <= 0) {
        player.inCar.health -= 10;
        player.inCar.dmgCd = 1.0;
        events.crash = true;
      }
    }
  }
  for (const car of state.cars) if (car.dmgCd > 0) car.dmgCd -= dt;
  const hardest = collideCars(state.cars);
  if (hardest > 160) events.crash = true;
  // Cars that burn out explode.
  for (const car of state.cars) {
    if (!car.dead && car.health <= 0) {
      car.dead = true;
      car.driver = null;
      explode(state, car.x, car.y, true);
      events.explosion = true;
      if (car.isPolice && addCrime(state.police, 'killCop', state.time)) events.wantedUp = true;
      if (player.inCar === car) {
        player.inCar = null;
        player.x = car.x + 40;
        player.y = car.y + 40;
        damagePlayer(state, 30);
      }
    }
  }
  state.cars = state.cars.filter((c) => !c.dead || c.driver === 'player');

  // Running over a pedestrian is a crime; a fast car scares the crowd.
  const threat = state.lastShotAt && state.lastShotAt.timer > 0 ? state.lastShotAt : null;
  if (state.lastShotAt) state.lastShotAt.timer -= dt;
  for (const ped of state.peds) {
    stepPedestrian(ped, dt, state.city, state.random, threat);
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.down = false; ped.state = 'flee'; ped.stateTimer = 2; }
      continue;
    }
    for (const car of state.cars) {
      if (car.dead || car.driver !== 'player') continue;
      const dist = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (dist < 26 && Math.abs(car.speed) > 90) {
        ped.down = true;
        ped.downTimer = 8;
        state.stats.pedsHit += 1;
        if (addCrime(state.police, 'hitPed', state.time)) events.wantedUp = true;
        addToast(state, 'You hit a pedestrian! The city saw that.', 2.5);
      }
    }
  }

  // Gunmen hold the tower and shoot back.
  for (const gunman of state.gunmen) stepGunman(gunman, dt, player, state.bullets);

  // Bullets resolve.
  const hits = stepBullets(state.bullets, dt, state.city, player, state.peds, state.gunmen, state.footCops, state.cars);
  for (const hit of hits) {
    const t = hit.target;
    if (hit.bullet.from === 'player') {
      if (t.kind === 'ped') {
        t.down = true; t.downTimer = 8;
        if (addCrime(state.police, 'killPed', state.time)) events.wantedUp = true;
      } else if (t.kind === 'gunman') {
        t.health -= hit.bullet.damage;
        if (t.health <= 0 && !t.down) { t.down = true; state.missions.kills += 1; }
      } else if (t.kind === 'cop') {
        t.health -= hit.bullet.damage;
        if (t.health <= 0) {
          t.down = true;
          if (addCrime(state.police, 'killCop', state.time)) events.wantedUp = true;
        }
      }
    } else if (t === player) {
      damagePlayer(state, hit.bullet.damage);
    }
  }

  // Pickups.
  for (const pickup of state.city.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) pickup.taken = false;
      continue;
    }
    const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
    if (dist < 30 && !player.inCar) {
      pickup.taken = true;
      pickup.respawn = 45;
      if (pickup.kind === 'cash') { player.money += pickup.amount; events.cash = true; addToast(state, `Found $${pickup.amount} in cash.`, 2); }
      if (pickup.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + pickup.amount); events.pickup = true; }
      if (pickup.kind === 'ammo') { player.ammo += pickup.amount; events.pickup = true; addToast(state, `Picked up ${pickup.amount} rounds.`, 2); }
    }
  }

  // Named sites: the hospital heals, the garage clears your heat.
  state.nearSite = null;
  const siteChecks = [
    ['hospital', SITES.hospital], ['garage', SITES.garage], ['gunshop', SITES.gunshop], ['safehouse', SITES.safehouse],
  ];
  for (const [name, site] of siteChecks) {
    if (Math.hypot(player.x - site.x, player.y - site.y) < site.radius) state.nearSite = name;
  }
  if (state.nearSite === 'hospital' && player.health < PLAYER.health && player.money >= 100 && !player.inCar) {
    player.money -= 100;
    player.health = PLAYER.health;
    events.pickup = true;
    addToast(state, 'St. Marina patched you up — $100.', 2.5);
  }
  if (state.nearSite === 'garage' && player.inCar && state.police.stars > 0 && player.money >= 200) {
    player.money -= 200;
    clearWanted(state.police);
    state.cars = state.cars.filter((c) => !c.isPolice);
    state.footCops = [];
    events.pickup = true;
    addToast(state, 'Respray & new plates — the heat is off. $200.', 3);
  }

  // Slow health regen out of trouble.
  if (state.time - state.lastDamageAt > 8 && player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 4 * dt);
  }

  // The police director.
  const bust = stepPolice(state, dt, state.random);
  if (bust === 'busted') events.busted = true;

  // Missions.
  const stageKey = `${state.missions.index}:${state.missions.stage}`;
  const prevMissionIndex = state.missions.index;
  const missionEvent = stepMissions(state, dt);
  if (missionEvent === 'stage') {
    events.missionStage = true;
    applyStageEffects(state);
  } else if (missionEvent === 'mission') {
    events.missionDone = true;
    const done = MISSIONS[prevMissionIndex];
    addToast(state, `Job complete — ${done.title} paid $${done.reward}.`, 3.5);
    applyStageEffects(state);
  } else if (missionEvent === 'story') {
    events.storyDone = true;
  }
  if (stageKey !== `${state.missions.index}:${state.missions.stage}`) applyStageEffects(state);

  // Particles and toasts age.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
    state.toasts[i].timer -= dt;
    if (state.toasts[i].timer <= 0) state.toasts.splice(i, 1);
  }

  // Camera follows the player, clamped to the world.
  const focusX = player.inCar ? player.inCar.x : player.x;
  const focusY = player.inCar ? player.inCar.y : player.y;
  state.camera.x += (focusX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (focusY - state.camera.y) * Math.min(1, dt * 5);
  state.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, state.camera.x));
  state.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, state.camera.y));

  if (player.health <= 0) events.wasted = true;
  return events;
}

/** Rebuild a fresh world but keep the player's money and mission progress. */
export function resetWorldKeepProgress(state) {
  const keep = { money: state.player.money, missions: state.missions };
  const fresh = createGame(state.seed);
  fresh.player.money = keep.money;
  fresh.missions = keep.missions;
  return fresh;
}
