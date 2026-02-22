const basePlayers = [
  {
    name: "Player 1",
    stats: {
      physique: 5,
      finesse: 5,
      mind: 5,
      charm: 5,
      magic: 5,
      wealth: 0,
    },
  },
  {
    name: "Player 2",
    stats: {
      physique: 5,
      finesse: 5,
      mind: 5,
      charm: 5,
      magic: 5,
      wealth: 0,
    },
  },
];

const players = [];

const events = [
  {
    text: "You find a strange book.",
    choiceA: {
      text: "Read it",
      effects: { mind: 1, magic: 1 },
    },
    choiceB: {
      text: "Sell it",
      effects: { wealth: 2 },
    },
  },
  {
    text: "A brawl breaks out in the square.",
    choiceA: {
      text: "Join the fight",
      effects: { physique: 2, charm: -1 },
    },
    choiceB: {
      text: "Break it up peacefully",
      effects: { charm: 2, finesse: 1 },
    },
  },
  {
    text: "A noble asks for your advice.",
    choiceA: {
      text: "Offer clever counsel",
      effects: { mind: 2, wealth: 1 },
    },
    choiceB: {
      text: "Flatter them instead",
      effects: { charm: 2, wealth: 1 },
    },
  },
  {
    text: "You discover a sealed shrine.",
    choiceA: {
      text: "Study the runes",
      effects: { magic: 2, mind: 1 },
    },
    choiceB: {
      text: "Pry it open",
      effects: { physique: 1, wealth: 2 },
    },
  },
];

let currentPlayerIndex = 0;
let roundNumber = 1;
let currentEvent = getRandomEvent();
let activePlayerCount = 2;

const roundValueEl = document.getElementById("roundValue");
const playerTurnValueEl = document.getElementById("playerTurnValue");
const playerCountValueEl = document.getElementById("playerCountValue");
const playerNameEl = document.getElementById("playerName");
const statsGridEl = document.getElementById("statsGrid");
const eventTextEl = document.getElementById("eventText");
const choiceAButton = document.getElementById("choiceAButton");
const choiceBButton = document.getElementById("choiceBButton");
const logEl = document.getElementById("log");
const themeSelectEl = document.getElementById("themeSelect");
const startMenuEl = document.getElementById("startMenu");
const gameContainerEl = document.getElementById("gameContainer");
const startOnePlayerButton = document.getElementById("startOnePlayer");
const startTwoPlayerButton = document.getElementById("startTwoPlayer");
const escapeButton = document.getElementById("escapeButton");
const startStatusEl = document.getElementById("startStatus");

function applyTheme(themeName) {
  document.body.setAttribute("data-theme", themeName);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("smallKingdomTheme");
  const defaultTheme = "gba-olive";
  const selectedTheme = savedTheme || defaultTheme;

  applyTheme(selectedTheme);
  themeSelectEl.value = selectedTheme;

  themeSelectEl.addEventListener("change", (event) => {
    const nextTheme = event.target.value;
    applyTheme(nextTheme);
    localStorage.setItem("smallKingdomTheme", nextTheme);
  });
}

function initializePlayers(playerCount) {
  players.length = 0;
  basePlayers.slice(0, playerCount).forEach((templatePlayer) => {
    players.push({
      name: templatePlayer.name,
      stats: { ...templatePlayer.stats },
    });
  });
}

function startGame(playerCount) {
  activePlayerCount = playerCount;
  currentPlayerIndex = 0;
  roundNumber = 1;
  currentEvent = getRandomEvent();
  logEl.innerHTML = "";
  startStatusEl.textContent = "";

  initializePlayers(activePlayerCount);
  updateUI();

  startMenuEl.classList.add("hidden");
  gameContainerEl.classList.remove("hidden");
  document.body.classList.remove("start-cover-active");
}

function beginGameSequence(playerCount) {
  if (playerCount !== 1 && playerCount !== 2) {
    return;
  }

  startGame(playerCount);
}

function attemptEscape() {
  window.open("", "_self");
  window.close();

  startStatusEl.textContent = "ESCAPE blocked by browser. Close this tab manually.";
}

function initializeStartMenu() {
  startOnePlayerButton.addEventListener("click", (event) => {
    event.preventDefault();
    beginGameSequence(1);
  });

  startTwoPlayerButton.addEventListener("click", (event) => {
    event.preventDefault();
    beginGameSequence(2);
  });

  escapeButton.addEventListener("click", attemptEscape);
}

function getRandomEvent() {
  const index = Math.floor(Math.random() * events.length);
  return events[index];
}

function applyEffects(player, effects) {
  Object.keys(effects).forEach((statKey) => {
    if (Object.prototype.hasOwnProperty.call(player.stats, statKey)) {
      player.stats[statKey] += effects[statKey];
    }
  });
}

function logChoice(player, choice) {
  const effectsText = Object.entries(choice.effects)
    .map(([key, value]) => `${key} ${value >= 0 ? "+" : ""}${value}`)
    .join(", ");

  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `Round ${roundNumber} • ${player.name} chose "${choice.text}" (${effectsText})`;
  logEl.prepend(entry);
}

function nextTurn() {
  currentPlayerIndex += 1;

  if (currentPlayerIndex >= players.length) {
    currentPlayerIndex = 0;
    roundNumber += 1;
  }

  currentEvent = getRandomEvent();
  updateUI();
}

function updateUI() {
  const player = players[currentPlayerIndex];

  roundValueEl.textContent = String(roundNumber);
  playerTurnValueEl.textContent = String(currentPlayerIndex + 1);
  playerCountValueEl.textContent = String(activePlayerCount);

  playerNameEl.textContent = player.name;

  statsGridEl.innerHTML = "";
  Object.entries(player.stats).forEach(([statName, value]) => {
    const statLine = document.createElement("div");
    statLine.className = "muted";
    statLine.textContent = `${statName}: ${value}`;
    statsGridEl.appendChild(statLine);
  });

  eventTextEl.textContent = currentEvent.text;
  choiceAButton.textContent = currentEvent.choiceA.text;
  choiceBButton.textContent = currentEvent.choiceB.text;
}

choiceAButton.addEventListener("click", () => {
  const player = players[currentPlayerIndex];
  const choice = currentEvent.choiceA;

  applyEffects(player, choice.effects);
  logChoice(player, choice);
  nextTurn();
});

choiceBButton.addEventListener("click", () => {
  const player = players[currentPlayerIndex];
  const choice = currentEvent.choiceB;

  applyEffects(player, choice.effects);
  logChoice(player, choice);
  nextTurn();
});

initializeTheme();
initializeStartMenu();
