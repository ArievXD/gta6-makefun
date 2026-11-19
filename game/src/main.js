// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// busted/wasted, and story complete. Money, jobs and your best run are saved in
// localStorage whenever a job pays out or you quit to the title.
//
// ?seed=N fixes the city. ?shot=drive|chase|mission|start (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createGame, respawn, stepGame } from './game.js';
import { ACTION_MUTE, ACTION_PAUSE, createInput, createScriptedInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best run then lasts this visit only.
  }
}

function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      money: state.player.money,
      health: state.player.health,
      ammo: state.player.ammo,
      missionIndex: state.missions.index,
      missionStage: state.missions.stage,
      completedCount: state.missions.completedCount,
      done: state.missions.done,
      x: state.player.x,
      y: state.player.y,
    }));
  } catch {
    // Storage can be off: the run then lasts this visit only.
  }
}

function loadSaveInto(state, save) {
  const player = state.player;
  player.money = save.money;
  player.health = save.health;
  player.ammo = save.ammo;
  player.x = save.x;
  player.y = save.y;
  state.missions.index = save.missionIndex;
  state.missions.stage = save.missionStage;
  state.missions.completedCount = save.completedCount;
  state.missions.done = !!save.done;
  state.camera.x = player.x;
  state.camera.y = player.y;
}

function runShot(name) {
  const scene = stageShot(name, seed);
  const save = readSave();
  const ui = { best: readBest(), save, muted: false, overKind: null, lost: 0 };
  let painted = 0;
  function paint() {
    renderer.draw(scene.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  window.__neon = { state: scene.state, screen: scene.screen, shot: name };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = createGame(seed);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let muted = false;
  let overKind = null;
  let lost = 0;
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;

  const ui = {
    get best() { return best; },
    get save() { return save; },
    get muted() { return muted; },
    get overKind() { return overKind; },
    get lost() { return lost; },
  };
  window.__neon = {
    get state() { return state; },
    get screen() { return screen; },
    get best() { return best; },
    start() { newGame(); },
    continueGame() { continueGame(); },
  };

  function announce(message) {
    status.textContent = message;
  }

  function newGame() {
    state = createGame(Math.floor(Math.random() * 4294967296));
    screen = SCREEN_PLAY;
    accumulator = 0;
    audio.unlock();
    audio.click();
    announce('Playing. Job 1: steal the coupe at the Harbor Diner.');
  }

  function continueGame() {
    const found = readSave();
    if (!found) { newGame(); return; }
    state = createGame(seed);
    loadSaveInto(state, found);
    screen = SCREEN_PLAY;
    accumulator = 0;
    audio.unlock();
    audio.click();
    announce('Continuing. Job ' + (state.missions.index + 1) + ' of 5.');
  }

  function quitToTitle() {
    saveGame(state);
    save = readSave();
    state = createGame(seed);
    screen = SCREEN_TITLE;
    announce('Neon Harbor. Press Enter to continue, Space for a new game.');
  }

  function handleEvents(events) {
    if (events.shot) audio.shoot();
    if (events.crash) audio.crash();
    if (events.explosion) audio.explosion();
    if (events.cash) audio.cash();
    if (events.pickup) audio.pickup();
    if (events.punch) audio.punch();
    if (events.reload) audio.reload();
    if (events.wantedUp) audio.wanted();
    if (events.missionStage) audio.pickup();
    if (events.missionDone || events.storyDone) {
      audio.missionDone();
      if (state.player.money > best) { best = state.player.money; writeBest(best); }
      saveGame(state);
      save = readSave();
    }
    if (events.busted || events.wasted) {
      audio.busted();
      overKind = events.busted ? 'busted' : 'wasted';
      lost = Math.floor(state.player.money * (events.busted ? 0.15 : 0.1));
      respawn(state, overKind);
      saveGame(state);
      save = readSave();
      screen = SCREEN_OVER;
      announce(overKind === 'busted' ? 'Busted. Press Enter to get back out there.' : 'Wasted. Press Enter to get back out there.');
    }
    if (events.storyDone) {
      screen = SCREEN_COMPLETE;
      announce('Story complete. King of the Harbor.');
    }
  }

  // Screen changes come from dedicated keys and clicks, so Space means "new game"
  // on the title and "punch" while playing, never both at once.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (screen === SCREEN_TITLE) {
      if (event.code === 'Enter') continueGame();
      else if (event.code === 'Space') newGame();
    } else if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      if (event.code === 'Enter' || event.code === 'Space') {
        screen = SCREEN_PLAY;
        accumulator = 0;
        announce('Playing.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (event.code === 'Enter') {
        screen = SCREEN_PLAY;
        accumulator = 0;
        announce('Playing.');
      } else if (event.code === 'KeyS') {
        quitToTitle();
      }
    }
  });
  canvas.addEventListener('pointerdown', () => {
    if (screen === SCREEN_TITLE) newGame();
    else if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      screen = SCREEN_PLAY;
      accumulator = 0;
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += delta;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the menu while the camera drifts.
      titleTime += delta;
      const attract = createScriptedInput();
      while (accumulator >= STEP) {
        stepGame(state, attract, STEP);
        accumulator -= STEP;
      }
      state.camera.x = 1800 + Math.sin(titleTime * 0.05) * 500;
      state.camera.y = 1200 + Math.cos(titleTime * 0.04) * 300;
      renderer.draw(state, screen, ui);
      return;
    }
    if (screen === SCREEN_PLAY) {
      audio.unlock();
      let firstStep = true;
      while (accumulator >= STEP) {
        const events = stepGame(state, input, STEP, firstStep ? actions : 0);
        firstStep = false;
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
      const player = state.player;
      audio.engine(!!player.inCar, player.inCar ? Math.abs(player.inCar.speed) / player.inCar.top : 0);
      audio.siren(state.police.sirenOn);
    } else {
      accumulator = 0;
      audio.engine(false, 0);
      audio.siren(false);
    }
    renderer.draw(state, screen, ui);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Harbor. Press Enter to continue, Space for a new game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
