// Port Solano: the city itself. A seeded grid of roads and blocks, with buildings,
// the docks, the beach, trees, and every solid rectangle the game collides with.
// Nothing here draws or listens to input: it only builds the map and answers
// collision questions, so the simulation and the renderer share one truth.
import { BUILDING_COLORS, ROAD_W, ROAD_X, ROAD_Y, ROOF_COLORS, SITES, WORLD } from './config.js';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Push a circle out of every solid rectangle it overlaps. Returns true on a hit. */
export function resolveCircle(city, pos, radius) {
  let hit = false;
  for (const box of city.colliders) {
    const cx = Math.max(box.x, Math.min(pos.x, box.x + box.w));
    const cy = Math.max(box.y, Math.min(pos.y, box.y + box.h));
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = cx + (dx / dist) * radius;
      pos.y = cy + (dy / dist) * radius;
    } else {
      // Centre inside the box: shove out along the shallowest side.
      const left = pos.x - box.x;
      const right = box.x + box.w - pos.x;
      const top = pos.y - box.y;
      const bottom = box.y + box.h - pos.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = box.x - radius;
      else if (min === right) pos.x = box.x + box.w + radius;
      else if (min === top) pos.y = box.y - radius;
      else pos.y = box.y + box.h + radius;
    }
  }
  // World edges are solid too (the sea keeps you in on the south side).
  if (pos.x < radius) { pos.x = radius; hit = true; }
  if (pos.x > WORLD.width - radius) { pos.x = WORLD.width - radius; hit = true; }
  if (pos.y < radius) { pos.y = radius; hit = true; }
  if (pos.y > WORLD.height - radius) { pos.y = WORLD.height - radius; hit = true; }
  return hit;
}

export function pointOnRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function nearestRoadX(x) {
  let best = ROAD_X[0];
  for (const rx of ROAD_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

export function nearestRoadY(y) {
  let best = ROAD_Y[0];
  for (const ry of ROAD_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const colliders = [];
  const containers = [];
  const siteRects = [
    SITES.safehouseRect, SITES.hospitalRect, SITES.gunshopRect,
    SITES.garageRect, SITES.towerRect, SITES.dinerRect,
  ];

  // One building per lot, in the blocks between roads. Downtown blocks get taller,
  // windowed towers; the rest get low houses and shops in warm coastal colours.
  for (let col = 0; col < ROAD_X.length - 1; col += 1) {
    for (let row = 0; row < ROAD_Y.length - 1; row += 1) {
      const bx = ROAD_X[col] + ROAD_W / 2 + 4;
      const by = ROAD_Y[row] + ROAD_W / 2 + 4;
      const bw = ROAD_X[col + 1] - ROAD_X[col] - ROAD_W - 8;
      const bh = ROAD_Y[row + 1] - ROAD_Y[row] - ROAD_W - 8;
      const downtown = col >= 4 && col <= 6 && row >= 2 && row <= 4;
      const lots = downtown ? 1 : 4;
      for (let lot = 0; lot < lots; lot += 1) {
        if (!downtown && !random.chance(0.62)) continue;
        const lx = bx + (lot % 2) * (bw / 2);
        const ly = by + Math.floor(lot / 2) * (bh / 2);
        const w = downtown ? bw * random.range(0.62, 0.8) : (bw / 2) * random.range(0.62, 0.86);
        const h = downtown ? bh * random.range(0.62, 0.8) : (bh / 2) * random.range(0.62, 0.86);
        const rect = { x: lx + (bw / 2 - w) / 2, y: ly + (bh / 2 - h) / 2, w, h };
        let blocked = false;
        for (const site of siteRects) if (rectsOverlap(rect, site)) { blocked = true; break; }
        if (blocked) continue;
        const colorIndex = random.int(0, BUILDING_COLORS.length - 1);
        const building = {
          ...rect,
          color: BUILDING_COLORS[colorIndex],
          roof: ROOF_COLORS[colorIndex],
          tall: downtown,
          windows: downtown ? random.int(3, 5) : 0,
        };
        buildings.push(building);
        colliders.push(rect);
      }
      // A park in a few quiet blocks instead of buildings.
      if (!downtown && random.chance(0.12)) {
        trees.push({ x: bx + bw * 0.3, y: by + bh * 0.4, r: 16, park: true });
        trees.push({ x: bx + bw * 0.7, y: by + bh * 0.6, r: 14, park: true });
      }
    }
  }

  // Named places are solid too.
  for (const site of siteRects) colliders.push(site);

  // The docks: two warehouses and rows of shipping containers on the east strip.
  const warehouses = [
    { x: 3260, y: 300, w: 220, h: 140 },
    { x: 3260, y: 520, w: 220, h: 140 },
  ];
  for (const wh of warehouses) colliders.push(wh);
  const containerColors = ['#c96a2e', '#3f7fd0', '#2fae7d', '#b04a5e', '#e8c47a'];
  for (let i = 0; i < 10; i += 1) {
    const rect = { x: 3220 + (i % 5) * 70, y: 760 + Math.floor(i / 5) * 60, w: 60, h: 44 };
    containers.push({ ...rect, color: containerColors[i % containerColors.length] });
    colliders.push(rect);
  }

  // The sea at the south edge is solid; the sand in front of it is walkable.
  colliders.push({ x: 0, y: 2490, w: WORLD.width, h: 110 });

  // Palms along the beach and trees on sidewalks.
  for (let x = 120; x < WORLD.width; x += 130) {
    if (random.chance(0.7)) trees.push({ x, y: 2360 + random.range(-30, 30), r: 13, palm: true });
  }
  for (const rx of ROAD_X) {
    for (let y = 200; y < 2250; y += 170) {
      if (random.chance(0.3)) trees.push({ x: rx + ROAD_W / 2 + 14, y, r: 11 });
    }
  }
  for (const ry of ROAD_Y) {
    for (let x = 200; x < 3150; x += 190) {
      if (random.chance(0.3)) trees.push({ x, y: ry + ROAD_W / 2 + 14, r: 11 });
    }
  }

  const pickups = [
    { kind: 'cash', x: 600, y: 600, amount: 200 },
    { kind: 'cash', x: 1200, y: 300, amount: 150 },
    { kind: 'cash', x: 2400, y: 900, amount: 250 },
    { kind: 'cash', x: 900, y: 1800, amount: 200 },
    { kind: 'cash', x: 2100, y: 1500, amount: 300 },
    { kind: 'cash', x: 3000, y: 1200, amount: 200 },
    { kind: 'cash', x: 1500, y: 2100, amount: 150 },
    { kind: 'cash', x: 3300, y: 900, amount: 400 },
    { kind: 'health', x: 1800, y: 480, amount: 50 },
    { kind: 'health', x: 900, y: 600, amount: 50 },
    { kind: 'health', x: 2700, y: 600, amount: 50 },
    { kind: 'ammo', x: 600, y: 2040, amount: 24 },
    { kind: 'ammo', x: 1500, y: 1200, amount: 24 },
    { kind: 'ammo', x: 2400, y: 1800, amount: 24 },
  ].map((p) => ({ ...p, taken: false, respawn: 0 }));

  return { buildings, trees, colliders, containers, warehouses, pickups };
}
