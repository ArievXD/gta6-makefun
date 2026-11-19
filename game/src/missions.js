// The story: five jobs for the Harbor Syndicate, each a chain of stages. A stage
// is one verb — steal a car, drive to a marker, collect on foot, survive the heat,
// take out the gunmen — and the engine watches the world until it is done, then
// pays out, saves, and opens the next job.
import { SITES } from './config.js';

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Job 1 — Wheels for Hire',
    briefing: 'Mara needs wheels for tonight. Lift the red coupe parked outside the Harbor Diner and bring it to the safehouse garage. No cops, no fuss.',
    reward: 500,
    stages: [
      { type: 'stealCar', carModel: 'coupe', at: SITES.dinerCar, text: 'Steal the red coupe at the Harbor Diner (walk up and press E)' },
      { type: 'driveTo', at: SITES.safehouse, radius: 110, text: 'Drive the coupe to the safehouse garage' },
    ],
  },
  {
    id: 'pickup',
    title: 'Job 2 — The Pickup',
    briefing: 'A crate came in on the night freighter. Drive to the docks, grab it on foot, and bring it home. The docks are Syndicate turf — walk in like you own it.',
    reward: 800,
    stages: [
      { type: 'driveTo', at: SITES.docksGate, radius: 100, text: 'Drive to the docks gate, east side of the city' },
      { type: 'collect', at: SITES.warehouseCrate, radius: 55, text: 'On foot: collect the crate between the warehouses' },
      { type: 'driveTo', at: SITES.safehouse, radius: 110, text: 'Bring the crate back to the safehouse', wanted: 1 },
    ],
  },
  {
    id: 'heat',
    title: 'Job 3 — Lose the Heat',
    briefing: 'The pickup was spotted. Three stars, half the force on your tail. Lose them — stay out of their hands for 45 seconds and the heat dies down.',
    reward: 1000,
    stages: [
      { type: 'survive', seconds: 45, wanted: 3, text: 'Lose the 3-star wanted level — survive 45 seconds' },
    ],
  },
  {
    id: 'harbor-job',
    title: 'Job 4 — The Harbor Job',
    briefing: 'The big one. The Syndicate cash sits in a duffel at the docks warehouse. Take it, and run the whole force back to the safehouse. Do not get caught with it.',
    reward: 2500,
    stages: [
      { type: 'driveTo', at: SITES.docksGate, radius: 100, text: 'Drive to the docks gate' },
      { type: 'collect', at: SITES.docksCash, radius: 55, text: 'On foot: grab the cash duffel by the warehouse' },
      { type: 'driveTo', at: SITES.safehouse, radius: 110, text: 'Escape to the safehouse with the cash', wanted: 3 },
    ],
  },
  {
    id: 'king',
    title: 'Job 5 — King of the Harbor',
    briefing: 'The Syndicate set you up — the debt was never real. Their crew is waiting at the tower downtown. Take out all six gunmen, then drive to the beach and watch the sun come up a free man.',
    reward: 5000,
    stages: [
      { type: 'driveTo', at: SITES.tower, radius: 100, text: 'Drive to the Syndicate tower downtown' },
      { type: 'eliminate', count: 6, at: SITES.tower, radius: 260, text: 'Take out the 6 Syndicate gunmen (aim with the mouse, click to shoot)' },
      { type: 'driveTo', at: SITES.beach, radius: 110, text: 'Drive to the beach — you are free' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    kills: 0,
    done: false,
    completedCount: 0,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] || null;
}

export function currentStage(missions) {
  const mission = currentMission(missions);
  return mission ? mission.stages[missions.stage] : null;
}

/** The marker the minimap and the world arrow point at, for the current stage. */
export function missionTarget(missions) {
  const stage = currentStage(missions);
  if (!stage || !stage.at) return null;
  return { x: stage.at.x, y: stage.at.y };
}

export function missionObjectiveText(missions) {
  const mission = currentMission(missions);
  if (!mission) return 'Free roam — Port Solano is yours.';
  const stage = currentStage(missions);
  if (!stage) return mission.title;
  if (stage.type === 'survive') return `${stage.text} — ${Math.ceil(missions.timer)}s left`;
  if (stage.type === 'eliminate') return `${stage.text} — ${missions.kills}/${stage.count} down`;
  return stage.text;
}

/**
 * Advance the mission engine one step. Returns 'stage', 'mission' or 'story'
 * when something completes, and the caller pays out and announces it.
 */
export function stepMissions(state, dt) {
  const missions = state.missions;
  if (missions.done) return null;
  const mission = currentMission(missions);
  if (!mission) { missions.done = true; return 'story'; }
  const stage = currentStage(missions);
  if (!stage) return null;
  const player = state.player;

  if (stage.type === 'survive') {
    if (missions.timer <= 0) missions.timer = stage.seconds;
    missions.timer -= dt;
    if (missions.timer <= 0) return completeStage(state);
    return null;
  }
  if (stage.type === 'eliminate') {
    if (missions.kills >= stage.count) return completeStage(state);
    return null;
  }
  if (stage.type === 'stealCar') {
    if (player.inCar && player.inCar.model === stage.carModel) return completeStage(state);
    return null;
  }
  const target = stage.at;
  const dist = Math.hypot(player.x - target.x, player.y - target.y);
  if (stage.type === 'driveTo' || stage.type === 'collect') {
    const radius = stage.radius || 90;
    const ok = stage.type === 'collect' ? dist < radius && !player.inCar : dist < radius;
    if (ok) return completeStage(state);
  }
  return null;
}

function completeStage(state) {
  const missions = state.missions;
  const mission = currentMission(missions);
  missions.stage += 1;
  if (missions.stage >= mission.stages.length) {
    state.player.money += mission.reward;
    missions.completedCount += 1;
    missions.index += 1;
    missions.stage = 0;
    missions.timer = 0;
    missions.kills = 0;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      return 'story';
    }
    return 'mission';
  }
  return 'stage';
}

/** Apply a stage's scripted side effects when it starts (heat, gunmen). */
export function applyStageEffects(state) {
  const stage = currentStage(state.missions);
  if (!stage) return;
  if (stage.wanted) {
    state.police.stars = stage.wanted;
    state.police.heat = stage.wanted;
    state.police.decayTimer = 0;
  }
  if (stage.type === 'eliminate' && state.gunmen.length === 0) {
    const spots = [
      { x: 1760, y: 1160 }, { x: 1860, y: 1160 }, { x: 1760, y: 1260 },
      { x: 1860, y: 1260 }, { x: 1800, y: 1120 }, { x: 1800, y: 1300 },
    ];
    for (const spot of spots) state.gunmen.push({ x: spot.x, y: spot.y, angle: 0, radius: 12, health: 50, shotTimer: 0.5 + Math.random(), down: false, color: '#3a3f4a', kind: 'gunman' });
  }
  if (stage.type === 'survive') state.missions.timer = stage.seconds;
}
