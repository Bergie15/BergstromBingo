const BOARD_SIZE = 5;
const STORAGE_KEY = "customBingoState";

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
const canvas = document.getElementById("fireworks");
const ctx = canvas.getContext("2d");

let state = loadState();
let fireworks = [];
let animationId = null;

setupCanvas();
window.addEventListener("resize", setupCanvas);

renderBoard();
refreshWinState();

document.getElementById("reset-board").addEventListener("click", () => {
  state = {
    texts: [...defaultTexts],
    marked: Array(BOARD_SIZE * BOARD_SIZE).fill(false)
  };
  persist();
  renderBoard();
  refreshWinState();
});

document.getElementById("clear-marks").addEventListener("click", () => {
  state.marked = Array(BOARD_SIZE * BOARD_SIZE).fill(false);
  persist();
  renderBoard();
  refreshWinState();
});

function loadState() {
  const emptyState = {
    texts: [...defaultTexts],
    marked: Array(BOARD_SIZE * BOARD_SIZE).fill(false)
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.texts) || !Array.isArray(parsed.marked)) {
      return emptyState;
    }

    return {
      texts: parsed.texts.slice(0, BOARD_SIZE * BOARD_SIZE),
      marked: parsed.marked.slice(0, BOARD_SIZE * BOARD_SIZE)
    };
  } catch {
    return emptyState;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderBoard() {
  boardEl.replaceChildren();

  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) {
    const cellNode = template.content.firstElementChild.cloneNode(true);
    const textSpan = cellNode.querySelector(".cell-text");

    textSpan.textContent = state.texts[i] || "";

    cellNode.classList.toggle("marked", Boolean(state.marked[i]));

    cellNode.addEventListener("click", (event) => {
      if (event.target.classList.contains("cell-text")) {
        return;
      }

      state.marked[i] = !state.marked[i];
      persist();
      renderBoard();
      refreshWinState();
    });

    textSpan.addEventListener("focus", () => {
      cellNode.dataset.editing = "true";
    });

    textSpan.addEventListener("blur", () => {
      cellNode.dataset.editing = "false";
      state.texts[i] = textSpan.textContent.trim() || " ";
      persist();
      refreshWinState();
    });

    textSpan.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        textSpan.blur();
      }
    });

    boardEl.appendChild(cellNode);
  }
}

function refreshWinState() {
  const hasWin = checkBingo(state.marked);
  winMessageEl.textContent = hasWin ? "BINGO! 🎉 You got 5 in a row!" : "";

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
