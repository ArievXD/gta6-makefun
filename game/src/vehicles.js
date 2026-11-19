// Cars: the player's ride, street traffic and police interceptors. One physics
// model for all of them — throttle, steering that bites harder the faster you go,
// handbrake slides, collisions with buildings and each other — and three drivers:
// the player, a traffic driver that follows the road grid, and a police driver
// that steers straight at its target.
import { CAR_MODELS, ROAD_W, ROAD_X, ROAD_Y } from './config.js';
import { nearestRoadX, nearestRoadY, resolveCircle } from './city.js';

let nextCarId = 1;

export function createCar(model, x, y, angle, color) {
  const spec = CAR_MODELS[model] || CAR_MODELS.sedan;
  return {
    id: nextCarId,
    kind: 'car',
    model,
    name: spec.name,
    x, y, angle,
    speed: 0,
    top: spec.top,
    accel: spec.accel,
    grip: spec.grip,
    length: spec.length,
    width: spec.width,
    health: 100,
    color: color || spec.color || '#d0d3d8',
    isPolice: model === 'police',
    isTraffic: false,
    driver: null,
    smoke: 0,
    dead: false,
    turnCooldown: 0,
    brakeLight: false,
    dmgCd: 0, // seconds until this car can take collision damage again
  };
}

export function resetCarIds() { nextCarId = 1; }

/** Shared chassis step: move, collide with the city, report impact speed (0 if free). */
function moveCar(car, city, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const radius = Math.max(car.length, car.width) / 2 - 4;
  if (resolveCircle(city, car, radius)) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    return impact;
  }
  return 0;
}

/** The player driving: W/S throttle, A/D steer, Space handbrake, Shift nitro. */
export function stepPlayerCar(car, input, dt, city) {
  const throttle = input.throttle();
  const steer = input.steer();
  const handbrake = input.handbrake();
  const nitro = input.nitro() && car.nitroMeter > 0;
  const top = nitro ? car.top * 1.25 : car.top;
  const accel = nitro ? car.accel * 1.7 : car.accel;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0 ? accel * 1.4 : accel * 0.7) * dt;
  else car.speed -= car.speed * 0.6 * dt;
  if (handbrake) {
    car.speed -= car.speed * 2.2 * dt;
    car.angle -= steer * car.grip * 1.9 * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 120);
  } else {
    car.angle -= steer * car.grip * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 140);
  }
  car.speed = Math.max(-150, Math.min(top, car.speed));
  if (nitro) car.nitroMeter = Math.max(0, car.nitroMeter - dt * 0.5);
  else car.nitroMeter = Math.min(1, (car.nitroMeter || 0) + dt * 0.08);
  car.brakeLight = throttle < 0 || handbrake;
  return moveCar(car, city, dt);
}

/** Traffic: follow the road grid on the right-hand lane, turn at intersections,
 * and brake for the car ahead. Headings are always axis-aligned: 0 east, 1 south,
 * 2 west, 3 north. */
export function stepTrafficCar(car, dt, city, cars) {
  if (car.turnCooldown > 0) car.turnCooldown -= dt;
  const heading = ((Math.round(car.angle / (Math.PI / 2)) % 4) + 4) % 4;
  // Ease sideways onto the right-hand lane of the current road.
  if (heading === 0 || heading === 2) {
    // Moving east/west along a horizontal road: right side is south/north.
    const laneY = nearestRoadY(car.y) + (heading === 0 ? 16 : -16);
    car.y += (laneY - car.y) * Math.min(1, dt * 2);
  } else {
    // Moving south/north along a vertical road: right side is west/east.
    const laneX = nearestRoadX(car.x) + (heading === 1 ? -16 : 16);
    car.x += (laneX - car.x) * Math.min(1, dt * 2);
  }
  // Brake for a car ahead on the same road.
  let targetSpeed = car.top * 0.55;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 95 && side < 30) { targetSpeed = 0; break; }
  }
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  // At an intersection, sometimes turn.
  const nearX = nearestRoadX(car.x);
  const nearY = nearestRoadY(car.y);
  const atCrossing = Math.abs(car.x - nearX) < 10 && Math.abs(car.y - nearY) < 10;
  if (atCrossing && car.turnCooldown <= 0 && Math.random() < 0.35) {
    const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += turn;
    car.turnCooldown = 1.2;
  }
  car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
  moveCar(car, city, dt);
}

/** Police interceptor: steer straight at the target and ram it — unless the
 * target is on foot, in which case it stops well short and lets the foot cops work. */
export function stepPoliceCar(car, target, dt, city) {
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  const standOff = target.inCar ? 0 : 150;
  const targetSpeed = dist > standOff + 30 ? car.top : 0;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.5);
  return moveCar(car, city, dt);
}

/** Push overlapping cars apart; returns the hardest hit speed for damage/sound. */
export function collideCars(cars) {
  let hardest = 0;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = (a.length + b.length) / 2 - 10;
      if (dist >= min || dist === 0) continue;
      const push = (min - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 60) {
        hardest = Math.max(hardest, impact);
        // Damage is rate-limited: a pile-up is one crash, not ten.
        if (a.dmgCd <= 0 && b.dmgCd <= 0) {
          a.health -= impact * 0.06;
          b.health -= impact * 0.06;
          a.dmgCd = 0.5;
          b.dmgCd = 0.5;
        }
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.6;
        b.speed = avg * 0.6;
      }
    }
  }
  return hardest;
}

/** The nearest road point to (x, y): where a car re-enters the grid. */
export function nearestRoadPoint(x, y) {
  const rx = nearestRoadX(x);
  const ry = nearestRoadY(y);
  return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
}

export function roadPointIsOnGrid(x, y) {
  const onX = ROAD_X.some((rx) => Math.abs(x - rx) <= ROAD_W / 2);
  const onY = ROAD_Y.some((ry) => Math.abs(y - ry) <= ROAD_W / 2);
  return onX || onY;
}
