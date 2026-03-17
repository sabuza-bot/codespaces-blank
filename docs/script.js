const planetCanvas = document.getElementById("planetCanvas");
const latReadoutEl = document.getElementById("latReadout");
const lonReadoutEl = document.getElementById("lonReadout");
const depthReadoutEl = document.getElementById("depthReadout");
const materialReadoutEl = document.getElementById("materialReadout");
const waterScoreReadoutEl = document.getElementById("waterScoreReadout");
const graphWaterEl = document.getElementById("graphWater");
const graphToxinEl = document.getElementById("graphToxin");
const graphWasteEl = document.getElementById("graphWaste");
const contaminationReadoutEl = document.getElementById("contaminationReadout");
const missionStatusEl = document.getElementById("missionStatus");
const restartButtonEl = document.getElementById("restartMission");
const viewRulesButtonEl = document.getElementById("viewRulesButton");
const volumeKnobEl = document.getElementById("volumeKnob");
const materialKeyButtons = Array.from(document.querySelectorAll(".scanner-key-item"));
const gameStartMenuEl = document.getElementById("gameStartMenu");
const startMissionButtonEl = document.getElementById("startMissionButton");

if (!planetCanvas) {
  throw new Error("Missing #planetCanvas element.");
}

const ctx = planetCanvas.getContext("2d");
if (!ctx) {
  throw new Error("Could not acquire 2D context.");
}

const SOURCE_COUNT = 50;
const WATER_COUNT = 12;
const TOXIN_COUNT = 19;
const WASTE_COUNT = 19;
const WATER_TARGET_SCORE = 320;
const CONTAMINATION_LIMIT = 100;
const WATER_RATE = 28;
const TOXIN_RATE = 23;
const WASTE_RATE = 15;
const SCAN_SIZE_SCALE = 1.5;

const MATERIAL_CONFIG = {
  water: {
    label: "Water",
    color: "#77a8bb",
    waveform: "sine",
    beepBaseFrequency: 320,
    beepFrequencyRange: 340,
    beepMinInterval: 0.09,
    beepMaxInterval: 0.48,
    beepGain: 0.03,
  },
  toxin: {
    label: "Toxin",
    color: "#2e2e2e",
    waveform: "triangle",
    beepBaseFrequency: 190,
    beepFrequencyRange: 260,
    beepMinInterval: 0.08,
    beepMaxInterval: 0.44,
    beepGain: 0.022,
  },
  waste: {
    label: "Waste",
    color: "#ffc907",
    waveform: "triangle",
    beepBaseFrequency: 150,
    beepFrequencyRange: 220,
    beepMinInterval: 0.08,
    beepMaxInterval: 0.42,
    beepGain: 0.02,
  },
};

const scannerState = {
  width: 1,
  height: 1,
  centerX: 0,
  centerY: 0,
  radius: 160,
  baseRadius: 160,
  zoom: 1,
  rotationLon: 0,
  rotationLat: 0,
  drift: 0,
  pointerX: 0,
  pointerY: 0,
  pointerInside: false,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragStartLon: 0,
  dragStartLat: 0,
  markerX: 0,
  markerY: 0,
  markerVisible: false,
  sources: [],
  projectedSources: [],
  activeSources: [],
  hoveredSourceId: null,
  waterScore: 0,
  contaminationScore: 0,
  missionState: "running",
  missionMessage: "Collect water and avoid contamination.",
  discovered: {
    water: 0,
    toxin: 0,
    waste: 0,
  },
  totalByType: {
    water: WATER_COUNT,
    toxin: TOXIN_COUNT,
    waste: WASTE_COUNT,
  },
  lastFrameTime: 0,
};

const audioState = {
  context: null,
  masterGain: null,
  currentMaterial: null,
  nextBeepAt: 0,
  sourceBeepSchedule: new Map(),
  manualPreviewMaterial: null,
  manualPreviewNextBeepAt: 0,
  volume: 0.6,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = array[index];
    array[index] = array[swapIndex];
    array[swapIndex] = temp;
  }
}

function generateMaterialSources() {
  const types = [
    ...Array(WATER_COUNT).fill("water"),
    ...Array(TOXIN_COUNT).fill("toxin"),
    ...Array(WASTE_COUNT).fill("waste"),
  ];
  shuffle(types);

  scannerState.sources = Array.from({ length: SOURCE_COUNT }, (_, index) => {
    const type = types[index];
    const lon = randomRange(-Math.PI, Math.PI);
    const lat = Math.asin(randomRange(-1, 1));

    return {
      id: index,
      type,
      lon,
      lat,
      detectRadiusRatio: randomRange(0.55, 0.85),
      discovered: false,
      selected: false,
    };
  });
}

function resetMission() {
  scannerState.waterScore = 0;
  scannerState.contaminationScore = 0;
  scannerState.hoveredSourceId = null;
  scannerState.markerVisible = false;
  scannerState.dragging = false;
  scannerState.missionState = "running";
  scannerState.missionMessage = "Collect water and avoid contamination.";
  scannerState.discovered.water = 0;
  scannerState.discovered.toxin = 0;
  scannerState.discovered.waste = 0;
  scannerState.activeSources = [];
  generateMaterialSources();
  stopMaterialTone();
}

function finalizeMission(nextState) {
  if (scannerState.missionState !== "running") return;

  scannerState.missionState = nextState;
  scannerState.dragging = false;
  stopMaterialTone();

  if (nextState === "won") {
    scannerState.missionMessage = "Mission success: Water target reached.";
    return;
  }

  scannerState.missionMessage = "Mission failed: Contamination threshold exceeded.";
}

function evaluateMissionState() {
  if (scannerState.missionState !== "running") return;
  if (scannerState.waterScore >= WATER_TARGET_SCORE) {
    finalizeMission("won");
    return;
  }
  if (scannerState.contaminationScore >= CONTAMINATION_LIMIT) {
    finalizeMission("lost");
  }
}

function ensureAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!audioState.context) {
    if (!AudioContextConstructor) return null;
    audioState.context = new AudioContextConstructor();
  }

  if (!audioState.masterGain) {
    const masterGain = audioState.context.createGain();
    masterGain.gain.setValueAtTime(audioState.volume, audioState.context.currentTime);
    masterGain.connect(audioState.context.destination);
    audioState.masterGain = masterGain;
  }

  return audioState.context;
}

function setMasterVolume(nextVolume) {
  const clamped = clamp(nextVolume, 0, 1);
  audioState.volume = clamped;

  if (!audioState.context || !audioState.masterGain) return;
  audioState.masterGain.gain.setValueAtTime(clamped, audioState.context.currentTime);
}

async function unlockAudioContext() {
  const context = ensureAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    await context.resume();
  }
}

function playMaterialBeep(material, proximity, gainScale = 1) {
  const context = ensureAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    return;
  }

  const config = MATERIAL_CONFIG[material];
  if (!config) return;

  const clampedProximity = clamp(proximity, 0, 1);
  const frequency =
    config.beepBaseFrequency + config.beepFrequencyRange * Math.pow(clampedProximity, 1.1);
  const gainValue = config.beepGain * gainScale;

  const oscillator = context.createOscillator();
  oscillator.type = config.waveform;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);

  const gainNode = context.createGain();
  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.linearRampToValueAtTime(gainValue, context.currentTime + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioState.masterGain || context.destination);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.11);
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };

  audioState.currentMaterial = material;
}

function stopMaterialTone() {
  audioState.currentMaterial = null;
  audioState.nextBeepAt = 0;
  audioState.sourceBeepSchedule.clear();
}

function updateMaterialKeyButtons() {
  for (const button of materialKeyButtons) {
    const material = button.dataset.material;
    const isActive = audioState.manualPreviewMaterial === material;
    button.dataset.active = isActive ? "true" : "false";
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

function setMaterialPreview(material) {
  if (!MATERIAL_CONFIG[material]) return;

  audioState.manualPreviewMaterial = material;
  audioState.manualPreviewNextBeepAt = 0;
  stopMaterialTone();
  updateMaterialKeyButtons();
}

function clearMaterialPreview(material) {
  if (audioState.manualPreviewMaterial !== material) return;
  audioState.manualPreviewMaterial = null;
  audioState.manualPreviewNextBeepAt = 0;
  updateMaterialKeyButtons();
}

function startMissionFromMenu() {
  if (!document.body.classList.contains("start-cover-active")) return;
  document.body.classList.remove("start-cover-active");
  if (gameStartMenuEl) {
    gameStartMenuEl.setAttribute("aria-hidden", "true");
  }
}

function openRulesMenu() {
  document.body.classList.add("start-cover-active");
  scannerState.dragging = false;
  if (gameStartMenuEl) {
    gameStartMenuEl.setAttribute("aria-hidden", "false");
  }
  if (startMissionButtonEl) {
    startMissionButtonEl.setAttribute("aria-label", "Resume Mission");
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  planetCanvas.width = Math.floor(width * ratio);
  planetCanvas.height = Math.floor(height * ratio);
  planetCanvas.style.width = `${width}px`;
  planetCanvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  scannerState.width = width;
  scannerState.height = height;
  scannerState.centerX = width * 0.5;
  scannerState.centerY = height * 0.52;
  scannerState.baseRadius = Math.max(120, Math.min(width, height) * 0.22) * SCAN_SIZE_SCALE;
  scannerState.radius = scannerState.baseRadius * scannerState.zoom;
}

function projectSource(source) {
  const cosLat = Math.cos(source.lat);
  const x = cosLat * Math.cos(source.lon);
  const y = Math.sin(source.lat);
  const z = cosLat * Math.sin(source.lon);

  const cosLonRot = Math.cos(scannerState.rotationLon);
  const sinLonRot = Math.sin(scannerState.rotationLon);
  const x1 = x * cosLonRot + z * sinLonRot;
  const z1 = -x * sinLonRot + z * cosLonRot;

  const cosLatRot = Math.cos(scannerState.rotationLat);
  const sinLatRot = Math.sin(scannerState.rotationLat);
  const y2 = y * cosLatRot - z1 * sinLatRot;
  const z2 = y * sinLatRot + z1 * cosLatRot;

  const xScreen = scannerState.centerX + x1 * scannerState.radius;
  const yScreen = scannerState.centerY - y2 * scannerState.radius;
  const perspective = 0.58 + Math.max(0, z2) * 0.42;

  return {
    id: source.id,
    type: source.type,
    x: xScreen,
    y: yScreen,
    z: z2,
    visible: z2 >= 0,
    detectRadius: scannerState.radius * source.detectRadiusRatio * perspective * SCAN_SIZE_SCALE,
    discovered: source.discovered,
  };
}

function updateProjectedSources() {
  scannerState.projectedSources = scannerState.sources.map(projectSource);
}

function getActiveSources() {
  if (!scannerState.pointerInside) return null;

  const activeSources = [];
  for (const source of scannerState.projectedSources) {
    if (!source.visible) continue;

    const dx = scannerState.pointerX - source.x;
    const dy = scannerState.pointerY - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance > source.detectRadius) continue;

    activeSources.push({
      ...source,
      distance,
      proximity: clamp(1 - distance / source.detectRadius, 0, 1),
    });
  }

  activeSources.sort((a, b) => a.distance - b.distance);
  return activeSources;
}

function updateHoveredSource() {
  const activeSources = getActiveSources() || [];
  scannerState.activeSources = activeSources;

  const hovered = activeSources[0] ?? null;
  scannerState.hoveredSourceId = hovered ? hovered.id : null;
  if (!hovered) return null;

  return hovered;
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(
    scannerState.width * 0.5,
    scannerState.height * 0.3,
    scannerState.radius * 0.2,
    scannerState.width * 0.5,
    scannerState.height * 0.52,
    scannerState.width * 0.7
  );
  gradient.addColorStop(0, "rgba(94, 219, 239, 0.14)");
  gradient.addColorStop(1, "rgba(4, 19, 28, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, scannerState.width, scannerState.height);
}

function drawPlanet() {
  const { centerX, centerY, radius } = scannerState;

  const planetFill = ctx.createRadialGradient(
    centerX - radius * 0.28,
    centerY - radius * 0.35,
    radius * 0.15,
    centerX,
    centerY,
    radius * 1.15
  );
  planetFill.addColorStop(0, "#8df3ff");
  planetFill.addColorStop(0.45, "#2ba9bf");
  planetFill.addColorStop(1, "#0c4253");

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = planetFill;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  const bands = 11;
  for (let index = 0; index < bands; index += 1) {
    const t = index / (bands - 1);
    const y = centerY - radius + t * radius * 2;
    const latFactor = Math.cos(t * Math.PI - Math.PI / 2);
    const halfWidth = radius * Math.max(0.08, Math.abs(latFactor));
    const wobble = Math.sin(scannerState.drift * 0.55 + index * 0.8 + scannerState.rotationLat) * 8;

    ctx.beginPath();
    ctx.ellipse(
      centerX + Math.sin(scannerState.rotationLon + index * 0.3) * 10,
      y + wobble,
      halfWidth,
      Math.max(2, radius * 0.014),
      0,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = "rgba(218, 250, 255, 0.24)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const meridians = 12;
  for (let index = 0; index < meridians; index += 1) {
    const p = index / meridians;
    const phase = p * Math.PI * 2 + scannerState.rotationLon;
    const xRadius = Math.max(4, Math.abs(Math.cos(phase)) * radius);
    const alpha = 0.1 + Math.abs(Math.cos(phase)) * 0.18;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, xRadius, radius, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220, 252, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();

  const rim = ctx.createRadialGradient(
    centerX,
    centerY,
    radius * 0.65,
    centerX,
    centerY,
    radius * 1.06
  );
  rim.addColorStop(0, "rgba(0, 0, 0, 0)");
  rim.addColorStop(1, "rgba(1, 18, 24, 0.5)");
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(159, 241, 255, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMaterialSources() {
  const hoverId = scannerState.hoveredSourceId;
  for (const source of scannerState.projectedSources) {
    if (!source.visible) continue;

    const model = scannerState.sources[source.id];
    const isHovered = source.id === hoverId;
    const isSelected = Boolean(model && model.selected);
    const config = MATERIAL_CONFIG[source.type];

    const baseColor = isSelected && config ? config.color : "#81d8ff";
    const alpha = isHovered ? 0.95 : isSelected ? 0.8 : 0.42;
    const dotRadius = Math.max(2.4, scannerState.radius * 0.02 * SCAN_SIZE_SCALE);

    ctx.beginPath();
    ctx.arc(source.x, source.y, dotRadius, 0, Math.PI * 2);
    if (!baseColor.startsWith("rgba")) {
      ctx.fillStyle = `rgba(${hexToRgb(baseColor)}, ${alpha.toFixed(3)})`;
    } else {
      ctx.fillStyle = baseColor;
    }
    ctx.fill();
  }
}

function drawScanReticle() {
  if (!scannerState.pointerInside) return;

  const dx = scannerState.pointerX - scannerState.centerX;
  const dy = scannerState.pointerY - scannerState.centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > scannerState.radius) return;

  const pulse = 0.65 + (Math.sin(scannerState.drift * 4.4) + 1) * 0.15;
  const ringRadius = scannerState.radius * 0.11;

  ctx.beginPath();
  ctx.arc(scannerState.pointerX, scannerState.pointerY, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(203, 249, 255, ${pulse.toFixed(3)})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(scannerState.pointerX - ringRadius * 1.5, scannerState.pointerY);
  ctx.lineTo(scannerState.pointerX + ringRadius * 1.5, scannerState.pointerY);
  ctx.moveTo(scannerState.pointerX, scannerState.pointerY - ringRadius * 1.5);
  ctx.lineTo(scannerState.pointerX, scannerState.pointerY + ringRadius * 1.5);
  ctx.strokeStyle = "rgba(185, 244, 255, 0.46)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((value) => `${value}${value}`).join("")
    : normalized;
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function drawScanMarker() {
  if (!scannerState.markerVisible) return;

  const pulse = 0.5 + (Math.sin(scannerState.drift * 3.2) + 1) * 0.2;
  const radius = scannerState.radius * 0.07;

  ctx.beginPath();
  ctx.arc(scannerState.markerX, scannerState.markerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(144, 240, 255, ${pulse.toFixed(3)})`;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(scannerState.markerX - radius * 0.9, scannerState.markerY - radius * 0.9);
  ctx.lineTo(scannerState.markerX + radius * 0.9, scannerState.markerY + radius * 0.9);
  ctx.moveTo(scannerState.markerX + radius * 0.9, scannerState.markerY - radius * 0.9);
  ctx.lineTo(scannerState.markerX - radius * 0.9, scannerState.markerY + radius * 0.9);
  ctx.strokeStyle = "rgba(180, 248, 255, 0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function placeMarkerFromPointer() {
  const dx = scannerState.pointerX - scannerState.centerX;
  const dy = scannerState.pointerY - scannerState.centerY;
  const distance = Math.hypot(dx, dy);

  if (distance > scannerState.radius) return;

  scannerState.markerX = scannerState.pointerX;
  scannerState.markerY = scannerState.pointerY;
  scannerState.markerVisible = true;
}

function selectSourceAtPointer() {
  updateProjectedSources();

  let closest = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const source of scannerState.projectedSources) {
    if (!source.visible) continue;

    const dx = scannerState.pointerX - source.x;
    const dy = scannerState.pointerY - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance > source.detectRadius) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = source;
    }
  }

  if (!closest) return;

  const model = scannerState.sources[closest.id];
  if (!model) return;

  if (!model.selected) {
    model.selected = true;
    model.discovered = true;
    scannerState.discovered[model.type] += 1;
  }

  scannerState.markerX = closest.x;
  scannerState.markerY = closest.y;
  scannerState.markerVisible = true;
}

function updateReadout() {
  if (!latReadoutEl || !lonReadoutEl || !depthReadoutEl) return;

  if (!scannerState.pointerInside) {
    latReadoutEl.textContent = "0.0°";
    lonReadoutEl.textContent = "0.0°";
    depthReadoutEl.textContent = "0%";
    return;
  }

  const dx = scannerState.pointerX - scannerState.centerX;
  const dy = scannerState.pointerY - scannerState.centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > scannerState.radius) {
    depthReadoutEl.textContent = "0%";
    if (materialReadoutEl) {
      materialReadoutEl.textContent = "None";
    }
    return;
  }

  const nx = dx / scannerState.radius;
  const ny = dy / scannerState.radius;
  const lat = clamp(-ny, -1, 1) * 90;
  const localLon = Math.atan2(nx, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))) * (180 / Math.PI);
  const lon = localLon + (scannerState.rotationLon * 180) / Math.PI;
  const depth = Math.round((1 - distance / scannerState.radius) * 100);

  latReadoutEl.textContent = `${lat.toFixed(1)}°`;
  lonReadoutEl.textContent = `${lon.toFixed(1)}°`;
  depthReadoutEl.textContent = `${depth}%`;
}

function updateMaterialHud(hoveredSource) {
  if (materialReadoutEl) {
    materialReadoutEl.textContent = hoveredSource
      ? MATERIAL_CONFIG[hoveredSource.type].label
      : "None";
  }

  if (waterScoreReadoutEl) {
    waterScoreReadoutEl.textContent = Math.floor(scannerState.waterScore).toString();
  }

  if (contaminationReadoutEl) {
    contaminationReadoutEl.textContent = `${Math.floor(scannerState.contaminationScore)}/${CONTAMINATION_LIMIT}`;
  }

  if (missionStatusEl) {
    missionStatusEl.textContent = scannerState.missionMessage;
    missionStatusEl.dataset.state = scannerState.missionState;
  }

  if (graphWaterEl) {
    graphWaterEl.textContent = `${scannerState.discovered.water}/${scannerState.totalByType.water}`;
  }
  if (graphToxinEl) {
    graphToxinEl.textContent = `${scannerState.discovered.toxin}/${scannerState.totalByType.toxin}`;
  }
  if (graphWasteEl) {
    graphWasteEl.textContent = `${scannerState.discovered.waste}/${scannerState.totalByType.waste}`;
  }
}

function updateMaterialAudio(hoveredSource) {
  if (audioState.manualPreviewMaterial) {
    const context = ensureAudioContext();
    const previewMaterial = audioState.manualPreviewMaterial;
    const config = MATERIAL_CONFIG[previewMaterial];
    if (!context || !config || context.state === "suspended") {
      return;
    }

    if (audioState.manualPreviewNextBeepAt === 0) {
      audioState.manualPreviewNextBeepAt = context.currentTime;
    }

    if (context.currentTime >= audioState.manualPreviewNextBeepAt) {
      playMaterialBeep(previewMaterial, 0.62, 1);
      const interval = (config.beepMinInterval + config.beepMaxInterval) * 0.5;
      audioState.manualPreviewNextBeepAt = context.currentTime + interval;
    }
    return;
  }

  if (scannerState.missionState !== "running") {
    stopMaterialTone();
    return;
  }

  if (!hoveredSource || hoveredSource.length === 0) {
    stopMaterialTone();
    return;
  }

  const context = ensureAudioContext();
  if (!context || context.state === "suspended") {
    return;
  }

  const activeIds = new Set(hoveredSource.map((source) => source.id));
  for (const sourceId of audioState.sourceBeepSchedule.keys()) {
    if (!activeIds.has(sourceId)) {
      audioState.sourceBeepSchedule.delete(sourceId);
    }
  }

  const gainScale = 1 / Math.sqrt(Math.max(1, hoveredSource.length));
  for (const source of hoveredSource) {
    const config = MATERIAL_CONFIG[source.type];
    if (!config) continue;

    if (!audioState.sourceBeepSchedule.has(source.id)) {
      const stagger = Math.random() * config.beepMaxInterval * 0.45;
      audioState.sourceBeepSchedule.set(source.id, context.currentTime + stagger);
      continue;
    }

    const nextBeepAt = audioState.sourceBeepSchedule.get(source.id) ?? context.currentTime;
    if (context.currentTime < nextBeepAt) {
      continue;
    }

    playMaterialBeep(source.type, source.proximity ?? 0, gainScale);
    const interval =
      config.beepMaxInterval - (config.beepMaxInterval - config.beepMinInterval) * (source.proximity ?? 0);
    audioState.sourceBeepSchedule.set(source.id, context.currentTime + interval);
    audioState.currentMaterial = source.type;
  }
}

function render(timeMs) {
  const previousTime = scannerState.lastFrameTime || timeMs;
  const deltaSeconds = clamp((timeMs - previousTime) / 1000, 0, 0.05);
  scannerState.lastFrameTime = timeMs;

  ctx.clearRect(0, 0, scannerState.width, scannerState.height);
  updateProjectedSources();
  const hoveredSource = updateHoveredSource();

  drawBackground();
  drawPlanet();
  drawMaterialSources();
  drawScanReticle();
  drawScanMarker();
  updateReadout();
  updateMaterialHud(hoveredSource);
  updateMaterialAudio(scannerState.activeSources);

  if (scannerState.missionState === "running" && hoveredSource) {
    const model = scannerState.sources[hoveredSource.id];
    if (!model || !model.selected) {
      // No scoring until a unit has been confirmed via right-click selection.
    } else if (model.type === "water") {
      scannerState.waterScore += deltaSeconds * WATER_RATE;
    } else if (model.type === "toxin") {
      scannerState.contaminationScore += deltaSeconds * TOXIN_RATE;
    } else if (model.type === "waste") {
      scannerState.contaminationScore += deltaSeconds * WASTE_RATE;
    }
  }

  evaluateMissionState();

  scannerState.drift += 0.01;
  window.requestAnimationFrame(render);
}

function updatePointer(event) {
  const rect = planetCanvas.getBoundingClientRect();
  scannerState.pointerX = event.clientX - rect.left;
  scannerState.pointerY = event.clientY - rect.top;

  const dx = scannerState.pointerX - scannerState.centerX;
  const dy = scannerState.pointerY - scannerState.centerY;
  scannerState.pointerInside = Math.hypot(dx, dy) <= scannerState.radius;
}

planetCanvas.addEventListener("pointerdown", (event) => {
  if (scannerState.missionState !== "running") {
    return;
  }

  unlockAudioContext().catch(() => {});
  updatePointer(event);
  if (event.button === 2) {
    selectSourceAtPointer();
    return;
  }

  if (event.button !== 0) {
    return;
  }

  scannerState.dragging = true;
  scannerState.dragStartX = scannerState.pointerX;
  scannerState.dragStartY = scannerState.pointerY;
  scannerState.dragStartLon = scannerState.rotationLon;
  scannerState.dragStartLat = scannerState.rotationLat;
  planetCanvas.setPointerCapture(event.pointerId);
});

planetCanvas.addEventListener("pointermove", (event) => {
  updatePointer(event);
  if (!scannerState.dragging) return;

  const dx = scannerState.pointerX - scannerState.dragStartX;
  const dy = scannerState.pointerY - scannerState.dragStartY;
  scannerState.rotationLon = scannerState.dragStartLon + dx * 0.01;
  scannerState.rotationLat = clamp(scannerState.dragStartLat + dy * 0.01, -1.15, 1.15);
});

planetCanvas.addEventListener("pointerup", (event) => {
  if (!scannerState.dragging) {
    return;
  }

  scannerState.dragging = false;
  if (planetCanvas.hasPointerCapture(event.pointerId)) {
    planetCanvas.releasePointerCapture(event.pointerId);
  }
});

planetCanvas.addEventListener("pointerleave", () => {
  scannerState.pointerInside = false;
});

planetCanvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

for (const button of materialKeyButtons) {
  button.addEventListener("pointerenter", () => {
    const material = button.dataset.material;
    unlockAudioContext().catch(() => {});
    setMaterialPreview(material);
  });

  button.addEventListener("pointerleave", () => {
    const material = button.dataset.material;
    clearMaterialPreview(material);
  });
}

planetCanvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    if (scannerState.missionState !== "running") {
      return;
    }
    unlockAudioContext().catch(() => {});
    scannerState.zoom = clamp(scannerState.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.65, 1.45);
    scannerState.radius = scannerState.baseRadius * scannerState.zoom;
  },
  { passive: false }
);

if (restartButtonEl) {
  restartButtonEl.addEventListener("click", () => {
    resetMission();
  });
}

if (startMissionButtonEl) {
  startMissionButtonEl.addEventListener("click", () => {
    unlockAudioContext().catch(() => {});
    startMissionFromMenu();
  });
}

if (viewRulesButtonEl) {
  viewRulesButtonEl.addEventListener("click", () => {
    openRulesMenu();
  });
}

if (volumeKnobEl) {
  volumeKnobEl.value = String(Math.round(audioState.volume * 100));
  volumeKnobEl.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const parsed = Number(target.value);
    if (!Number.isFinite(parsed)) return;
    setMasterVolume(parsed / 100);
  });
}

window.addEventListener("keydown", (event) => {
  if (document.body.classList.contains("start-cover-active") && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    unlockAudioContext().catch(() => {});
    startMissionFromMenu();
    return;
  }

  if (event.key.toLowerCase() === "r") {
    resetMission();
  }
});

window.addEventListener("resize", resizeCanvas);

resetMission();
updateMaterialKeyButtons();
resizeCanvas();
render();
