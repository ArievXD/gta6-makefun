// The wanted level: crimes raise stars, hiding lowers them, and the police
// director spawns interceptors and foot cops to match. A foot cop who holds you
// for a moment busts you; there is no shooting back at the law without the stars
// climbing further.
import { ROAD_X, ROAD_Y } from './config.js';
import { createCar } from './vehicles.js';
import { resolveCircle } from './city.js';

export const CRIME_HEAT = {
  stealCar: 1,
  hitPed: 1,
  killPed: 1,
  shoot: 0.5,
  killCop: 1,
  punchCop: 1,
};

/** Stars are integers 0-5. Heat is the running total; each whole star needs one heat. */
export function createPolice() {
  return {
    stars: 0,
    heat: 0,
    decayTimer: 0,
    spawnTimer: 0,
    arrestTimer: 0,
    crimeCooldowns: {},
    sirenOn: false,
  };
}

export function addCrime(police, kind, now) {
  const last = police.crimeCooldowns[kind] || -10;
  if (now - last < 2.5) return false;
  police.crimeCooldowns[kind] = now;
  police.heat += CRIME_HEAT[kind] || 0.5;
  const wanted = Math.min(5, Math.max(police.stars, Math.ceil(police.heat)));
  const raised = wanted > police.stars;
  police.stars = wanted;
  police.decayTimer = 0;
  return raised;
}

export function clearWanted(police) {
  police.stars = 0;
  police.heat = 0;
  police.decayTimer = 0;
  police.arrestTimer = 0;
}

/** How many interceptors and foot cops the current stars call for. */
function desiredForces(stars, onFoot) {
  if (stars === 0) return { cars: 0, cops: 0 };
  return {
    cars: Math.min(2 + stars, 6),
    cops: onFoot ? Math.min(stars, 4) : 0,
  };
}

function spawnPointNear(state, random, minDist, maxDist) {
  const angle = random.range(0, Math.PI * 2);
  const dist = random.range(minDist, maxDist);
  const focus = state.player;
  return {
    x: Math.max(60, Math.min(3540, focus.x + Math.cos(angle) * dist)),
    y: Math.max(60, Math.min(2540, focus.y + Math.sin(angle) * dist)),
  };
}

function createFootCop(x, y) {
  return {
    kind: 'cop',
    x, y,
    angle: 0,
    radius: 12,
    health: 100,
    speed: 152,
    down: false,
    color: '#1e3a5f',
  };
}

/**
 * One step of the director. Spawns and despawns forces, steers the interceptors,
 * walks the foot cops at the player, and reports a bust when a cop holds you.
 * Returns 'busted' when the arrest completes, else null.
 */
export function stepPolice(state, dt, random) {
  const police = state.police;
  const player = state.player;
  const onFoot = !player.inCar;
  const want = desiredForces(police.stars, onFoot);
  police.spawnTimer -= dt;

  // Stars cool off when no police can see you.
  let nearestCop = Infinity;
  for (const car of state.cars) {
    if (car.isPolice) nearestCop = Math.min(nearestCop, Math.hypot(car.x - player.x, car.y - player.y));
  }
  for (const cop of state.footCops) nearestCop = Math.min(nearestCop, Math.hypot(cop.x - player.x, cop.y - player.y));
  if (police.stars > 0 && nearestCop > 480) {
    police.decayTimer += dt;
    if (police.decayTimer > 6) {
      police.stars -= 1;
      police.heat = Math.max(0, police.stars);
      police.decayTimer = 0;
    }
  } else {
    police.decayTimer = 0;
  }

  // Spawn interceptors near the player until the force matches the stars.
  const copCars = state.cars.filter((c) => c.isPolice && !c.dead);
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 1.2;
    if (copCars.length < want.cars) {
      const p = spawnPointNear(state, random, 480, 720);
      const car = createCar('police', p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x), '#20242c');
      state.cars.push(car);
    } else if (police.stars === 0 && copCars.length > 0) {
      // The heat is off: the nearest interceptor gives up and drives away.
      copCars[0].dead = true;
    }
    if (state.footCops.length < want.cops) {
      const p = spawnPointNear(state, random, 320, 520);
      state.footCops.push(createFootCop(p.x, p.y));
    }
  }

  // Foot cops run at you; hold one for a moment and you are busted.
  let touching = false;
  for (const cop of state.footCops) {
    if (cop.down) continue;
    const dist = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (dist > 500) continue;
    const angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = angle;
    cop.x += Math.cos(angle) * cop.speed * dt;
    cop.y += Math.sin(angle) * cop.speed * dt;
    resolveCircle(state.city, cop, cop.radius);
    if (dist < 22) touching = true;
  }
  if (touching && onFoot) {
    police.arrestTimer += dt;
    if (police.arrestTimer > 1.2) return 'busted';
  } else {
    police.arrestTimer = 0;
  }

  // Cops far away or downed are cleaned up.
  state.footCops = state.footCops.filter((cop) => {
    if (cop.down) return false;
    const dist = Math.hypot(cop.x - player.x, cop.y - player.y);
    return police.stars > 0 || dist < 900;
  });
  police.sirenOn = police.stars > 0 && copCars.length > 0;
  return null;
}

/** The nearest road point a fixed distance from the player, for spawning cars. */
export function roadSpawnNear(state, random, minDist, maxDist) {
  const p = spawnPointNear(state, random, minDist, maxDist);
  const rx = ROAD_X.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
  const ry = ROAD_Y.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
  return Math.abs(p.x - rx) < Math.abs(p.y - ry) ? { x: rx, y: p.y } : { x: p.x, y: ry };
}
