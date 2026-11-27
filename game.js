(() => {
  'use strict';

  // =========================================================================
  // 1. ROOM DEFINITIONS (Separated Data Layer)
  // Legend:
  //   '#' = Wall
  //   '.' = Floor
  //   'S' = Player Spawn
  //   'E' = Exit Door (opens when all plates in room are active)
  //   'P' = Core Pressure Plate
  //   '1' = Relay + Core Plate (unlocks Gate 'G' AND counts for Exit 'E')
  //   'G' = Security Gate (controlled by Relay Plate '1')
  // =========================================================================
  const ROOMS = [
    {
      id: 1,
      name: 'FIRST MEMORY',
      subtitle: 'Temporal Calibration Wing',
      hint: 'Walk onto the pressure plate, press [R] to rewind and leave an Echo holding it, then walk to the Exit.',
      clearText: 'Your past movement held the circuit open. Echoes remain deterministic from step zero.',
      layout: [
        '###########',
        '#....P....#',
        '#.##...##.#',
        '#.S.....E.#',
        '#.##...##.#',
        '#.........#',
        '###########'
      ]
    },
    {
      id: 2,
      name: 'TOGETHER',
      subtitle: 'Dual Containment Bay',
      hint: 'Both plates must stay occupied at once while you exit. Record Echo 1 on one plate, Echo 2 on the other, then escape.',
      clearText: 'Multiple echoes coexist in the same timeline—each repeating its own recorded route.',
      layout: [
        '############',
        '#..P...#####',
        '#.##.#.#####',
        '#S........E#',
        '#.##.#.#####',
        '#....P.#####',
        '#......#####',
        '############'
      ]
    },
    {
      id: 3,
      name: 'WEIGHT OF THE PAST',
      subtitle: 'Vault Sector 7',
      hint: 'Plate [1] unlocks the Amber Gate [G]. Rewind an Echo onto [1], wait [Space] at the gate until it opens, then place Echoes on [P2] & [P3].',
      clearText: 'All three echoes locked the vault circuits in sequence. Containment failed.',
      layout: [
        '##############',
        '#.1..#.......#',
        '####.#..P..P.#',
        '#....#.#####.#',
        '#S...G.......#',
        '#.##.#.##.##.#',
        '#....#....E..#',
        '#....#.......#',
        '##############'
      ]
    }
  ];

  const MAX_ECHOES = 3;
  const ECHO_PALETTES = [
    { name: 'CYAN', stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.34)', glow: 'rgba(56, 189, 248, 0.7)' },
    { name: 'VIOLET', stroke: '#a78bfa', fill: 'rgba(167, 139, 250, 0.34)', glow: 'rgba(167, 139, 250, 0.7)' },
    { name: 'TEAL', stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.32)', glow: 'rgba(34, 211, 238, 0.68)' }
  ];

  // =========================================================================
  // 2. PROCEDURAL WEB AUDIO ENGINE
  // =========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.master = null;
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.28;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.28, this.ctx.currentTime, 0.02);
      }
    }

    tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null, delay = 0) {
      if (this.muted || !this.ctx || !this.master) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    playMove(isWait = false) {
      this.unlock();
      if (isWait) {
        this.tone(240, 0.06, 'sine', 0.08, 200);
      } else {
        this.tone(185, 0.075, 'triangle', 0.14, 130);
      }
    }

    playBump() {
      this.unlock();
      this.tone(95, 0.11, 'sawtooth', 0.12, 55);
    }

    playRewind() {
      this.unlock();
      this.tone(520, 0.28, 'sine', 0.2, 220);
      this.tone(780, 0.32, 'triangle', 0.14, 330, 0.04);
      this.tone(260, 0.35, 'sine', 0.16, 620, 0.08);
    }

    playPlate(on, byEcho = false) {
      this.unlock();
      if (on) {
        const base = byEcho ? 440 : 392;
        this.tone(base, 0.18, 'sine', 0.2, base * 1.25);
        this.tone(base * 1.5, 0.22, 'triangle', 0.12, null, 0.04);
      } else {
        this.tone(310, 0.12, 'sine', 0.1, 220);
      }
    }

    playDoor(open) {
      this.unlock();
      if (open) {
        this.tone(220, 0.22, 'triangle', 0.18, 440);
        this.tone(554.37, 0.26, 'sine', 0.16, null, 0.06);
        this.tone(659.25, 0.32, 'sine', 0.16, null, 0.12);
      } else {
        this.tone(240, 0.16, 'triangle', 0.12, 140);
      }
    }

    playRoomClear() {
      this.unlock();
      const notes = [392, 493.88, 587.33, 783.99];
      notes.forEach((n, idx) => {
        this.tone(n, 0.34, 'sine', 0.2, null, idx * 0.075);
      });
    }

    playVictory() {
      this.unlock();
      const chord = [261.63, 329.63, 392, 493.88, 587.33, 783.99];
      chord.forEach((n, idx) => {
        this.tone(n, 0.65, idx % 2 === 0 ? 'sine' : 'triangle', 0.18, null, idx * 0.08);
      });
    }
  }

  const audio = new SoundEngine();

  // =========================================================================
  // 3. SINGLE AUTHORITATIVE GAME STATE
  // =========================================================================
  const state = {
    screen: 'title', // 'title' | 'playing' | 'paused' | 'room_clear' | 'victory'
    roomIndex: 0,
    cols: 0,
    rows: 0,
    tiles: [], // 2D array of '#' | '.'
    startPos: { x: 0, y: 0 },
    exit: { x: 0, y: 0, open: false, anim: 0 },
    plates: [], // { id, x, y, isRelay, active, activeBy, pulse }
    gates: [],  // { x, y, open, anim }
    step: 0,
    currentMoves: [], // [{ dx, dy }]
    echoes: [],       // [{ id, paletteIndex, moves, x, y, renderX, renderY, finished, trail }]
    nextEchoId: 1,
    player: { x: 0, y: 0, renderX: 0, renderY: 0, dx: 0, dy: -1, bumpX: 0, bumpY: 0, trail: [] },
    particles: [],
    shockwaves: [],
    ambientDust: [],
    rewindFlash: 0,
    roomFade: 1,
    shakeTime: 0,
    stats: {
      totalSteps: 0,
      totalRewinds: 0,
      roomSteps: 0,
      roomRewinds: 0
    },
    toastTimer: 0
  };

  // =========================================================================
  // 4. DOM REFERENCES & UI HELPERS
  // =========================================================================
  const el = {
    hud: document.getElementById('hud'),
    bottomBar: document.getElementById('bottom-bar'),
    canvasWrap: document.getElementById('canvas-wrap'),
    canvas: document.getElementById('game-canvas'),
    toast: document.getElementById('toast'),
    hudSector: document.getElementById('hud-sector'),
    hudRoomName: document.getElementById('hud-room-name'),
    hudRoomSub: document.getElementById('hud-room-sub'),
    hudStep: document.getElementById('hud-step'),
    hudPlates: document.getElementById('hud-plates'),
    echoSlots: Array.from(document.querySelectorAll('.echo-slot')),
    hintText: document.getElementById('hint-text'),
    muteLabel: document.getElementById('mute-label'),
    btnMute: document.getElementById('btn-mute'),
    btnStartMute: document.getElementById('btn-start-mute'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    roomClearScreen: document.getElementById('room-clear-screen'),
    victoryScreen: document.getElementById('victory-screen'),
    clearRoomTitle: document.getElementById('clear-room-title'),
    clearRoomDesc: document.getElementById('clear-room-desc'),
    clearSteps: document.getElementById('clear-steps'),
    clearEchoes: document.getElementById('clear-echoes'),
    victorySteps: document.getElementById('victory-steps'),
    victoryRewinds: document.getElementById('victory-rewinds')
  };

  const ctx = el.canvas.getContext('2d');
  let toastTimeoutId = null;

  function showToast(msg, variant = 'cyan', duration = 2200) {
    el.toast.textContent = msg;
    el.toast.className = `toast ${variant}`;
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, duration);
  }

  function hideToast() {
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    el.toast.classList.add('hidden');
  }

  function setScreen(screenName) {
    state.screen = screenName;
    el.startScreen.classList.toggle('hidden', screenName !== 'title');
    el.pauseScreen.classList.toggle('hidden', screenName !== 'paused');
    el.roomClearScreen.classList.toggle('hidden', screenName !== 'room_clear');
    el.victoryScreen.classList.toggle('hidden', screenName !== 'victory');

    const inGame = screenName !== 'title';
    el.hud.classList.toggle('hidden', !inGame);
    el.bottomBar.classList.toggle('hidden', !inGame);

    if (inGame) {
      resizeCanvas();
    }
  }

  function syncMuteUI() {
    el.muteLabel.textContent = audio.muted ? 'SFX OFF' : 'SFX ON';
    el.btnMute.classList.toggle('muted', audio.muted);
    el.btnStartMute.textContent = audio.muted ? 'SFX: OFF' : 'SFX: ON';
  }

  function updateHUD() {
    const room = ROOMS[state.roomIndex];
    el.hudSector.textContent = `SECTOR 0${room.id} / 0${ROOMS.length}`;
    el.hudRoomName.textContent = room.name;
    el.hudRoomSub.textContent = room.subtitle;
    el.hudStep.textContent = String(state.step).padStart(2, '0');

    const activeCount = state.plates.filter(p => p.active).length;
    el.hudPlates.textContent = `${activeCount} / ${state.plates.length}`;
    el.hintText.textContent = room.hint;

    el.echoSlots.forEach((slotEl, idx) => {
      slotEl.className = 'echo-slot';
      const stepsSpan = slotEl.querySelector('.slot-steps');
      const echo = state.echoes[idx];
      if (echo) {
        slotEl.classList.add(`active-${echo.paletteIndex}`);
        if (state.echoes.length === MAX_ECHOES && idx === 0) {
          slotEl.classList.add('will-replace');
          slotEl.title = 'Oldest echo — next rewind replaces this slot';
        } else {
          slotEl.title = `Echo ${idx + 1}: ${echo.moves.length} steps`;
        }
        stepsSpan.textContent = `${echo.moves.length}s`;
      } else {
        stepsSpan.textContent = '--';
        slotEl.title = 'Empty echo slot';
      }
    });
  }

  // =========================================================================
  // 5. ROOM LOADING & GAMEPLAY LOGIC
  // =========================================================================
  function loadRoom(index, preserveStats = true) {
    state.roomIndex = index;
    const room = ROOMS[index];
    state.rows = room.layout.length;
    state.cols = room.layout[0].length;
    state.tiles = [];
    state.plates = [];
    state.gates = [];
    state.echoes = [];
    state.currentMoves = [];
    state.particles = [];
    state.shockwaves = [];
    state.step = 0;
    state.rewindFlash = 0;
    state.roomFade = 1;
    state.nextEchoId = 1;
    state.stats.roomSteps = 0;
    state.stats.roomRewinds = 0;

    if (!preserveStats) {
      state.stats.totalSteps = 0;
      state.stats.totalRewinds = 0;
    }

    let plateNum = 1;
    for (let y = 0; y < state.rows; y++) {
      const row = [];
      for (let x = 0; x < state.cols; x++) {
        const ch = room.layout[y][x];
        if (ch === '#') {
          row.push('#');
        } else {
          row.push('.');
          if (ch === 'S') {
            state.startPos = { x, y };
          } else if (ch === 'E') {
            state.exit = { x, y, open: false, anim: 0 };
          } else if (ch === 'P' || ch === '1') {
            state.plates.push({
              id: plateNum++,
              x,
              y,
              isRelay: ch === '1',
              active: false,
              activeBy: null,
              pulse: 0
            });
          } else if (ch === 'G') {
            state.gates.push({ x, y, open: false, anim: 0 });
          }
        }
      }
      state.tiles.push(row);
    }

    resetPlayerToStart();
    initAmbientDust();
    evaluateMechanisms(false);
    hideToast();
    updateHUD();
    resizeCanvas();
  }

  function resetPlayerToStart() {
    state.player.x = state.startPos.x;
    state.player.y = state.startPos.y;
    state.player.renderX = state.startPos.x;
    state.player.renderY = state.startPos.y;
    state.player.dx = 0;
    state.player.dy = -1;
    state.player.bumpX = 0;
    state.player.bumpY = 0;
    state.player.trail = [];
  }

  function initAmbientDust() {
    state.ambientDust = [];
    for (let i = 0; i < 32; i++) {
      state.ambientDust.push({
        x: Math.random() * state.cols,
        y: Math.random() * state.rows,
        vx: (Math.random() - 0.5) * 0.14,
        vy: -0.05 - Math.random() * 0.12,
        r: 0.8 + Math.random() * 1.6,
        alpha: 0.12 + Math.random() * 0.28
      });
    }
  }

  function spawnBurst(gx, gy, color, count = 14) {
    state.shockwaves.push({
      x: gx + 0.5,
      y: gy + 0.5,
      radius: 0.18,
      maxRadius: 1.05,
      life: 1,
      decay: 2.1,
      color
    });
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.45;
      const spd = 0.7 + Math.random() * 2.1;
      state.particles.push({
        x: gx + 0.5,
        y: gy + 0.5,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        decay: 1.4 + Math.random() * 1.2,
        size: 1.6 + Math.random() * 2.4,
        color
      });
    }
  }

  function isPassable(x, y) {
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return false;
    if (state.tiles[y][x] === '#') return false;
    for (const g of state.gates) {
      if (g.x === x && g.y === y && !g.open) return false;
    }
    if (state.exit.x === x && state.exit.y === y && !state.exit.open) return false;
    return true;
  }

  function evaluateMechanisms(withFeedback = true) {
    const prevGatesOpen = state.gates.map(g => g.open);
    const prevExitOpen = state.exit.open;

    for (const plate of state.plates) {
      const prevActive = plate.active;
      let activator = null;

      if (state.player.x === plate.x && state.player.y === plate.y) {
        activator = 'player';
      } else {
        for (let i = 0; i < state.echoes.length; i++) {
          const e = state.echoes[i];
          if (e.x === plate.x && e.y === plate.y) {
            activator = `echo-${i + 1}`;
            break;
          }
        }
      }

      plate.active = activator !== null;
      plate.activeBy = activator;

      if (!prevActive && plate.active) {
        plate.pulse = 1;
        const byEcho = activator.startsWith('echo');
        const col = byEcho ? '#a78bfa' : '#38bdf8';
        spawnBurst(plate.x, plate.y, col, 14);
        if (withFeedback) {
          audio.playPlate(true, byEcho);
          if (byEcho) {
            const num = activator.split('-')[1];
            showToast(`Echo ${num} activated Plate ${plate.id}`, 'violet', 1900);
          }
        }
      } else if (prevActive && !plate.active && withFeedback) {
        audio.playPlate(false, false);
      }
    }

    // Relay plate ('1') controls security gates
    const relayPlates = state.plates.filter(p => p.isRelay);
    const gatesShouldOpen = relayPlates.length > 0 && relayPlates.every(p => p.active);
    state.gates.forEach((g, idx) => {
      g.open = gatesShouldOpen;
      if (withFeedback && !prevGatesOpen[idx] && g.open) {
        audio.playDoor(true);
        spawnBurst(g.x, g.y, '#fbbf24', 18);
        showToast('Security Gate unlocked by Relay Plate!', 'amber', 2200);
      } else if (withFeedback && prevGatesOpen[idx] && !g.open) {
        audio.playDoor(false);
      }
    });

    // Exit opens only when ALL plates in the room are active simultaneously
    const allPlatesActive = state.plates.length > 0 && state.plates.every(p => p.active);
    state.exit.open = allPlatesActive;
    if (withFeedback && !prevExitOpen && state.exit.open) {
      audio.playDoor(true);
      spawnBurst(state.exit.x, state.exit.y, '#67e8f9', 22);
      showToast('Exit Door unlocked! Proceed to the exit.', 'cyan', 2400);
    } else if (withFeedback && prevExitOpen && !state.exit.open) {
      audio.playDoor(false);
    }
  }

  function advanceStep(dx, dy) {
    if (state.screen !== 'playing') return;

    const isWait = dx === 0 && dy === 0;
    if (!isWait) {
      state.player.dx = dx;
      state.player.dy = dy;
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;

      if (!isPassable(nx, ny)) {
        state.player.bumpX = dx * 0.24;
        state.player.bumpY = dy * 0.24;
        state.shakeTime = 0.14;
        audio.playBump();

        const hitGate = state.gates.find(g => g.x === nx && g.y === ny && !g.open);
        const hitExit = state.exit.x === nx && state.exit.y === ny && !state.exit.open;
        if (hitGate) {
          showToast('Gate locked — activate Relay Plate [1] or press [Space] to wait for Echo.', 'amber', 2200);
        } else if (hitExit) {
          showToast('Exit locked — all pressure plates must be active simultaneously.', 'amber', 2100);
        }
        return;
      }

      // Preview whether stepping onto a gate/exit would leave player inside a door that closes this step
      const enteringGateOrExit = state.gates.some(g => g.x === nx && g.y === ny) || (state.exit.x === nx && state.exit.y === ny);
      if (enteringGateOrExit) {
        const nextStepIndex = state.step;
        const nextEchoPositions = state.echoes.map(echo => {
          if (nextStepIndex < echo.moves.length) {
            const m = echo.moves[nextStepIndex];
            if (m.dx !== 0 || m.dy !== 0) {
              const ex = echo.x + m.dx;
              const ey = echo.y + m.dy;
              if (isPassable(ex, ey)) return { x: ex, y: ey };
            }
          }
          return { x: echo.x, y: echo.y };
        });
        const plateActiveNext = (plate) => nextEchoPositions.some(pos => pos.x === plate.x && pos.y === plate.y);
        const relayPlates = state.plates.filter(p => p.isRelay);
        const gateOpenNext = relayPlates.length > 0 && relayPlates.every(plateActiveNext);
        const exitOpenNext = state.plates.length > 0 && state.plates.every(plateActiveNext);
        const targetClosedNext =
          (state.gates.some(g => g.x === nx && g.y === ny) && !gateOpenNext) ||
          (state.exit.x === nx && state.exit.y === ny && !exitOpenNext);
        if (targetClosedNext) {
          state.player.bumpX = dx * 0.24;
          state.player.bumpY = dy * 0.24;
          state.shakeTime = 0.14;
          audio.playBump();
          showToast('Door closing — an echo stepped off its plate.', 'amber', 2100);
          return;
        }
      }

      state.player.trail.push({ x: state.player.x, y: state.player.y, alpha: 0.7 });
      if (state.player.trail.length > 6) state.player.trail.shift();
      state.player.x = nx;
      state.player.y = ny;
    }

    state.currentMoves.push({ dx, dy });
    state.step += 1;
    state.stats.totalSteps += 1;
    state.stats.roomSteps += 1;
    audio.playMove(isWait);

    // Deterministic step-by-step echo replay
    const moveIndex = state.step - 1;
    for (const echo of state.echoes) {
      if (moveIndex < echo.moves.length) {
        const m = echo.moves[moveIndex];
        if (m.dx !== 0 || m.dy !== 0) {
          const ex = echo.x + m.dx;
          const ey = echo.y + m.dy;
          // Echoes must obey walls and closed doors/gates and never teleport
          if (isPassable(ex, ey)) {
            echo.trail.push({ x: echo.x, y: echo.y, alpha: 0.65 });
            if (echo.trail.length > 6) echo.trail.shift();
            echo.x = ex;
            echo.y = ey;
          }
        }
        if (moveIndex === echo.moves.length - 1) {
          echo.finished = true;
        }
      } else {
        echo.finished = true;
      }
    }

    evaluateMechanisms(true);
    updateHUD();

    // Check room exit condition
    if (state.player.x === state.exit.x && state.player.y === state.exit.y && state.exit.open) {
      completeCurrentRoom();
    }
  }

  function triggerRewind() {
    if (state.screen !== 'playing') return;

    if (state.currentMoves.length === 0) {
      showToast('Move at least 1 step before rewinding.', 'amber', 1800);
      audio.playBump();
      return;
    }

    let replacedOldest = false;
    if (state.echoes.length >= MAX_ECHOES) {
      state.echoes.shift();
      replacedOldest = true;
    }

    const paletteIndex = (state.nextEchoId - 1) % ECHO_PALETTES.length;
    state.echoes.push({
      id: state.nextEchoId++,
      paletteIndex,
      moves: state.currentMoves.slice(),
      x: state.startPos.x,
      y: state.startPos.y,
      renderX: state.startPos.x,
      renderY: state.startPos.y,
      finished: false,
      trail: []
    });

    state.currentMoves = [];
    state.step = 0;
    state.stats.totalRewinds += 1;
    state.stats.roomRewinds += 1;
    state.rewindFlash = 1.0;

    resetPlayerToStart();
    for (const echo of state.echoes) {
      echo.x = state.startPos.x;
      echo.y = state.startPos.y;
      echo.renderX = state.startPos.x;
      echo.renderY = state.startPos.y;
      echo.finished = false;
      echo.trail = [];
    }

    evaluateMechanisms(false);
    updateHUD();
    audio.playRewind();
    spawnBurst(state.startPos.x, state.startPos.y, '#67e8f9', 24);

    if (replacedOldest) {
      showToast(`Oldest echo replaced (${state.echoes.length}/${MAX_ECHOES} active)`, 'amber', 2200);
    } else {
      showToast(`Rewound — Echo ${state.echoes.length} materialized`, 'cyan', 1900);
    }
  }

  function restartCurrentRoom() {
    if (state.screen === 'title' || state.screen === 'victory') return;
    loadRoom(state.roomIndex, true);
    setScreen('playing');
    audio.playRewind();
    showToast('Room reset — all echoes cleared', 'cyan', 1700);
  }

  function completeCurrentRoom() {
    const room = ROOMS[state.roomIndex];
    if (state.roomIndex < ROOMS.length - 1) {
      audio.playRoomClear();
      el.clearRoomTitle.textContent = `${room.name} COMPLETE`;
      el.clearRoomDesc.textContent = room.clearText;
      el.clearSteps.textContent = state.stats.roomSteps;
      el.clearEchoes.textContent = state.echoes.length;
      setScreen('room_clear');
    } else {
      audio.playVictory();
      el.victorySteps.textContent = state.stats.totalSteps;
      el.victoryRewinds.textContent = state.stats.totalRewinds;
      setScreen('victory');
    }
  }

  // =========================================================================
  // 6. INPUT HANDLING (No repeat bugs, clean key mapping)
  // =========================================================================
  const HELD_INITIAL_DELAY = 260;
  const HELD_STEP_INTERVAL = 165;
  const keyDirs = {
    KeyW: { dx: 0, dy: -1 },
    ArrowUp: { dx: 0, dy: -1 },
    KeyS: { dx: 0, dy: 1 },
    ArrowDown: { dx: 0, dy: 1 },
    KeyA: { dx: -1, dy: 0 },
    ArrowLeft: { dx: -1, dy: 0 },
    KeyD: { dx: 1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 }
  };

  let activeHoldCode = null;
  let holdTimerId = null;

  function clearHoldTimer() {
    if (holdTimerId) {
      clearTimeout(holdTimerId);
      clearInterval(holdTimerId);
      holdTimerId = null;
    }
    activeHoldCode = null;
  }

  function scheduleHeldMove(code) {
    clearHoldTimer();
    activeHoldCode = code;
    holdTimerId = setTimeout(() => {
      if (activeHoldCode !== code || state.screen !== 'playing') return;
      const dir = keyDirs[code];
      if (!dir) return;
      advanceStep(dir.dx, dir.dy);
      holdTimerId = setInterval(() => {
        if (activeHoldCode !== code || state.screen !== 'playing') {
          clearHoldTimer();
          return;
        }
        advanceStep(dir.dx, dir.dy);
      }, HELD_STEP_INTERVAL);
    }, HELD_INITIAL_DELAY);
  }

  window.addEventListener('keydown', (e) => {
    // Prevent OS key-repeat from causing unintended multi-step movement bugs
    if (e.repeat) {
      if (keyDirs[e.code] || e.code === 'Space') e.preventDefault();
      return;
    }

    audio.unlock();

    if (e.code === 'KeyM') {
      audio.setMuted(!audio.muted);
      syncMuteUI();
      return;
    }

    if (e.code === 'Escape') {
      clearHoldTimer();
      if (state.screen === 'playing') {
        setScreen('paused');
      } else if (state.screen === 'paused') {
        setScreen('playing');
      }
      return;
    }

    if (state.screen === 'room_clear' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      loadRoom(state.roomIndex + 1, true);
      setScreen('playing');
      return;
    }

    if (state.screen !== 'playing') return;

    if (keyDirs[e.code]) {
      e.preventDefault();
      const dir = keyDirs[e.code];
      advanceStep(dir.dx, dir.dy);
      scheduleHeldMove(e.code);
    } else if (e.code === 'Space') {
      e.preventDefault();
      clearHoldTimer();
      advanceStep(0, 0);
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      clearHoldTimer();
      triggerRewind();
    } else if (e.code === 'KeyX') {
      e.preventDefault();
      clearHoldTimer();
      restartCurrentRoom();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === activeHoldCode) {
      clearHoldTimer();
    }
  });

  window.addEventListener('blur', clearHoldTimer);

  // UI Button Bindings
  document.getElementById('btn-play').addEventListener('click', () => {
    audio.unlock();
    loadRoom(0, false);
    setScreen('playing');
  });

  document.getElementById('btn-start-mute').addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    syncMuteUI();
  });

  document.getElementById('btn-rewind').addEventListener('click', () => {
    audio.unlock();
    triggerRewind();
  });

  document.getElementById('btn-wait').addEventListener('click', () => {
    audio.unlock();
    advanceStep(0, 0);
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    audio.unlock();
    restartCurrentRoom();
  });

  el.btnMute.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    syncMuteUI();
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    if (state.screen === 'playing') setScreen('paused');
    else if (state.screen === 'paused') setScreen('playing');
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    setScreen('playing');
  });

  document.getElementById('btn-pause-restart').addEventListener('click', () => {
    restartCurrentRoom();
  });

  document.getElementById('btn-to-title').addEventListener('click', () => {
    clearHoldTimer();
    setScreen('title');
  });

  document.getElementById('btn-next-room').addEventListener('click', () => {
    loadRoom(state.roomIndex + 1, true);
    setScreen('playing');
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    loadRoom(0, false);
    setScreen('playing');
  });

  document.getElementById('btn-victory-title').addEventListener('click', () => {
    clearHoldTimer();
    setScreen('title');
  });

  // =========================================================================
  // 7. CANVAS SIZING & PROCEDURAL RENDERER
  // =========================================================================
  let tileSize = 56;
  let boardW = 600;
  let boardH = 400;

  function resizeCanvas() {
    if (!state.cols || !state.rows) return;
    const rect = el.canvasWrap.getBoundingClientRect();
    const availW = Math.max(320, rect.width - 32);
    const availH = Math.max(240, rect.height - 24);
    tileSize = Math.floor(Math.min(availW / state.cols, availH / state.rows, 76));
    tileSize = Math.max(32, tileSize);

    boardW = tileSize * state.cols;
    boardH = tileSize * state.rows;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.floor(boardW * dpr);
    el.canvas.height = Math.floor(boardH * dpr);
    el.canvas.style.width = `${boardW}px`;
    el.canvas.style.height = `${boardH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resizeCanvas);

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function updateAnimations(dt, timeSec) {
    const smooth = 1 - Math.exp(-18 * dt);

    state.player.renderX += (state.player.x - state.player.renderX) * smooth;
    state.player.renderY += (state.player.y - state.player.renderY) * smooth;
    state.player.bumpX *= Math.exp(-20 * dt);
    state.player.bumpY *= Math.exp(-20 * dt);

    for (const t of state.player.trail) {
      t.alpha = Math.max(0, t.alpha - dt * 2.4);
    }
    state.player.trail = state.player.trail.filter(t => t.alpha > 0.02);

    for (const e of state.echoes) {
      e.renderX += (e.x - e.renderX) * smooth;
      e.renderY += (e.y - e.renderY) * smooth;
      for (const t of e.trail) {
        t.alpha = Math.max(0, t.alpha - dt * 2.1);
      }
      e.trail = e.trail.filter(t => t.alpha > 0.02);
    }

    for (const p of state.plates) {
      if (p.pulse > 0) p.pulse = Math.max(0, p.pulse - dt * 1.8);
    }

    for (const g of state.gates) {
      const target = g.open ? 1 : 0;
      g.anim += (target - g.anim) * smooth;
    }

    const exitTarget = state.exit.open ? 1 : 0;
    state.exit.anim += (exitTarget - state.exit.anim) * smooth;

    if (state.rewindFlash > 0) {
      state.rewindFlash = Math.max(0, state.rewindFlash - dt * 2.0);
    }
    if (state.roomFade > 0) {
      state.roomFade = Math.max(0, state.roomFade - dt * 2.8);
    }
    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
    }

    for (const sw of state.shockwaves) {
      sw.life -= sw.decay * dt;
      sw.radius = 0.18 + (1 - Math.max(0, sw.life)) * (sw.maxRadius - 0.18);
    }
    state.shockwaves = state.shockwaves.filter(sw => sw.life > 0);

    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.93;
      pt.vy *= 0.93;
      pt.life -= pt.decay * dt;
    }
    state.particles = state.particles.filter(pt => pt.life > 0);

    for (const d of state.ambientDust) {
      d.x += d.vx * dt + Math.sin(timeSec * 0.6 + d.y) * 0.02 * dt;
      d.y += d.vy * dt;
      if (d.y < 0) d.y = state.rows;
      if (d.x < 0) d.x = state.cols;
      if (d.x > state.cols) d.x = 0;
    }
  }

  function drawConduit(x1, y1, x2, y2, active, color, timeSec) {
    const cx1 = (x1 + 0.5) * tileSize;
    const cy1 = (y1 + 0.5) * tileSize;
    const cx2 = (x2 + 0.5) * tileSize;
    const cy2 = (y2 + 0.5) * tileSize;
    const midX = cx1;
    const midY = cy2;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(midX, midY);
    ctx.lineTo(cx2, cy2);

    if (active) {
      // Soft outer energy bloom
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(4, tileSize * 0.11);
      ctx.globalAlpha = 0.2;
      ctx.stroke();

      // Core lit line
      ctx.lineWidth = Math.max(2, tileSize * 0.052);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.78;
      ctx.stroke();

      // Animated energy pulse
      ctx.setLineDash([tileSize * 0.16, tileSize * 0.24]);
      ctx.lineDashOffset = -timeSec * tileSize * 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, tileSize * 0.028);
      ctx.globalAlpha = 0.75;
      ctx.stroke();
    } else {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(85, 115, 165, 0.22)';
      ctx.lineWidth = Math.max(1.5, tileSize * 0.032);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFloorLight(gx, gy, radiusTiles, colorInner, alpha = 0.22) {
    const cx = (gx + 0.5) * tileSize;
    const cy = (gy + 0.5) * tileSize;
    const r = radiusTiles * tileSize;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    grad.addColorStop(0, colorInner);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render(timeSec) {
    if (!state.cols || !state.rows) return;

    ctx.clearRect(0, 0, boardW, boardH);

    ctx.save();
    if (state.shakeTime > 0) {
      const mag = (state.shakeTime / 0.14) * 3;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // Background floor base
    const bgGrad = ctx.createRadialGradient(
      boardW * 0.5, boardH * 0.5, tileSize,
      boardW * 0.5, boardH * 0.5, Math.max(boardW, boardH) * 0.78
    );
    bgGrad.addColorStop(0, '#0e1930');
    bgGrad.addColorStop(1, '#050914');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, boardW, boardH);

    // 1. Floor grid tiles + wall cast shadows
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        if (state.tiles[y][x] === '#') continue;
        const px = x * tileSize;
        const py = y * tileSize;
        const checker = (x + y) % 2 === 0;

        ctx.fillStyle = checker ? 'rgba(18, 31, 56, 0.68)' : 'rgba(13, 23, 44, 0.68)';
        ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);

        ctx.strokeStyle = 'rgba(78, 118, 180, 0.13)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1.5, py + 1.5, tileSize - 3, tileSize - 3);

        // Subtle corner tech crosshairs
        ctx.fillStyle = 'rgba(103, 232, 249, 0.14)';
        ctx.fillRect(px + 3, py + 3, 2, 2);
        ctx.fillRect(px + tileSize - 5, py + tileSize - 5, 2, 2);

        // Soft ambient occlusion shadow under walls above this floor tile
        if (y > 0 && state.tiles[y - 1][x] === '#') {
          const shGrad = ctx.createLinearGradient(px, py, px, py + tileSize * 0.28);
          shGrad.addColorStop(0, 'rgba(2, 4, 10, 0.55)');
          shGrad.addColorStop(1, 'rgba(2, 4, 10, 0)');
          ctx.fillStyle = shGrad;
          ctx.fillRect(px, py, tileSize, tileSize * 0.28);
        }
      }
    }

    // 1b. Dynamic Floor Atmospheric Lighting Pass
    drawFloorLight(state.player.renderX + state.player.bumpX, state.player.renderY + state.player.bumpY, 1.9, 'rgba(56, 189, 248, 0.85)', 0.22);
    for (const echo of state.echoes) {
      const pal = ECHO_PALETTES[echo.paletteIndex];
      drawFloorLight(echo.renderX, echo.renderY, 1.55, pal.stroke, 0.2);
    }
    for (const plate of state.plates) {
      if (plate.active) {
        const c = plate.isRelay ? 'rgba(251, 191, 36, 0.9)' : 'rgba(103, 232, 249, 0.85)';
        drawFloorLight(plate.x, plate.y, 1.6, c, 0.2);
      }
    }
    drawFloorLight(
      state.exit.x,
      state.exit.y,
      state.exit.open ? 2.1 : 1.15,
      state.exit.open ? 'rgba(103, 232, 249, 0.9)' : 'rgba(248, 113, 113, 0.45)',
      state.exit.open ? 0.28 : 0.12
    );

    // 2. Floor Conduits connecting plates -> gates / exit
    for (const plate of state.plates) {
      if (plate.isRelay) {
        for (const gate of state.gates) {
          drawConduit(plate.x, plate.y, gate.x, gate.y, plate.active, '#fbbf24', timeSec);
        }
      }
      drawConduit(plate.x, plate.y, state.exit.x, state.exit.y, plate.active, '#38bdf8', timeSec);
    }

    // 3. Spawn Marker
    {
      const sx = (state.startPos.x + 0.5) * tileSize;
      const sy = (state.startPos.y + 0.5) * tileSize;
      ctx.save();
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.34)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, tileSize * 0.29, timeSec * 0.35, timeSec * 0.35 + Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.26)';
      ctx.beginPath();
      ctx.arc(sx, sy, tileSize * 0.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(103, 232, 249, 0.48)';
      ctx.font = `600 ${Math.max(8, Math.floor(tileSize * 0.14))}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ORIGIN', sx, sy + tileSize * 0.38);
      ctx.restore();
    }

    // 4. Pressure Plates
    for (const plate of state.plates) {
      const px = plate.x * tileSize;
      const py = plate.y * tileSize;
      const cx = px + tileSize * 0.5;
      const cy = py + tileSize * 0.5;
      const pad = tileSize * 0.15;
      const size = tileSize - pad * 2;
      const baseColor = plate.isRelay ? '#fbbf24' : '#38bdf8';
      const echoHeld = plate.activeBy && plate.activeBy.startsWith('echo');
      const activeColor = echoHeld && !plate.isRelay ? '#a78bfa' : baseColor;

      ctx.save();
      // Outer recessed frame
      drawRoundedRect(px + pad, py + pad, size, size, tileSize * 0.13);
      ctx.fillStyle = plate.active ? 'rgba(15, 34, 64, 0.96)' : 'rgba(7, 13, 26, 0.92)';
      ctx.fill();
      ctx.lineWidth = plate.active ? 2.4 : 1.5;
      ctx.strokeStyle = plate.active ? activeColor : 'rgba(110, 145, 200, 0.36)';
      if (plate.active) {
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 18;
      }
      ctx.stroke();

      // Inner pressurized diaphragm
      const innerPad = pad + tileSize * (plate.active ? 0.08 : 0.06);
      const innerSize = tileSize - innerPad * 2;
      ctx.shadowBlur = 0;
      drawRoundedRect(px + innerPad, py + innerPad, innerSize, innerSize, tileSize * 0.09);
      ctx.strokeStyle = plate.active ? 'rgba(255,255,255,0.28)' : 'rgba(110,145,200,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner glowing ring
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * (plate.active ? 0.21 : 0.15), 0, Math.PI * 2);
      ctx.fillStyle = plate.active ? activeColor : 'rgba(100, 135, 190, 0.18)';
      ctx.globalAlpha = plate.active ? 0.36 + Math.sin(timeSec * 5.5) * 0.09 : 1;
      ctx.fill();

      // Label
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = plate.active ? '#ffffff' : 'rgba(165, 190, 230, 0.68)';
      ctx.font = `700 ${Math.max(10, Math.floor(tileSize * 0.2))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plate.isRelay ? '1' : `P${plate.id}`, cx, cy);

      // Activation shockwave ring
      if (plate.pulse > 0) {
        const radius = tileSize * (0.28 + (1 - plate.pulse) * 0.52);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = activeColor;
        ctx.globalAlpha = plate.pulse * 0.85;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Security Gates ('G')
    for (const gate of state.gates) {
      const px = gate.x * tileSize;
      const py = gate.y * tileSize;
      const slide = gate.anim * (tileSize * 0.4);

      ctx.save();
      // Floor threshold
      ctx.fillStyle = gate.open ? 'rgba(251, 191, 36, 0.12)' : 'rgba(245, 158, 11, 0.07)';
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

      // Side metallic housings
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px + 2, py + 2, 4, tileSize - 4);
      ctx.fillRect(px + tileSize - 6, py + 2, 4, tileSize - 4);

      if (!gate.open || gate.anim < 0.96) {
        const barH = tileSize * 0.37;
        ctx.fillStyle = '#1b2740';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12 * (1 - gate.anim);

        // Top & bottom sliding security leaves
        drawRoundedRect(px + 5, py + 3 - slide, tileSize - 10, barH, 4);
        ctx.fill();
        ctx.stroke();

        drawRoundedRect(px + 5, py + tileSize - 3 - barH + slide, tileSize - 10, barH, 4);
        ctx.fill();
        ctx.stroke();

        // Laser core seam when closed
        if (gate.anim < 0.65) {
          ctx.beginPath();
          ctx.moveTo(px + 6, py + tileSize * 0.5);
          ctx.lineTo(px + tileSize - 6, py + tileSize * 0.5);
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 2;
          ctx.globalAlpha = (0.7 + Math.sin(timeSec * 9) * 0.28) * (1 - gate.anim);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 6. Exit Door ('E')
    {
      const ex = state.exit.x * tileSize;
      const ey = state.exit.y * tileSize;
      const ecx = ex + tileSize * 0.5;
      const ecy = ey + tileSize * 0.5;
      const openAmt = state.exit.anim;

      ctx.save();
      // Portal glow underneath
      const portalGrad = ctx.createRadialGradient(ecx, ecy, 2, ecx, ecy, tileSize * 0.6);
      if (state.exit.open) {
        portalGrad.addColorStop(0, 'rgba(103, 232, 249, 0.82)');
        portalGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.3)');
        portalGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      } else {
        portalGrad.addColorStop(0, 'rgba(248, 113, 113, 0.24)');
        portalGrad.addColorStop(1, 'rgba(248, 113, 113, 0)');
      }
      ctx.fillStyle = portalGrad;
      ctx.fillRect(ex, ey, tileSize, tileSize);

      // Rotating temporal vortex inside open portal
      if (openAmt > 0.1) {
        ctx.save();
        ctx.globalAlpha = openAmt * 0.78;
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([tileSize * 0.18, tileSize * 0.12]);
        ctx.beginPath();
        ctx.arc(ecx, ecy, tileSize * 0.29, timeSec * 2.4, timeSec * 2.4 + Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(ecx, ecy, tileSize * 0.19, -timeSec * 3.1, -timeSec * 3.1 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Door frame
      drawRoundedRect(ex + 4, ey + 4, tileSize - 8, tileSize - 8, 7);
      ctx.strokeStyle = state.exit.open ? '#67e8f9' : 'rgba(248, 113, 113, 0.58)';
      ctx.lineWidth = 2;
      if (state.exit.open) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Corner status LEDs
      const ledColor = state.exit.open ? '#67e8f9' : '#f87171';
      ctx.fillStyle = ledColor;
      const ledOffsets = [[8, 8], [tileSize - 10, 8], [8, tileSize - 10], [tileSize - 10, tileSize - 10]];
      for (const [lx, ly] of ledOffsets) {
        ctx.fillRect(ex + lx, ey + ly, 2.5, 2.5);
      }

      // Sliding armored leaves
      const leafW = (tileSize - 12) * 0.5 * (1 - openAmt * 0.9);
      if (leafW > 2) {
        ctx.fillStyle = '#131d33';
        ctx.strokeStyle = state.exit.open ? '#38bdf8' : '#f87171';
        ctx.lineWidth = 1.4;
        ctx.fillRect(ex + 6, ey + 6, leafW, tileSize - 12);
        ctx.strokeRect(ex + 6, ey + 6, leafW, tileSize - 12);
        ctx.fillRect(ex + tileSize - 6 - leafW, ey + 6, leafW, tileSize - 12);
        ctx.strokeRect(ex + tileSize - 6 - leafW, ey + 6, leafW, tileSize - 12);
      }

      // EXIT beacon text
      ctx.fillStyle = state.exit.open ? '#ffffff' : 'rgba(252, 165, 165, 0.9)';
      ctx.font = `700 ${Math.max(9, Math.floor(tileSize * 0.17))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.exit.open ? 'EXIT' : 'LOCK', ecx, ecy);
      ctx.restore();
    }

    // 7. Walls ('#') with architectural depth
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        if (state.tiles[y][x] !== '#') continue;
        const px = x * tileSize;
        const py = y * tileSize;

        const wGrad = ctx.createLinearGradient(px, py, px, py + tileSize);
        wGrad.addColorStop(0, '#223357');
        wGrad.addColorStop(1, '#0e1629');
        ctx.fillStyle = wGrad;
        ctx.fillRect(px, py, tileSize, tileSize);

        // Top bevel highlight
        ctx.fillStyle = 'rgba(148, 197, 255, 0.2)';
        ctx.fillRect(px + 1, py + 1, tileSize - 2, 2);

        // Inner panel inset & rivets
        ctx.strokeStyle = 'rgba(4, 7, 15, 0.78)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

        ctx.strokeStyle = 'rgba(84, 126, 194, 0.16)';
        ctx.strokeRect(px + 4.5, py + 4.5, tileSize - 9, tileSize - 9);

        ctx.fillStyle = 'rgba(125, 175, 240, 0.2)';
        ctx.fillRect(px + 6, py + 6, 2, 2);
        ctx.fillRect(px + tileSize - 8, py + 6, 2, 2);
      }
    }

    // 8. Echoes (Translucent Cyan / Violet with ribbon trails & afterimages)
    state.echoes.forEach((echo, idx) => {
      const pal = ECHO_PALETTES[echo.paletteIndex];
      const cx = (echo.renderX + 0.5) * tileSize;
      const cy = (echo.renderY + 0.5) * tileSize;

      // Connected glowing ribbon trail
      if (echo.trail.length > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        echo.trail.forEach((t, ti) => {
          const tx = (t.x + 0.5) * tileSize;
          const ty = (t.y + 0.5) * tileSize;
          if (ti === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        });
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = pal.stroke;
        ctx.lineWidth = Math.max(2, tileSize * 0.08);
        ctx.globalAlpha = 0.24;
        ctx.shadowColor = pal.stroke;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // Fading afterimage silhouettes
      for (const t of echo.trail) {
        const tx = (t.x + 0.5) * tileSize;
        const ty = (t.y + 0.5) * tileSize;
        const tr = tileSize * 0.17 * t.alpha;
        ctx.save();
        ctx.globalAlpha = t.alpha * 0.36;
        ctx.strokeStyle = pal.stroke;
        ctx.fillStyle = pal.fill;
        ctx.translate(tx, ty);
        ctx.beginPath();
        ctx.moveTo(0, -tr);
        ctx.lineTo(tr, 0);
        ctx.lineTo(0, tr);
        ctx.lineTo(-tr, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const r = tileSize * 0.27;
      const bob = Math.sin(timeSec * 4 + idx * 1.7) * 1.6;

      ctx.save();
      ctx.globalAlpha = 0.82;

      // Outer temporal aura
      const aura = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.85);
      aura.addColorStop(0, pal.glow);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.85, 0, Math.PI * 2);
      ctx.fill();

      // Rotating dashed ring if anchored at end of timeline
      if (echo.finished) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = pal.stroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.28, timeSec * 1.1, timeSec * 1.1 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Translucent diamond-core body
      ctx.translate(cx, cy + bob);
      ctx.fillStyle = pal.fill;
      ctx.strokeStyle = pal.stroke;
      ctx.lineWidth = 2;
      ctx.shadowColor = pal.stroke;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Echo index label
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(9, Math.floor(tileSize * 0.19))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`E${idx + 1}`, 0, 0.5);
      ctx.restore();
    });

    // 9. Player Character (Crisp glowing core + tapered ribbon trail)
    {
      const px = (state.player.renderX + state.player.bumpX + 0.5) * tileSize;
      const py = (state.player.renderY + state.player.bumpY + 0.5) * tileSize;

      if (state.player.trail.length > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        state.player.trail.forEach((t, ti) => {
          const tx = (t.x + 0.5) * tileSize;
          const ty = (t.y + 0.5) * tileSize;
          if (ti === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        });
        ctx.lineTo(px, py);
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = Math.max(2, tileSize * 0.09);
        ctx.globalAlpha = 0.25;
        ctx.stroke();
        ctx.restore();
      }

      for (const t of state.player.trail) {
        const tx = (t.x + 0.5) * tileSize;
        const ty = (t.y + 0.5) * tileSize;
        ctx.save();
        ctx.globalAlpha = t.alpha * 0.35;
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(tx, ty, tileSize * 0.14 * t.alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const r = tileSize * 0.285;
      const pulseR = r * (0.42 + Math.sin(timeSec * 4.5) * 0.03);

      ctx.save();
      // Soft bloom
      const bloom = ctx.createRadialGradient(px, py, r * 0.2, px, py, r * 2.05);
      bloom.addColorStop(0, 'rgba(103, 232, 249, 0.62)');
      bloom.addColorStop(0.5, 'rgba(56, 189, 248, 0.2)');
      bloom.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.05, 0, Math.PI * 2);
      ctx.fill();

      // Outer suit ring
      ctx.fillStyle = '#0c1d36';
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner bright core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(px, py, pulseR, 0, Math.PI * 2);
      ctx.fill();

      // Facing visor pip
      const vx = px + state.player.dx * r * 0.68;
      const vy = py + state.player.dy * r * 0.68;
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(vx, vy, r * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 10. Ambient dust, shockwaves & luminous burst particles
    for (const d of state.ambientDust) {
      ctx.fillStyle = `rgba(148, 197, 255, ${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x * tileSize, d.y * tileSize, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const sw of state.shockwaves) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, sw.life) * 0.72;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(sw.x * tileSize, sw.y * tileSize, sw.radius * tileSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of state.particles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pt.x * tileSize, pt.y * tileSize, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 11. Temporal Rewind Multi-Ring Chromatic Ripple Overlay
    if (state.rewindFlash > 0) {
      const sx = (state.startPos.x + 0.5) * tileSize;
      const sy = (state.startPos.y + 0.5) * tileSize;
      const maxR = Math.max(boardW, boardH) * 0.92;
      const radius = (1 - state.rewindFlash) * maxR;
      ctx.save();
      ctx.globalAlpha = state.rewindFlash * 0.55;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(0, 0, boardW, boardH);

      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0, radius * 0.72), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 12. Subtle Chamber Vignette & Room Transition Fade
    {
      const vig = ctx.createRadialGradient(
        boardW * 0.5, boardH * 0.5, Math.min(boardW, boardH) * 0.35,
        boardW * 0.5, boardH * 0.5, Math.max(boardW, boardH) * 0.78
      );
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(2, 4, 10, 0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, boardW, boardH);
    }

    if (state.roomFade > 0) {
      ctx.fillStyle = `rgba(4, 7, 16, ${state.roomFade * 0.85})`;
      ctx.fillRect(0, 0, boardW, boardH);
    }

    ctx.restore();
  }

  // =========================================================================
  // 8. MAIN ANIMATION LOOP
  // =========================================================================
  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state.cols && state.rows) {
      updateAnimations(dt, now / 1000);
      render(now / 1000);
    }
    requestAnimationFrame(frame);
  }

  // Initialize Room 1 behind title screen for atmospheric backdrop
  loadRoom(0, false);
  syncMuteUI();
  setScreen('title');
  requestAnimationFrame(frame);
})();
