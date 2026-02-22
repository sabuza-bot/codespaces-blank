const startMenuEl = document.getElementById("startMenu");
const modePanelEl = document.getElementById("modePanel");
const controlPanelEl = document.getElementById("controlPanel");
const cubeOverlayEl = document.getElementById("cubeOverlay");
const cubeBoundaryEl = document.getElementById("cubeBoundary");
const hudPanelEl = document.getElementById("hudPanel");
const cubeSceneEl = document.querySelector(".cube-scene");
const startOnePlayerButton = document.getElementById("startOnePlayer");
const escapeButton = document.getElementById("escapeButton");
const startStatusEl = document.getElementById("startStatus");
const practiceCubeEl = document.getElementById("practiceCube");
const cubeRotatorEl = document.querySelector(".cube-rotator");
const cubeHoverRingEl = document.getElementById("cubeHoverRing");
const waveVisualizerEl = document.getElementById("waveVisualizer");
const waveformSelectEl = document.getElementById("waveformSelect");
const synthStatusEl = document.getElementById("synthStatus");
const waveCoordsEl = document.getElementById("waveCoords");
const waveCoordXEl = document.getElementById("waveCoordX");
const waveCoordYEl = document.getElementById("waveCoordY");
const waveCoordsToggleEl = document.getElementById("toggleWaveCoords");
const waveHeaderToggleEl = document.getElementById("toggleWaveHeader");
const floatStopToggleEl = document.getElementById("toggleFloatStop");
const waveformHeaderEl = document.getElementById("waveformHeader");
const cubeCoordsEl = document.getElementById("cubeCoords");
const cubeCoordXEl = document.getElementById("cubeCoordX");
const cubeCoordYEl = document.getElementById("cubeCoordY");
const cubeCoordDistEl = document.getElementById("cubeCoordDist");
const directionCards = Array.from(
  document.querySelectorAll("[data-direction-card]")
);
const wasdCards = Array.from(
  document.querySelectorAll("[data-wasd-card]")
);

const directionMap = {
  ArrowLeft: { name: "Left" },
  ArrowUp: { name: "Up" },
  ArrowDown: { name: "Down" },
  ArrowRight: { name: "Right" },
};

const waveformCycle = ["sine", "square", "triangle", "sawtooth"];

const waveformThemeMap = {
  sine: null,
  square: "synth-red",
  triangle: "synth-blue",
  sawtooth: "synth-yellow",
};

let activeDirectionKey = null;
const activeWasdKeys = new Set();
let audioContext = null;
let synthOscillator = null;
let synthGainNode = null;
let synthIsStarting = false;
let waveVisualizerContext = null;
let waveVisualizerAnimationId = null;
let wavePhaseOffset = 0;
let activeWaveform = "sine";
let currentSpinSeconds = 9;
let targetSpinSeconds = 9;
let wasdMoveAnimationId = null;
const SAFE_MAX_GAIN = 0.04;
const CAPPED_MAX_GAIN = SAFE_MAX_GAIN * 0.95;
const EDGE_GAIN_FACTOR = 0.4;
const MIN_FREQUENCY = 80;
const MAX_FREQUENCY = 1200;
const FREQUENCY_STEP = 12;
const MIN_AMPLITUDE = 0.2;
const MAX_AMPLITUDE = 1;
const AMPLITUDE_STEP = 0.05;
let currentFrequency = 220;
let amplitudeLevel = 0.35;
const MIN_CUBE_SPIN_SECONDS = 0.9;
const MAX_CUBE_SPIN_SECONDS = 18;
const MIN_CUBE_SIZE = 40;
const MAX_CUBE_SIZE = 216;
const MAX_CUBE_OFFSET_X = 440;
const MAX_CUBE_OFFSET_UP = 300;
const MAX_CUBE_OFFSET_DOWN = 360;
const WASD_ACCELERATION = 1.35;
const WASD_MAX_SPEED = 12;
const WASD_FRICTION = 0.86;
let cubeOffsetX = 0;
let cubeOffsetY = 240;
let cubeVelocityX = 0;
let cubeVelocityY = 0;
let cubeCollisionTimeoutId = null;
const EDGE_CLASS_NAMES = ["edge-left", "edge-right", "edge-top", "edge-bottom"];
let showWaveCoords = true;
let showWaveHeader = true;
let isFloatStopped = false;

function syncCubeVisualFromControls() {
  const frequencyRange = MAX_FREQUENCY - MIN_FREQUENCY;
  const frequencyRatio = frequencyRange > 0
    ? (currentFrequency - MIN_FREQUENCY) / frequencyRange
    : 0;
  const clampedFrequencyRatio = Math.max(0, Math.min(1, frequencyRatio));
  const acceleratedRatio = Math.pow(clampedFrequencyRatio, 1.35);
  const spinSeconds =
    MAX_CUBE_SPIN_SECONDS -
    acceleratedRatio * (MAX_CUBE_SPIN_SECONDS - MIN_CUBE_SPIN_SECONDS);
  targetSpinSeconds = spinSeconds;

  const amplitudeRange = MAX_AMPLITUDE - MIN_AMPLITUDE;
  const amplitudeRatio = amplitudeRange > 0
    ? (amplitudeLevel - MIN_AMPLITUDE) / amplitudeRange
    : 0;
  const clampedAmplitudeRatio = Math.max(0, Math.min(1, amplitudeRatio));
  const nextCubeSize =
    MIN_CUBE_SIZE + clampedAmplitudeRatio * (MAX_CUBE_SIZE - MIN_CUBE_SIZE);

  if (practiceCubeEl) {
    practiceCubeEl.style.setProperty("--cube-size", `${nextCubeSize.toFixed(1)}px`);
  }
}

function syncCubeOverlayPosition() {
  if (!cubeOverlayEl) return;

  const previousX = cubeOffsetX;
  const previousY = cubeOffsetY;
  const clampedX = Math.max(-MAX_CUBE_OFFSET_X, Math.min(MAX_CUBE_OFFSET_X, cubeOffsetX));
  const clampedY = Math.max(-MAX_CUBE_OFFSET_UP, Math.min(MAX_CUBE_OFFSET_DOWN, cubeOffsetY));
  cubeOffsetX = clampedX;
  cubeOffsetY = clampedY;
  cubeOverlayEl.style.setProperty("--cube-offset-x", `${cubeOffsetX}px`);
  cubeOverlayEl.style.setProperty("--cube-offset-y", `${cubeOffsetY}px`);

  const hitLeft = previousX < -MAX_CUBE_OFFSET_X;
  const hitRight = previousX > MAX_CUBE_OFFSET_X;
  const hitTop = previousY < -MAX_CUBE_OFFSET_UP;
  const hitBottom = previousY > MAX_CUBE_OFFSET_DOWN;
  const hitBoundary = hitLeft || hitRight || hitTop || hitBottom;

  if (!cubeBoundaryEl) return;
  if (!hitBoundary) return;

  cubeBoundaryEl.classList.remove(...EDGE_CLASS_NAMES);
  if (hitLeft) cubeBoundaryEl.classList.add("edge-left");
  if (hitRight) cubeBoundaryEl.classList.add("edge-right");
  if (hitTop) cubeBoundaryEl.classList.add("edge-top");
  if (hitBottom) cubeBoundaryEl.classList.add("edge-bottom");

  if (cubeCollisionTimeoutId) {
    window.clearTimeout(cubeCollisionTimeoutId);
  }
  cubeCollisionTimeoutId = window.setTimeout(() => {
    cubeBoundaryEl.classList.remove(...EDGE_CLASS_NAMES);
    cubeCollisionTimeoutId = null;
  }, 180);
}

function setCubeBoundaryVars() {
  if (!cubeBoundaryEl) return;

  cubeBoundaryEl.style.setProperty(
    "--cube-boundary-width",
    `${MAX_CUBE_OFFSET_X * 2}px`
  );
  cubeBoundaryEl.style.setProperty(
    "--cube-boundary-height",
    `${MAX_CUBE_OFFSET_UP + MAX_CUBE_OFFSET_DOWN}px`
  );
}

function getHoverGainFromDistance(distance, radius) {
  const normalizedDistance = Math.min(distance, radius) / radius;
  const proximity = 1 - normalizedDistance;
  const gainFactor = EDGE_GAIN_FACTOR + (1 - EDGE_GAIN_FACTOR) * proximity;
  return CAPPED_MAX_GAIN * gainFactor * amplitudeLevel;
}

function updateSynthFromCubePosition() {
  if (!cubeHoverRingEl || !practiceCubeEl) return;

  const ringRect = cubeHoverRingEl.getBoundingClientRect();
  const cubeRect = practiceCubeEl.getBoundingClientRect();
  const centerX = ringRect.left + ringRect.width / 2;
  const centerY = ringRect.top + ringRect.height / 2;
  const cubeCenterX = cubeRect.left + cubeRect.width / 2;
  const cubeCenterY = cubeRect.top + cubeRect.height / 2;
  const distance = Math.hypot(cubeCenterX - centerX, cubeCenterY - centerY);
  const radius = Math.min(ringRect.width, ringRect.height) / 2;
  updateCubeCoords(cubeCenterX - centerX, cubeCenterY - centerY, distance);

  if (distance <= radius) {
    cubeHoverRingEl.classList.add("pulsing");
    startSynth()
      .then(() => {
        if (!audioContext || !synthGainNode) return;
        const nextGain = getHoverGainFromDistance(distance, radius);
        synthGainNode.gain.setTargetAtTime(nextGain, audioContext.currentTime, 0.02);
      })
      .catch(() => {
        setSynthStatus("Could not start synth audio.");
      });
    return;
  }

  cubeHoverRingEl.classList.remove("pulsing");
  if (isSynthRunning()) {
    stopSynth();
  }
}

function updateCubeCoords(deltaX, deltaY, distance) {
  if (!cubeCoordsEl || !cubeCoordXEl || !cubeCoordYEl || !cubeCoordDistEl) return;

  cubeCoordXEl.textContent = Math.round(deltaX).toString();
  cubeCoordYEl.textContent = Math.round(deltaY).toString();
  cubeCoordDistEl.textContent = Math.round(distance).toString();
}

function sampleWave(waveform, phase) {
  if (waveform === "square") {
    return Math.sign(Math.sin(phase)) || 1;
  }

  if (waveform === "triangle") {
    return (2 / Math.PI) * Math.asin(Math.sin(phase));
  }

  if (waveform === "sawtooth") {
    const wrapped = phase / (2 * Math.PI);
    return 2 * (wrapped - Math.floor(wrapped + 0.5));
  }

  return Math.sin(phase);
}

function resizeWaveVisualizer() {
  if (!waveVisualizerEl) return;

  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(window.innerWidth));
  const height = Math.max(1, Math.floor(window.innerHeight));

  waveVisualizerEl.width = Math.floor(width * ratio);
  waveVisualizerEl.height = Math.floor(height * ratio);
  waveVisualizerEl.style.width = `${width}px`;
  waveVisualizerEl.style.height = `${height}px`;

  if (waveVisualizerContext) {
    waveVisualizerContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  updateSynthFromCubePosition();
}

function drawWaveVisualizer() {
  if (!waveVisualizerContext || !waveVisualizerEl) return;

  const width = waveVisualizerEl.clientWidth;
  const height = waveVisualizerEl.clientHeight;
  const centerY = height / 2;
  const waveform = getSelectedWaveform();
  const computed = getComputedStyle(document.body);
  const stroke = computed.getPropertyValue("--text").trim() || "#d8f2a5";

  waveVisualizerContext.clearRect(0, 0, width, height);
  waveVisualizerContext.strokeStyle = stroke;
  waveVisualizerContext.lineWidth = 2;
  waveVisualizerContext.globalAlpha = 0.65;
  waveVisualizerContext.beginPath();

  const points = 180;
  const cycles = Math.max(1, Math.min(10, currentFrequency / 120));
  const amplitudePixels = Math.max(14, height * 0.16 * amplitudeLevel);
  if (showWaveCoords) {
    updateWaveCoords();
  }

  for (let index = 0; index <= points; index += 1) {
    const t = index / points;
    const x = t * width;
    const phase = t * cycles * Math.PI * 2 + wavePhaseOffset;
    const y = centerY + sampleWave(waveform, phase) * amplitudePixels;

    if (index === 0) {
      waveVisualizerContext.moveTo(x, y);
    } else {
      waveVisualizerContext.lineTo(x, y);
    }
  }

  waveVisualizerContext.stroke();
  waveVisualizerContext.globalAlpha = 1;
}

function updateWaveCoords() {
  if (!waveCoordsEl || !waveCoordXEl || !waveCoordYEl) return;

  waveCoordXEl.textContent = `${currentFrequency.toFixed(0)} Hz`;
  waveCoordYEl.textContent = `${Math.round(amplitudeLevel * 100)}%`;
}

function animateWaveVisualizer() {
  wavePhaseOffset += (currentFrequency / 1000) * 0.22;
  if (cubeRotatorEl) {
    const delta = targetSpinSeconds - currentSpinSeconds;
    currentSpinSeconds += delta * 0.08;
    if (currentSpinSeconds < targetSpinSeconds) {
      currentSpinSeconds = targetSpinSeconds;
    }
    cubeRotatorEl.style.animationDuration = `${currentSpinSeconds.toFixed(2)}s`;
  }
  updateSynthFromCubePosition();
  drawWaveVisualizer();
  waveVisualizerAnimationId = window.requestAnimationFrame(animateWaveVisualizer);
}

function initializeWaveVisualizer() {
  if (!waveVisualizerEl) return;

  waveVisualizerContext = waveVisualizerEl.getContext("2d");
  if (!waveVisualizerContext) return;

  resizeWaveVisualizer();
  drawWaveVisualizer();

  if (waveVisualizerAnimationId) {
    window.cancelAnimationFrame(waveVisualizerAnimationId);
  }

  waveVisualizerAnimationId = window.requestAnimationFrame(animateWaveVisualizer);
  window.addEventListener("resize", resizeWaveVisualizer);
}

function edgeGain() {
  return CAPPED_MAX_GAIN * EDGE_GAIN_FACTOR * amplitudeLevel;
}

function isSynthRunning() {
  return Boolean(synthOscillator) || synthIsStarting;
}

function getSelectedWaveform() {
  return activeWaveform;
}

function applyThemeForWaveform(waveform) {
  const theme = waveformThemeMap[waveform] ?? null;
  if (!theme) {
    document.body.removeAttribute("data-theme");
    return;
  }

  document.body.setAttribute("data-theme", theme);
}

function setWaveformMode(nextWaveform) {
  activeWaveform = nextWaveform;

  if (waveformSelectEl) {
    waveformSelectEl.value = nextWaveform;
  }

  if (synthOscillator) {
    synthOscillator.type = nextWaveform;
  }

  applyThemeForWaveform(nextWaveform);

  if (waveformHeaderEl) {
    const label = nextWaveform.charAt(0).toUpperCase() + nextWaveform.slice(1);
    waveformHeaderEl.textContent = label;
  }

  if (isSynthRunning()) {
    setSynthStatus(`Synth running: ${nextWaveform}`);
  }
}

function setWaveCoordsVisible(isVisible) {
  showWaveCoords = isVisible;
  if (!waveCoordsEl) return;
  waveCoordsEl.classList.toggle("hidden", !isVisible);
}

function setWaveHeaderVisible(isVisible) {
  showWaveHeader = isVisible;
  if (!waveformHeaderEl) return;
  waveformHeaderEl.classList.toggle("hidden", !isVisible);
}

function setFloatStopped(isStopped) {
  isFloatStopped = isStopped;
  if (!cubeOverlayEl) return;
  cubeOverlayEl.classList.toggle("no-float", isStopped);
}

function cycleWaveformMode() {
  const currentWaveform = getSelectedWaveform();
  const currentIndex = waveformCycle.indexOf(currentWaveform);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % waveformCycle.length;
  const nextWaveform = waveformCycle[nextIndex];
  setWaveformMode(nextWaveform);
}

function setSynthStatus(text) {
  if (!synthStatusEl) return;

  synthStatusEl.textContent = text;
}

function ensureAudioContext() {
  if (audioContext) return audioContext;

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    setSynthStatus("Web Audio is not supported in this browser.");
    return null;
  }

  audioContext = new AudioContextConstructor();
  return audioContext;
}

async function startSynth() {
  if (synthIsStarting) return;

  synthIsStarting = true;
  try {
    const context = ensureAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      await context.resume();
    }

    if (synthOscillator) {
      synthOscillator.type = getSelectedWaveform();
      synthOscillator.frequency.setTargetAtTime(currentFrequency, context.currentTime, 0.02);
      setSynthStatus(`Synth running: ${getSelectedWaveform()}`);
      return;
    }

    synthGainNode = context.createGain();
    synthGainNode.gain.setValueAtTime(0.0001, context.currentTime);
    synthGainNode.gain.exponentialRampToValueAtTime(edgeGain(), context.currentTime + 0.03);

    synthOscillator = context.createOscillator();
    synthOscillator.type = getSelectedWaveform();
    synthOscillator.frequency.setValueAtTime(currentFrequency, context.currentTime);
    synthOscillator.connect(synthGainNode);
    synthGainNode.connect(context.destination);
    synthOscillator.start();

    setSynthStatus(`Synth running: ${getSelectedWaveform()} (${Math.round(EDGE_GAIN_FACTOR * 100)}%)`);
  } finally {
    synthIsStarting = false;
  }
}

function stopSynth() {
  synthIsStarting = false;

  if (!audioContext || !synthOscillator || !synthGainNode) {
    setSynthStatus("Synth is off. Hover the cube to play.");
    return;
  }

  const stopAt = audioContext.currentTime + 0.04;
  synthGainNode.gain.cancelScheduledValues(audioContext.currentTime);
  synthGainNode.gain.setValueAtTime(Math.max(synthGainNode.gain.value, 0.0001), audioContext.currentTime);
  synthGainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  synthOscillator.stop(stopAt + 0.01);
  synthOscillator.onended = () => {
    if (synthOscillator) {
      synthOscillator.disconnect();
    }
    if (synthGainNode) {
      synthGainNode.disconnect();
    }
    synthOscillator = null;
    synthGainNode = null;
  };

  setSynthStatus("Synth is off. Hover the cube to play.");
}

function getHoverGainFromPointer(event) {
  if (!cubeHoverRingEl) return edgeGain();

  const rect = cubeHoverRingEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const radius = Math.min(rect.width, rect.height) / 2;
  const normalizedDistance = Math.min(distance, radius) / radius;
  const proximity = 1 - normalizedDistance;
  const gainFactor = EDGE_GAIN_FACTOR + (1 - EDGE_GAIN_FACTOR) * proximity;
  return CAPPED_MAX_GAIN * gainFactor * amplitudeLevel;
}

function updateSynthGainFromPointer(event) {
  if (!audioContext || !synthGainNode) return;

  const nextGain = getHoverGainFromPointer(event);
  synthGainNode.gain.setTargetAtTime(nextGain, audioContext.currentTime, 0.018);
  const percentOfCappedMax = Math.round((nextGain / CAPPED_MAX_GAIN) * 100);
  setSynthStatus(`Synth running: ${getSelectedWaveform()} (${percentOfCappedMax}%)`);
}

function adjustFrequency(delta) {
  currentFrequency = Math.max(
    MIN_FREQUENCY,
    Math.min(MAX_FREQUENCY, currentFrequency + delta)
  );

  syncCubeVisualFromControls();
  updateSynthFromCubePosition();

  if (!audioContext || !synthOscillator) return;

  synthOscillator.frequency.setTargetAtTime(currentFrequency, audioContext.currentTime, 0.02);
}

function adjustAmplitude(delta) {
  amplitudeLevel = Math.max(
    MIN_AMPLITUDE,
    Math.min(MAX_AMPLITUDE, amplitudeLevel + delta)
  );

  syncCubeVisualFromControls();
  updateSynthFromCubePosition();
}

function attemptEscape() {
  window.open("", "_self");
  window.close();

  if (startStatusEl) {
    startStatusEl.textContent = "ESCAPE blocked by browser. Close this tab manually.";
  }
}

function updateDirectionCards() {
  directionCards.forEach((card) => {
    const cardKey = card.getAttribute("data-key");
    card.classList.toggle("active", cardKey === activeDirectionKey);
  });
}

function updateWasdCards() {
  wasdCards.forEach((card) => {
    const cardKey = card.getAttribute("data-key");
    card.classList.toggle("active", activeWasdKeys.has(cardKey));
  });
}

function setActiveDirection(nextKey) {
  if (!directionMap[nextKey]) return;

  activeDirectionKey = nextKey;
  updateDirectionCards();
}

function keyToDirectionKey(key) {
  if (directionMap[key]) return key;
  return null;
}

function keyToWasdKey(key) {
  const upper = key.toUpperCase();
  if (["W", "A", "S", "D"].includes(upper)) {
    return upper;
  }

  return null;
}

function applyWasdMovement() {
  const moveUp = activeWasdKeys.has("W");
  const moveDown = activeWasdKeys.has("S");
  const moveLeft = activeWasdKeys.has("A");
  const moveRight = activeWasdKeys.has("D");

  let accelX = 0;
  let accelY = 0;

  if (moveUp) {
    accelY -= WASD_ACCELERATION;
  }
  if (moveDown) {
    accelY += WASD_ACCELERATION;
  }
  if (moveLeft) {
    accelX -= WASD_ACCELERATION;
  }
  if (moveRight) {
    accelX += WASD_ACCELERATION;
  }

  cubeVelocityX += accelX;
  cubeVelocityY += accelY;
  cubeVelocityX *= WASD_FRICTION;
  cubeVelocityY *= WASD_FRICTION;

  cubeVelocityX = Math.max(-WASD_MAX_SPEED, Math.min(WASD_MAX_SPEED, cubeVelocityX));
  cubeVelocityY = Math.max(-WASD_MAX_SPEED, Math.min(WASD_MAX_SPEED, cubeVelocityY));

  cubeOffsetX += cubeVelocityX;
  cubeOffsetY += cubeVelocityY;

  syncCubeOverlayPosition();
}

function runWasdMovementLoop() {
  const isMoving = Math.abs(cubeVelocityX) > 0.05 || Math.abs(cubeVelocityY) > 0.05;
  if (activeWasdKeys.size === 0 && !isMoving) {
    cubeVelocityX = 0;
    cubeVelocityY = 0;
    wasdMoveAnimationId = null;
    return;
  }

  applyWasdMovement();
  wasdMoveAnimationId = window.requestAnimationFrame(runWasdMovementLoop);
}

function handleControlKeydown(event) {
  if (controlPanelEl.classList.contains("hidden")) {
    return;
  }

  if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    controlPanelEl.classList.add("space-active");
    cycleWaveformMode();
    return;
  }

  const nextKey = keyToDirectionKey(event.key);
  if (!nextKey) {
    const wasdKey = keyToWasdKey(event.key);
    if (!wasdKey) {
      return;
    }

    event.preventDefault();
    activeWasdKeys.add(wasdKey);
    applyWasdMovement();
    updateWasdCards();
    if (!wasdMoveAnimationId) {
      wasdMoveAnimationId = window.requestAnimationFrame(runWasdMovementLoop);
    }
    return;
  }

  event.preventDefault();
  if (nextKey === "ArrowLeft") {
    adjustFrequency(-FREQUENCY_STEP);
  } else if (nextKey === "ArrowRight") {
    adjustFrequency(FREQUENCY_STEP);
  } else if (nextKey === "ArrowUp") {
    adjustAmplitude(AMPLITUDE_STEP);
  } else if (nextKey === "ArrowDown") {
    adjustAmplitude(-AMPLITUDE_STEP);
  }

  setActiveDirection(nextKey);
}

function showControlPanel() {
  modePanelEl.classList.add("hidden");
  controlPanelEl.classList.remove("hidden");
  if (hudPanelEl) {
    hudPanelEl.classList.remove("hidden");
  }
  if (cubeOverlayEl) {
    cubeOverlayEl.classList.remove("hidden");
  }
  if (cubeHoverRingEl) {
    cubeHoverRingEl.classList.remove("hidden");
  }
  startMenuEl.classList.remove("hidden");
  document.body.classList.remove("start-cover-active");
  setActiveDirection(activeDirectionKey);
}

function initializeStartMenu() {
  startOnePlayerButton.addEventListener("click", (event) => {
    event.preventDefault();
    showControlPanel();
  });

  escapeButton.addEventListener("click", attemptEscape);

  if (waveformSelectEl) {
    waveformSelectEl.addEventListener("change", () => {
      setWaveformMode(waveformSelectEl.value);
    });
  }

  if (waveCoordsToggleEl) {
    waveCoordsToggleEl.addEventListener("change", (event) => {
      setWaveCoordsVisible(event.target.checked);
    });
  }

  if (waveHeaderToggleEl) {
    waveHeaderToggleEl.addEventListener("change", (event) => {
      setWaveHeaderVisible(event.target.checked);
    });
  }

  if (floatStopToggleEl) {
    floatStopToggleEl.addEventListener("change", (event) => {
      setFloatStopped(event.target.checked);
    });
  }

  updateSynthFromCubePosition();
}

function handleControlKeyup(event) {
  if (controlPanelEl.classList.contains("hidden")) {
    return;
  }

  if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
    controlPanelEl.classList.remove("space-active");
  }

  const directionKey = keyToDirectionKey(event.key);
  if (directionKey && directionKey === activeDirectionKey) {
    activeDirectionKey = null;
    updateDirectionCards();
  }

  const wasdKey = keyToWasdKey(event.key);
  if (!wasdKey) {
    return;
  }

  activeWasdKeys.delete(wasdKey);
  updateWasdCards();
  if (activeWasdKeys.size === 0 && wasdMoveAnimationId) {
    window.cancelAnimationFrame(wasdMoveAnimationId);
    wasdMoveAnimationId = null;
  }
}

initializeStartMenu();
initializeWaveVisualizer();
setWaveformMode(getSelectedWaveform());
syncCubeVisualFromControls();
setCubeBoundaryVars();
syncCubeOverlayPosition();
updateSynthFromCubePosition();
updateDirectionCards();
updateWasdCards();
setWaveCoordsVisible(showWaveCoords);
setWaveHeaderVisible(showWaveHeader);
setFloatStopped(isFloatStopped);
window.addEventListener("keydown", handleControlKeydown);
window.addEventListener("keyup", handleControlKeyup);
