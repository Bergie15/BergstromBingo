const BOARD_SIZE = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const STORAGE_KEY = "customBingoState";
const ACTIVE_PLAYER_KEY = "customBingoActivePlayer";

// Fill these from your Supabase project settings to enable shared realtime state.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const BOARD_ID = "main";

const defaultTexts = [
  "Finish coffee",
  "Take a walk",
  "Try a new recipe",
  "Send a nice text",
  "Watch a sunset",
  "Read 10 pages",
  "Stretch break",
  "Water plants",
  "Dance to one song",
  "Plan weekend",
  "Call family",
  "FREE",
  "Declutter drawer",
  "Journal 5 min",
  "Try a new snack",
  "Do a puzzle",
  "Clean inbox",
  "Hydration check",
  "Short meditation",
  "Listen to podcast",
  "Compliment someone",
  "Take deep breaths",
  "Learn one fact",
  "Take a photo",
  "Early bedtime"
];

const boardEl = document.getElementById("bingo-board");
const template = document.getElementById("cell-template");
const winMessageEl = document.getElementById("win-message");
const syncStatusEl = document.getElementById("sync-status");
const toggleEditBtn = document.getElementById("toggle-edit");
const saveTextBtn = document.getElementById("save-text");
const playerNameInput = document.getElementById("player-name");
const savePlayerBtn = document.getElementById("save-player");
const currentPlayerEl = document.getElementById("current-player");
const progressListEl = document.getElementById("progress-list");
const canvas = document.getElementById("fireworks");
const ctx = canvas.getContext("2d");

let state = normalizeState(loadLocalState());
let activePlayer = loadActivePlayerName(state);
let draftTexts = [...state.texts];
let isEditMode = false;
let fireworks = [];
let animationId = null;
let supabaseClient = null;
let syncEnabled = false;

setupCanvas();
window.addEventListener("resize", setupCanvas);

ensurePlayerExists(activePlayer);
wireControls();
renderAll();
initSync();

function wireControls() {
  savePlayerBtn.addEventListener("click", async () => {
    const rawName = playerNameInput.value.trim();
    if (!rawName) {
      window.alert("Please enter a player name.");
      return;
    }

    activePlayer = rawName;
    ensurePlayerExists(activePlayer);
    persistLocal();
    await persistShared();
    renderAll();
  });

  toggleEditBtn.addEventListener("click", () => {
    isEditMode = !isEditMode;

    if (isEditMode) {
      draftTexts = [...state.texts];
      toggleEditBtn.textContent = "Cancel Edit";
      saveTextBtn.hidden = false;
    } else {
      draftTexts = [...state.texts];
      toggleEditBtn.textContent = "Enter Edit Mode";
      saveTextBtn.hidden = true;
    }

    renderBoard();
  });

  saveTextBtn.addEventListener("click", async () => {
    state.texts = [...draftTexts];
    persistLocal();
    await persistShared();

    isEditMode = false;
    toggleEditBtn.textContent = "Enter Edit Mode";
    saveTextBtn.hidden = true;
    renderBoard();
    refreshWinState();
  });

  document.getElementById("reset-board").addEventListener("click", async () => {
    state.texts = [...defaultTexts];
    draftTexts = [...state.texts];

    persistLocal();
    await persistShared();

    renderBoard();
  });

  document.getElementById("clear-marks").addEventListener("click", async () => {
    const playerState = getActivePlayerState();
    playerState.marked = Array(CELL_COUNT).fill(false);
    playerState.updatedAt = new Date().toISOString();

    persistLocal();
    await persistShared();

    renderAll();
  });
}

function loadLocalState() {
  const fallback = {
    texts: [...defaultTexts],
    players: {}
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function normalizeState(raw) {
  const safeTexts = Array(CELL_COUNT)
    .fill("")
    .map((_, i) => {
      const value = raw?.texts?.[i];
      return typeof value === "string" && value.trim() ? value : defaultTexts[i];
    });

  const safePlayers = {};

  if (raw?.players && typeof raw.players === "object") {
    Object.entries(raw.players).forEach(([name, player]) => {
      const trimmedName = sanitizePlayerName(name);
      if (!trimmedName) {
        return;
      }

      safePlayers[trimmedName] = {
        marked: Array(CELL_COUNT)
          .fill(false)
          .map((_, i) => Boolean(player?.marked?.[i])),
        updatedAt: typeof player?.updatedAt === "string" ? player.updatedAt : new Date().toISOString()
      };
    });
  }

  // Backward compatibility with old single-player format.
  if (raw?.marked && Array.isArray(raw.marked) && !Object.keys(safePlayers).length) {
    safePlayers.Player = {
      marked: Array(CELL_COUNT)
        .fill(false)
        .map((_, i) => Boolean(raw.marked[i])),
      updatedAt: new Date().toISOString()
    };
  }

  return { texts: safeTexts, players: safePlayers };
}

function sanitizePlayerName(name) {
  return String(name || "").trim().slice(0, 30);
}

function loadActivePlayerName(currentState) {
  const savedName = sanitizePlayerName(localStorage.getItem(ACTIVE_PLAYER_KEY));
  if (savedName) {
    return savedName;
  }

  const existing = Object.keys(currentState.players);
  return existing[0] || "Player";
}

function ensurePlayerExists(name) {
  const safeName = sanitizePlayerName(name);
  if (!safeName) {
    return;
  }

  if (!state.players[safeName]) {
    state.players[safeName] = {
      marked: Array(CELL_COUNT).fill(false),
      updatedAt: new Date().toISOString()
    };
  }

  activePlayer = safeName;
}

function getActivePlayerState() {
  ensurePlayerExists(activePlayer);
  return state.players[activePlayer];
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(ACTIVE_PLAYER_KEY, activePlayer);
}

async function initSync() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setSyncStatus("Local-only mode. Add Supabase keys in script.js for shared realtime.");
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    syncEnabled = true;

    const { data, error } = await supabaseClient.from("boards").select("state").eq("id", BOARD_ID).single();
    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (data?.state) {
      state = normalizeState(data.state);
      ensurePlayerExists(activePlayer);
      draftTexts = [...state.texts];
      persistLocal();
      renderAll();
    } else {
      await persistShared();
    }

    supabaseClient
      .channel(`board-${BOARD_ID}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "boards",
          filter: `id=eq.${BOARD_ID}`
        },
        (payload) => {
          const incoming = normalizeState(payload.new.state);
          state = incoming;
          ensurePlayerExists(activePlayer);
          if (!isEditMode) {
            draftTexts = [...incoming.texts];
          }
          persistLocal();
          renderAll();
        }
      )
      .subscribe();

    setSyncStatus("Realtime sync connected.");
  } catch (error) {
    setSyncStatus(`Sync offline: ${error.message}`);
  }
}

async function persistShared() {
  if (!syncEnabled || !supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.from("boards").upsert(
    {
      id: BOARD_ID,
      state,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    setSyncStatus(`Could not sync: ${error.message}`);
  }
}

function setSyncStatus(message) {
  syncStatusEl.textContent = message;
}

function renderAll() {
  playerNameInput.value = activePlayer;
  currentPlayerEl.textContent = `Current board: ${activePlayer}`;
  renderBoard();
  renderProgressPanel();
  refreshWinState();
}

function renderBoard() {
  boardEl.replaceChildren();
  const playerState = getActivePlayerState();

  for (let i = 0; i < CELL_COUNT; i += 1) {
    const cellNode = template.content.firstElementChild.cloneNode(true);
    const textSpan = cellNode.querySelector(".cell-text");
    const text = isEditMode ? draftTexts[i] : state.texts[i];

    textSpan.textContent = text || "";
    cellNode.classList.toggle("marked", Boolean(playerState.marked[i]));
    cellNode.classList.toggle("editing", isEditMode);

    if (isEditMode) {
      cellNode.addEventListener("click", () => {
        const updatedText = window.prompt("Edit this square", draftTexts[i]);
        if (updatedText === null) {
          return;
        }

        draftTexts[i] = updatedText.trim() || " ";
        renderBoard();
      });
    } else {
      cellNode.addEventListener("click", async () => {
        playerState.marked[i] = !playerState.marked[i];
        playerState.updatedAt = new Date().toISOString();
        persistLocal();
        await persistShared();
        renderAll();
      });
    }

    boardEl.appendChild(cellNode);
  }
}

function renderProgressPanel() {
  progressListEl.replaceChildren();

  const ranking = Object.entries(state.players)
    .map(([name, player]) => {
      const markedCount = player.marked.filter(Boolean).length;
      return {
        name,
        markedCount,
        percent: Math.round((markedCount / CELL_COUNT) * 100),
        hasBingo: checkBingo(player.marked),
        updatedAt: player.updatedAt || ""
      };
    })
    .sort((a, b) => b.markedCount - a.markedCount || a.name.localeCompare(b.name));

  if (!ranking.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "progress-item";
    emptyItem.textContent = "No players yet.";
    progressListEl.appendChild(emptyItem);
    return;
  }

  ranking.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "progress-item";

    const bingoBadge = entry.hasBingo ? " • BINGO" : "";
    const activeBadge = entry.name === activePlayer ? " (you)" : "";
    item.textContent = `${entry.name}${activeBadge}: ${entry.markedCount}/${CELL_COUNT} (${entry.percent}%)${bingoBadge}`;

    if (entry.name === activePlayer) {
      item.classList.add("active");
    }

    progressListEl.appendChild(item);
  });
}

function refreshWinState() {
  const hasWin = checkBingo(getActivePlayerState().marked);
  winMessageEl.textContent = hasWin ? `BINGO! 🎉 ${activePlayer} got 5 in a row!` : "";

  if (hasWin) {
    launchFireworks();
  }
}

function checkBingo(marked) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (Array.from({ length: BOARD_SIZE }, (_, col) => marked[row * BOARD_SIZE + col]).every(Boolean)) {
      return true;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (Array.from({ length: BOARD_SIZE }, (_, row) => marked[row * BOARD_SIZE + col]).every(Boolean)) {
      return true;
    }
  }

  const diagonal1 = Array.from({ length: BOARD_SIZE }, (_, i) => marked[i * (BOARD_SIZE + 1)]).every(Boolean);
  const diagonal2 = Array.from({ length: BOARD_SIZE }, (_, i) => marked[(i + 1) * (BOARD_SIZE - 1)]).every(Boolean);

  return diagonal1 || diagonal2;
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function launchFireworks() {
  const bursts = 4;
  for (let b = 0; b < bursts; b += 1) {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * (window.innerHeight * 0.5) + 40;
    createBurst(x, y);
  }

  if (!animationId) {
    animationId = requestAnimationFrame(animateFireworks);
  }
}

function createBurst(x, y) {
  const particles = 45;
  for (let i = 0; i < particles; i += 1) {
    const angle = (Math.PI * 2 * i) / particles;
    const speed = 1 + Math.random() * 3;

    fireworks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`
    });
  }
}

function animateFireworks() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  fireworks = fireworks.filter((particle) => particle.alpha > 0.02);

  fireworks.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.025;
    particle.alpha -= 0.014;

    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2.3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;

  if (fireworks.length) {
    animationId = requestAnimationFrame(animateFireworks);
  } else {
    animationId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
