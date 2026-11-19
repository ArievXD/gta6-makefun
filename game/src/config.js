// Every tuning number, colour and named place in one place. The world is a fixed
// 3600x2600 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. Port Solano is an original sun-soaked coastal city:
// no Rockstar names, map, art or music anywhere in this game.

// Neon Harbor — a Port Solano story. You are Rex Marlowe, a wheelman who owes the
// Harbor Syndicate fifty thousand dollars. Five jobs stand between you and freedom.
export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const VIEW = { width: 1280, height: 720 };

/** Road centrelines. Roads are ROAD_W wide; blocks sit between them. */
export const ROAD_X = [150, 450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150];
export const ROAD_Y = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];
export const ROAD_W = 90;

/** Where the best run is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-harbor.save.v1';
export const BEST_KEY = 'neon-harbor.best.v1';

export const PALETTE = {
  grass: '#7fae5c',
  park: '#5d8a4a',
  asphalt: '#3d414c',
  asphaltEdge: '#2c2f38',
  sidewalk: '#c9c2b2',
  lane: '#e8d44d',
  sand: '#e8d5a3',
  water: '#2f7fb0',
  waterDeep: '#256b96',
  buildingShadow: 'rgba(0,0,0,0.25)',
  text: '#f2f0e8',
  muted: '#b9bcc4',
  panel: 'rgba(16,18,26,0.82)',
  panelBorder: 'rgba(255,255,255,0.16)',
  star: '#ffd23f',
  starEmpty: '#5a5e6a',
  health: '#58d68d',
  healthLow: '#e5534b',
  money: '#7fe07f',
  marker: '#ffd23f',
  police: '#4d9de0',
  danger: '#e5534b',
};

export const BUILDING_COLORS = ['#d98e6a', '#e8c47a', '#7fb3d5', '#a67c52', '#c97b84', '#8fae8b', '#d9a05b', '#9a8fc7'];
export const ROOF_COLORS = ['#b96a4e', '#c9a85a', '#5d8fae', '#8a6540', '#a85f6a', '#74946f', '#b3813f', '#7d74a8'];
export const CAR_PAINTS = ['#e2452e', '#3f7fd0', '#f2c230', '#7a8a99', '#8a6fb0', '#2fae7d', '#d0d3d8', '#c96a2e'];

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  health: 100,
  magSize: 12,
  startAmmo: 48,
  startMoney: 150,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.45,
  shotDamage: 34,
  shotRange: 430,
  shotCooldown: 0.22,
  bulletSpeed: 900,
};

export const CAR_MODELS = {
  coupe: { name: 'Coupe', top: 430, accel: 310, grip: 2.9, length: 46, width: 22 },
  sedan: { name: 'Sedan', top: 365, accel: 250, grip: 2.5, length: 46, width: 22 },
  taxi: { name: 'Taxi', top: 375, accel: 260, grip: 2.5, length: 46, width: 22 },
  truck: { name: 'Truck', top: 300, accel: 190, grip: 2.0, length: 58, width: 24 },
  van: { name: 'Van', top: 325, accel: 210, grip: 2.2, length: 52, width: 24 },
  police: { name: 'Interceptor', top: 465, accel: 350, grip: 3.1, length: 48, width: 22 },
};

/** Named places. Points are walkable/driveable; rects are solid buildings. */
export const SITES = {
  spawn: { x: 390, y: 390 },
  safehouse: { x: 390, y: 390, radius: 110 },
  safehouseRect: { x: 250, y: 240, w: 90, h: 80 },
  hospital: { x: 1800, y: 420, radius: 90 },
  hospitalRect: { x: 1740, y: 230, w: 120, h: 110 },
  gunshop: { x: 600, y: 1990, radius: 80 },
  gunshopRect: { x: 560, y: 2040, w: 80, h: 90 },
  garage: { x: 2700, y: 1990, radius: 90 },
  garageRect: { x: 2640, y: 2040, w: 80, h: 90 },
  tower: { x: 1905, y: 1200, radius: 100 },
  towerRect: { x: 1740, y: 1140, w: 120, h: 120 },
  diner: { x: 900, y: 1200, radius: 90 },
  dinerRect: { x: 840, y: 1140, w: 120, h: 80 },
  dinerCar: { x: 1020, y: 1200 },
  docksGate: { x: 3150, y: 600, radius: 100 },
  warehouseCrate: { x: 3400, y: 470, radius: 55 },
  docksCash: { x: 3400, y: 700, radius: 55 },
  beach: { x: 1800, y: 2400, radius: 110 },
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
