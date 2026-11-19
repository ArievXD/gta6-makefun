// The screenshot scenes behind ?shot=drive|chase|mission|start. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by scripted input that answers the same questions the keyboard does, so the
// frame is what a short game really looks like and the same seed always gives
// the same frame. Nothing here is faked: the car drives, the cops chase, the
// mission marker is live.
import { STEP } from './config.js';
import { createGame, stepGame } from './game.js';
import { createCar } from './vehicles.js';
import { createScriptedInput } from './input.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { applyStageEffects } from './missions.js';
import { ROAD_X, ROAD_Y } from './config.js';

const SAMPLE = STEP;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Steer a car toward a waypoint on the road grid: coast into turns, but keep
 * crawling at low speed so the car never loses steering and stalls mid-turn. */
function driveToward(input, car, target) {
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = wrapAngle(desired - car.angle);
  input.steerValue = diff > 0.08 ? -1 : diff < -0.08 ? 1 : 0;
  input.throttleValue = Math.abs(diff) > 0.4 ? (Math.abs(car.speed) < 80 ? 1 : 0) : 1;
  input.move = { x: 0, y: 0 };
}

/** A rectangular loop of intersections around the car's start, on the road grid:
 * the driver follows it corner to corner and never has to improvise a route. */
function buildLoop(start) {
  const cx = nearestRoadX(start.x);
  const cy = nearestRoadY(start.y);
  const x2 = Math.min(cx + 900, ROAD_X[ROAD_X.length - 1]);
  const y2 = Math.min(cy + 600, ROAD_Y[ROAD_Y.length - 1]);
  return [
    { x: cx, y: cy },
    { x: x2, y: cy },
    { x: x2, y: y2 },
    { x: cx, y: y2 },
  ];
}

function nearestRoadX(x) {
  return ROAD_X.reduce((best, rx) => (Math.abs(rx - x) < Math.abs(best - x) ? rx : best), ROAD_X[0]);
}

function nearestRoadY(y) {
  return ROAD_Y.reduce((best, ry) => (Math.abs(ry - y) < Math.abs(best - y) ? ry : best), ROAD_Y[0]);
}

function putPlayerInCar(state, car) {
  const player = state.player;
  player.inCar = car;
  car.driver = 'player';
  car.isTraffic = false;
  car.top = 260; // staged scenes drive at a pace the turns allow
  player.x = car.x;
  player.y = car.y;
}

function runSteps(state, seconds, drive) {
  const input = createScriptedInput();
  // The loop, starting at the nearest corner ahead of the car, so it never has
  // to turn around — or cut across a block — before it starts driving.
  const loop = buildLoop(state.player);
  const heading = { x: Math.cos(state.player.angle), y: Math.sin(state.player.angle) };
  let corner = -1;
  let bestDist = Infinity;
  for (let i = 0; i < loop.length; i += 1) {
    const align = (loop[i].x - state.player.x) * heading.x + (loop[i].y - state.player.y) * heading.y;
    const dist = Math.hypot(loop[i].x - state.player.x, loop[i].y - state.player.y);
    if (align > 0 && dist < bestDist) { corner = i; bestDist = dist; }
  }
  if (corner === -1) {
    corner = 0;
    for (let i = 1; i < loop.length; i += 1) {
      if (Math.hypot(loop[i].x - state.player.x, loop[i].y - state.player.y)
        < Math.hypot(loop[corner].x - state.player.x, loop[corner].y - state.player.y)) corner = i;
    }
  }
  // Stuck detection is windowed: compare the position once a second, so normal
  // driving (about 5 px a step) never looks stuck.
  let lastCheckPos = { x: state.player.x, y: state.player.y };
  let checkTimer = 0;
  let reversing = 0;
  for (let t = 0; t < seconds; t += SAMPLE) {
    if (drive && state.player.inCar) {
      const car = state.player.inCar;
      const target = loop[corner];
      // Switch to the next corner early, so the turn arcs through the intersection.
      if (Math.hypot(car.x - target.x, car.y - target.y) < 130) corner = (corner + 1) % loop.length;
      if (reversing > 0) {
        reversing -= SAMPLE;
        input.throttleValue = -1;
        input.steerValue = 1;
      } else {
        driveToward(input, car, loop[corner]);
      }
      // Wedged against a building or pinned by police: back up and try again.
      checkTimer += SAMPLE;
      if (checkTimer >= 1) {
        checkTimer = 0;
        if (Math.hypot(car.x - lastCheckPos.x, car.y - lastCheckPos.y) < 25) reversing = 0.8;
        lastCheckPos = { x: car.x, y: car.y };
      }
    }
    stepGame(state, input, SAMPLE);
  }
  return state;
}

/**
 * Set the world to the named scene and return the screen to draw over it.
 * drive: the coupe through downtown with traffic. chase: a 3-star pursuit.
 * mission: the Harbor Job's cash grab at the docks. start: the title screen.
 */
export function stageShot(name, seed) {
  const state = createGame(seed);
  if (name === 'drive') {
    const coupe = state.cars.find((c) => c.mission);
    putPlayerInCar(state, coupe);
    runSteps(state, 16, true);
    return { state, screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    const sedan = state.cars.find((c) => c.model === 'sedan' && !c.isTraffic);
    putPlayerInCar(state, sedan);
    state.missions.index = 2;
    state.missions.stage = 0;
    applyStageEffects(state);
    state.police.stars = 3;
    state.police.heat = 3;
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2;
      const car = createCar('police', state.player.x + Math.cos(angle) * 420, state.player.y + Math.sin(angle) * 420, angle, '#20242c');
      state.cars.push(car);
    }
    runSteps(state, 6, true);
    return { state, screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    state.missions.index = 3;
    state.missions.stage = 1;
    applyStageEffects(state);
    state.player.x = 3180;
    state.player.y = 620;
    state.police.stars = 2;
    state.police.heat = 2;
    for (let i = 0; i < 2; i += 1) {
      state.footCops.push({
        kind: 'cop', x: 3180 + (i === 0 ? -420 : 420), y: 760, angle: 0,
        radius: 12, health: 100, speed: 152, down: false, color: '#1e3a5f',
      });
    }
    const car = createCar('police', 3150, 760, 0, '#20242c');
    state.cars.push(car);
    // Walk toward the cash duffel, stopping just short of it, while the cops close in.
    const input = createScriptedInput();
    for (let t = 0; t < 3.5; t += SAMPLE) {
      const dx = 3330 - state.player.x;
      const dy = 690 - state.player.y;
      const len = Math.hypot(dx, dy) || 1;
      input.move = len < 12 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
      stepGame(state, input, SAMPLE);
    }
    return { state, screen: SCREEN_PLAY };
  }
  // Title: let the city live for a few seconds, camera over downtown.
  runSteps(state, 8, false);
  state.camera.x = 1800;
  state.camera.y = 1200;
  return { state, screen: SCREEN_TITLE };
}
