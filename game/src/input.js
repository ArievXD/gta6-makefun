// Keyboard and mouse input. Held keys give a movement or steering vector; one-shot
// presses (confirm, pause, interact, reload, mute) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) keys.add(event.code);
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (INTERACT.has(event.code)) { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (RELOAD.has(event.code)) { if (!event.repeat) actions |= ACTION_RELOAD; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    if (event.code !== 'F5') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  function has(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    mouse,
    /** Raw held-key vector, normalised. */
    moveVector() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    throttle() { return (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0); },
    steer() { return (has(LEFT) ? 1 : 0) - (has(RIGHT) ? 1 : 0); },
    handbrake() { return keys.has('Space'); },
    nitro() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
  };
}

/** A scripted input source for the deterministic screenshot scenes: it answers the
 * same questions the real input does, so the game cannot tell the difference. */
export function createScriptedInput() {
  const input = {
    mouse: { x: 640, y: 360, down: false, clicked: false },
    move: { x: 0, y: 0 },
    throttleValue: 0,
    steerValue: 0,
    brake: false,
    boost: false,
    actionsValue: 0,
    moveVector() { return this.move; },
    throttle() { return this.throttleValue; },
    steer() { return this.steerValue; },
    handbrake() { return this.brake; },
    nitro() { return this.boost; },
    takeActions() { const a = this.actionsValue; this.actionsValue = 0; return a; },
    takeClick() { return false; },
  };
  return input;
}
