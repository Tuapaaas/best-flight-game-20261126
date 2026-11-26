// Skylark Courier — keyboard and mouse input. Keys are read as a held set so
// throttle and pitch can be held together; mouse clicks land on menu buttons
// and drop a parcel mid-flight.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseX: 0,
    mouseY: 0,
    clicked: null, // {x, y} of the last unconsumed click, canvas coordinates
    anyKeyPressed: false,
  };

  const KEYMAP = {
    ArrowUp: 'throttleUp',
    KeyW: 'throttleUp',
    ArrowDown: 'throttleDown',
    KeyS: 'throttleDown',
    ArrowLeft: 'pitchUp',
    KeyA: 'pitchUp',
    ArrowRight: 'pitchDown',
    KeyD: 'pitchDown',
    Space: 'drop',
    KeyP: 'pause',
    KeyR: 'restart',
    KeyM: 'mute',
    Enter: 'confirm',
  };

  function actionOf(e) {
    return KEYMAP[e.code] || null;
  }

  window.addEventListener('keydown', (e) => {
    const action = actionOf(e);
    if (!action) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      keys.add(action);
      state.anyKeyPressed = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    const action = actionOf(e);
    if (action) keys.delete(action);
  });

  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    state.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    state.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    state.clicked = { x: state.mouseX, y: state.mouseY };
  });

  return state;
}

// Edge-triggered actions: consumed once per press so holding SPACE does not
// drop a parcel every frame.
export function createEdgeTracker(input) {
  const seen = new Set();
  return {
    pressed(action) {
      const held = input.keys.has(action);
      const was = seen.has(action);
      if (held) seen.add(action);
      else seen.delete(action);
      return held && !was;
    },
    click() {
      const c = input.clicked;
      input.clicked = null;
      return c;
    },
  };
}
