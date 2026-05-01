/* ============================================================
   SCRIPT.JS — Wumpus World Game Engine + Interactive UI
   ============================================================ */
"use strict";

/* ══════════════════════════════════════
   DOM REFS
   ══════════════════════════════════════ */
const gridContainer     = document.getElementById("gridContainer");
const btnNew            = document.getElementById("btnNew");
const btnStep           = document.getElementById("btnStep");
const btnAuto           = document.getElementById("btnAuto");
const btnStop           = document.getElementById("btnStop");
const btnReset          = document.getElementById("btnReset");
const rowsInput         = document.getElementById("rowsInput");
const colsInput         = document.getElementById("colsInput");
const pitCountInput     = document.getElementById("pitCountInput");
const speedInput        = document.getElementById("speedInput");
const rowsVal           = document.getElementById("rowsVal");
const colsVal           = document.getElementById("colsVal");
const pitsVal           = document.getElementById("pitsVal");
const speedVal          = document.getElementById("speedVal");
const statusBox         = document.getElementById("statusBox");
const perceptDisplay    = document.getElementById("perceptDisplay");
const agentPosDisplay   = document.getElementById("agentPosDisplay");
const gridSizeDisplay   = document.getElementById("gridSizeDisplay");
const stepDisplay       = document.getElementById("stepDisplay");
const kbLog             = document.getElementById("kbLog");
const kbViewer          = document.getElementById("kbViewer");
const kbSearch          = document.getElementById("kbSearch");
const kbCount           = document.getElementById("kbCount");
const metricInference   = document.getElementById("metricInference");
const metricVisited     = document.getElementById("metricVisited");
const metricSafe        = document.getElementById("metricSafe");
const metricSteps       = document.getElementById("metricSteps");
const metricClauses     = document.getElementById("metricClauses");
const metricResult      = document.getElementById("metricResult");
const cellTooltip       = document.getElementById("cellTooltip");
const headerStatus      = document.getElementById("headerStatus");
const liveDot           = document.querySelector(".live-dot");
const loadingScreen     = document.getElementById("loadingScreen");
const helpModal         = document.getElementById("helpModal");
const gridOverlay       = document.getElementById("gridOverlay");
const overlayBtn        = document.getElementById("overlayBtn");
const overlayIcon       = document.getElementById("overlayIcon");
const overlayTitle      = document.getElementById("overlayTitle");
const overlayMsg        = document.getElementById("overlayMsg");
const mainLayout        = document.getElementById("mainLayout");
const leftPanel         = document.getElementById("leftPanel");
const rightPanel        = document.getElementById("rightPanel");
const btnToggleLeft     = document.getElementById("btnToggleLeft");
const btnToggleRight    = document.getElementById("btnToggleRight");

/* ══════════════════════════════════════
   GAME STATE
   ══════════════════════════════════════ */
let ROWS, COLS, PIT_COUNT;
let grid            = [];
let agentRow        = 0;
let agentCol        = 0;
let agentAlive      = false;
let gameOver        = false;
let goldCollected   = false;
let autoTimer       = null;
let agentSteps      = 0;
let safeCellsProven = 0;
let gameStarted     = false;

const kb = new KnowledgeBase();

/* ══════════════════════════════════════
   LOADING SCREEN
   ══════════════════════════════════════ */
window.addEventListener("load", () => {
  setTimeout(() => {
    loadingScreen.classList.add("hidden");
    showOverlay("🆕", "Welcome!", "Configure settings and press New Game", true);
  }, 1400);
});

/* ══════════════════════════════════════
   SLIDER LIVE LABELS
   ══════════════════════════════════════ */
rowsInput.addEventListener("input", () => { rowsVal.textContent = rowsInput.value; });
colsInput.addEventListener("input", () => { colsVal.textContent = colsInput.value; });
pitCountInput.addEventListener("input", () => { pitsVal.textContent = pitCountInput.value; });
speedInput.addEventListener("input", () => { speedVal.textContent = speedInput.value + "ms"; });

/* ══════════════════════════════════════
   PANEL COLLAPSE
   ══════════════════════════════════════ */
let leftCollapsed  = false;
let rightCollapsed = false;

function updateLayoutClass() {
  mainLayout.classList.toggle("left-collapsed",  leftCollapsed);
  mainLayout.classList.toggle("right-collapsed", rightCollapsed);
  mainLayout.classList.toggle("both-collapsed",  leftCollapsed && rightCollapsed);
}
btnToggleLeft.addEventListener("click", () => {
  leftCollapsed = !leftCollapsed;
  leftPanel.classList.toggle("collapsed", leftCollapsed);
  btnToggleLeft.textContent = leftCollapsed ? "▶" : "◀";
  updateLayoutClass();
});
btnToggleRight.addEventListener("click", () => {
  rightCollapsed = !rightCollapsed;
  rightPanel.classList.toggle("collapsed", rightCollapsed);
  btnToggleRight.textContent = rightCollapsed ? "◀" : "▶";
  updateLayoutClass();
});

/* ══════════════════════════════════════
   COLLAPSIBLE SECTIONS
   ══════════════════════════════════════ */
document.querySelectorAll(".section-header[data-collapse]").forEach(header => {
  const bodyId = header.dataset.collapse;
  const body   = document.getElementById(bodyId);
  if (!body) return;

  // Set initial height so CSS transition works
  body.style.maxHeight = body.scrollHeight + "px";

  header.addEventListener("click", () => {
    const isCollapsed = body.classList.contains("collapsed");
    if (isCollapsed) {
      body.classList.remove("collapsed");
      body.style.maxHeight = body.scrollHeight + "px";
      header.classList.remove("collapsed");
    } else {
      body.style.maxHeight = body.scrollHeight + "px"; // fix before collapse
      requestAnimationFrame(() => {
        body.classList.add("collapsed");
        body.style.maxHeight = "0px";
        header.classList.add("collapsed");
      });
    }
  });
});

/* ══════════════════════════════════════
   THEME TOGGLE
   ══════════════════════════════════════ */
const btnTheme = document.getElementById("btnTheme");
btnTheme.addEventListener("click", () => {
  document.body.classList.toggle("light");
  btnTheme.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
  toast("Theme switched!", "info");
});

/* ══════════════════════════════════════
   FULLSCREEN
   ══════════════════════════════════════ */
document.getElementById("btnFullscreen").addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(()=>{});
  } else {
    document.exitFullscreen().catch(()=>{});
  }
});

/* ══════════════════════════════════════
   HELP MODAL
   ══════════════════════════════════════ */
document.getElementById("btnHelp").addEventListener("click", () => {
  helpModal.classList.remove("hidden");
});
document.getElementById("btnCloseHelp").addEventListener("click", () => {
  helpModal.classList.add("hidden");
});
helpModal.addEventListener("click", e => {
  if (e.target === helpModal) helpModal.classList.add("hidden");
});

/* ══════════════════════════════════════
   OVERLAY
   ══════════════════════════════════════ */
function showOverlay(icon, title, msg, withBtn = false) {
  overlayIcon.textContent  = icon;
  overlayTitle.textContent = title;
  overlayMsg.textContent   = msg;
  overlayBtn.style.display = withBtn ? "inline-flex" : "none";
  gridOverlay.classList.remove("hidden");
}
function hideOverlay() {
  gridOverlay.classList.add("hidden");
}
overlayBtn.addEventListener("click", () => btnNew.click());

/* ══════════════════════════════════════
   TOAST NOTIFICATIONS
   ══════════════════════════════════════ */
function toast(msg, type = "info") {
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.textContent = msg;
  document.getElementById("toastContainer").appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

/* ══════════════════════════════════════
   LIVE INDICATOR
   ══════════════════════════════════════ */
function setLiveStatus(text, state = "") {
  headerStatus.textContent = text;
  liveDot.className = "live-dot";
  if (state) liveDot.classList.add(state);
}

/* ══════════════════════════════════════
   LOG FILTER
   ══════════════════════════════════════ */
["Info","Step","Warn","Error"].forEach(t => {
  const cb = document.getElementById(`filter${t}`);
  if (!cb) return;
  cb.addEventListener("change", applyLogFilter);
});
function applyLogFilter() {
  const show = {
    info:  document.getElementById("filterInfo").checked,
    step:  document.getElementById("filterStep").checked,
    warn:  document.getElementById("filterWarn").checked,
    error: document.getElementById("filterError").checked
  };
  kbLog.querySelectorAll("p").forEach(p => {
    const cls = p.dataset.type || "step";
    p.classList.toggle("hidden-entry", !show[cls]);
  });
}

/* ══════════════════════════════════════
   KB SEARCH
   ══════════════════════════════════════ */
kbSearch.addEventListener("input", () => {
  const q = kbSearch.value.trim().toLowerCase();
  kbViewer.querySelectorAll("p").forEach(p => {
    p.classList.toggle("hidden-entry", q && !p.textContent.toLowerCase().includes(q));
  });
});

/* ══════════════════════════════════════
   CELL TOOLTIP
   ══════════════════════════════════════ */
function showCellTooltip(e, r, c) {
  const cell = grid[r][c];
  let html = `<div class="tooltip-title">Cell (${r}, ${c})</div>`;
  const row = (k, v, cls="") =>
    `<div class="tooltip-row"><span class="tooltip-key">${k}</span>
     <span class="tooltip-val ${cls}">${v}</span></div>`;

  html += row("Visited",  cell.visited  ? "Yes" : "No",  cell.visited  ? "yes" : "no");
  html += row("Proven Safe", cell.inferred ? "Yes" : "No", cell.inferred ? "no"  : "");
  if (cell.visited) {
    html += row("Breeze",  cell.percepts.breeze  ? "💨 Yes" : "No", cell.percepts.breeze  ? "yes":"no");
    html += row("Stench",  cell.percepts.stench  ? "💀 Yes" : "No", cell.percepts.stench  ? "yes":"no");
    html += row("Glitter", cell.percepts.glitter ? "✨ Yes" : "No", "");
  }
  if (gameOver) {
    html += row("Has Pit",    cell.hasPit    ? "☠️ YES" : "No", cell.hasPit    ? "yes":"no");
    html += row("Has Wumpus", cell.hasWumpus ? "👾 YES" : "No", cell.hasWumpus ? "yes":"no");
    html += row("Has Gold",   cell.hasGold   ? "💰 YES" : "No", "");
  }

  cellTooltip.innerHTML = html;
  cellTooltip.classList.remove("hidden");
  moveCellTooltip(e);
}
function moveCellTooltip(e) {
  const tw = cellTooltip.offsetWidth  || 180;
  const th = cellTooltip.offsetHeight || 120;
  let x = e.clientX + 14;
  let y = e.clientY - 10;
  if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - 14;
  if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
  cellTooltip.style.left = x + "px";
  cellTooltip.style.top  = y + "px";
}
function hideCellTooltip() {
  cellTooltip.classList.add("hidden");
}

/* ══════════════════════════════════════
   GAME INIT
   ══════════════════════════════════════ */
function initGame() {
  ROWS      = clamp(parseInt(rowsInput.value)     || 4, 3, 8);
  COLS      = clamp(parseInt(colsInput.value)     || 4, 3, 8);
  PIT_COUNT = clamp(parseInt(pitCountInput.value) || 3, 1,
                    Math.max(1, Math.floor(ROWS * COLS * 0.35)));

  rowsInput.value     = ROWS;
  colsInput.value     = COLS;
  pitCountInput.value = PIT_COUNT;
  rowsVal.textContent  = ROWS;
  colsVal.textContent  = COLS;
  pitsVal.textContent  = PIT_COUNT;

  agentRow      = 0;
  agentCol      = 0;
  agentAlive    = true;
  gameOver      = false;
  goldCollected = false;
  agentSteps    = 0;
  safeCellsProven = 0;
  gameStarted   = true;

  kb.reset();
  buildGrid();
  placeHazards();
  computePercepts();

  grid[0][0].safe = true;
  kb.tell(neg(atom("P_0_0")));
  kb.tell(neg(atom("W_0_0")));

  hideOverlay();
  renderGrid();
  setStatus(`New ${ROWS}×${COLS} grid · ${PIT_COUNT} pits · Agent at (0,0)`, "ok");
  setLiveStatus("Game started", "active");
  toast(`New ${ROWS}×${COLS} game started!`, "info");
  clearLog();
  updateMetrics();
  updateButtons(true);
  stopAuto();
  gridSizeDisplay.textContent = `${ROWS}×${COLS}`;
}

/* ── Build empty grid ── */
function buildGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = {
        row: r, col: c,
        hasPit: false, hasWumpus: false, hasGold: false,
        visited: false, safe: false, inferred: false,
        percepts: { breeze: false, stench: false, glitter: false }
      };
    }
  }
}

/* ── Place hazards randomly ── */
function placeHazards() {
  const forbidden = new Set(["0,0"]);

  let placed = 0;
  while (placed < PIT_COUNT) {
    const r = randInt(0, ROWS-1), c = randInt(0, COLS-1);
    const key = `${r},${c}`;
    if (!forbidden.has(key)) {
      grid[r][c].hasPit = true;
      forbidden.add(key);
      placed++;
    }
  }

  let wPlaced = false;
  while (!wPlaced) {
    const r = randInt(0, ROWS-1), c = randInt(0, COLS-1);
    const key = `${r},${c}`;
    if (!forbidden.has(key)) {
      grid[r][c].hasWumpus = true;
      forbidden.add(key);
      wPlaced = true;
    }
  }

  let gPlaced = false, attempts = 0;
  while (!gPlaced && attempts < 60) {
    const r = randInt(0, ROWS-1), c = randInt(0, COLS-1);
    if (r !== 0 || c !== 0) { grid[r][c].hasGold = true; gPlaced = true; }
    attempts++;
  }
}

/* ── Compute percepts for all cells ── */
function computePercepts() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      cell.percepts.glitter = cell.hasGold;
      cell.percepts.breeze  = false;
      cell.percepts.stench  = false;
      for (const [nr, nc] of getNeighbors(r, c)) {
        if (grid[nr][nc].hasPit)    cell.percepts.breeze = true;
        if (grid[nr][nc].hasWumpus) cell.percepts.stench = true;
      }
    }
  }
}

/* ══════════════════════════════════════
   FIRST VISIT
   ══════════════════════════════════════ */
function firstVisit() {
  const cell = grid[0][0];
  cell.visited = true;
  cell.safe    = true;
  agentSteps++;
  tellKBPercepts(0, 0);
  inferSafeNeighbors(0, 0);
  renderGrid();
  updateMetrics();
  updatePerceptDisplay();
  updateKBViewer();

  const parts = [];
  if (cell.percepts.breeze)  parts.push("💨 Breeze");
  if (cell.percepts.stench)  parts.push("💀 Stench");
  if (cell.percepts.glitter) parts.push("✨ Glitter");

  setStatus(
    `Agent at (0,0). ${parts.length ? parts.join(", ") + "!" : "All clear."} Ready to explore.`,
    "ok"
  );
  setLiveStatus("Exploring…", "active");
}

/* ══════════════════════════════════════
   AGENT STEP
   ══════════════════════════════════════ */
function agentStep() {
  if (gameOver) { stopAuto(); return; }

  const cell = grid[agentRow][agentCol];

  if (!cell.visited) {
    cell.visited = true;
    cell.safe    = true;
    agentSteps++;
    tellKBPercepts(agentRow, agentCol);

    // Animate
    const cellEl = getCellEl(agentRow, agentCol);
    if (cellEl) { cellEl.classList.add("just-visited"); setTimeout(()=>cellEl.classList.remove("just-visited"), 600); }
  }

  // Check hazards
  if (cell.hasPit) {
    endGame("💀 Agent fell into a Pit! Game Over.", "danger");
    return;
  }
  if (cell.hasWumpus) {
    endGame("🦷 Agent eaten by Wumpus! Game Over.", "danger");
    return;
  }
  if (cell.hasGold && !goldCollected) {
    goldCollected = true;
    cell.hasGold  = false;
    logMsg("🥇 Gold collected! Heading home…", "info");
    toast("🥇 Gold collected! Returning home!", "success");
  }

  inferSafeNeighbors(agentRow, agentCol);

  const next = chooseBestMove();
  if (!next) {
    if (goldCollected) {
      endGame("🏆 Agent returned home with the Gold! WIN!", "success");
    } else {
      endGame("🤔 Agent is stuck — no safe unvisited cell reachable.", "warn");
    }
    return;
  }

  logMsg(`👣 Agent moves: (${agentRow},${agentCol}) → (${next.r},${next.c})`, "step");
  agentRow = next.r;
  agentCol = next.c;

  if (goldCollected && agentRow === 0 && agentCol === 0) {
    endGame("🏆 Agent returned home with the Gold! WIN!", "success");
    return;
  }

  renderGrid();
  updateMetrics();
  updatePerceptDisplay();
  stepDisplay.textContent = agentSteps;
}

/* ══════════════════════════════════════
   KB OPERATIONS
   ══════════════════════════════════════ */
function tellKBPercepts(r, c) {
  const cell      = grid[r][c];
  const neighbors = getNeighbors(r, c);
  const label     = `${r}_${c}`;

  if (cell.percepts.breeze) {
    logMsg(`TELL: Breeze at (${r},${c})`, "info");
    kb.tell(atom(`B_${label}`));
    if (neighbors.length > 0) {
      const pitOrs = neighbors.map(([nr,nc]) => atom(`P_${nr}_${nc}`));
      kb.tell(implies(atom(`B_${label}`), or(...pitOrs)));
      for (const [nr,nc] of neighbors) {
        kb.tell(implies(atom(`P_${nr}_${nc}`), atom(`B_${label}`)));
      }
    }
  } else {
    logMsg(`TELL: No Breeze at (${r},${c})`, "info");
    kb.tell(neg(atom(`B_${label}`)));
    for (const [nr,nc] of neighbors) {
      kb.tell(neg(atom(`P_${nr}_${nc}`)));
    }
  }

  if (cell.percepts.stench) {
    logMsg(`TELL: Stench at (${r},${c})`, "info");
    kb.tell(atom(`S_${label}`));
    if (neighbors.length > 0) {
      const wOrs = neighbors.map(([nr,nc]) => atom(`W_${nr}_${nc}`));
      kb.tell(implies(atom(`S_${label}`), or(...wOrs)));
      for (const [nr,nc] of neighbors) {
        kb.tell(implies(atom(`W_${nr}_${nc}`), atom(`S_${label}`)));
      }
    }
  } else {
    logMsg(`TELL: No Stench at (${r},${c})`, "info");
    kb.tell(neg(atom(`S_${label}`)));
    for (const [nr,nc] of neighbors) {
      kb.tell(neg(atom(`W_${nr}_${nc}`)));
    }
  }

  kb.tell(neg(atom(`P_${r}_${c}`)));
  kb.tell(neg(atom(`W_${r}_${c}`)));
}

function inferSafeNeighbors(r, c) {
  for (const [nr, nc] of getNeighbors(r, c)) {
    if (grid[nr][nc].visited)  continue;
    if (grid[nr][nc].inferred) continue;

    const result = kb.askSafe(nr, nc);
    for (const line of result.logLines) logMsg(line, "step");

    if (result.proved) {
      grid[nr][nc].inferred = true;
      grid[nr][nc].safe     = true;
      safeCellsProven++;
      logMsg(`✅ (${nr},${nc}) PROVEN SAFE`, "info");

      // Animate
      const cellEl = getCellEl(nr, nc);
      if (cellEl) {
        cellEl.classList.add("just-inferred");
        setTimeout(() => cellEl.classList.remove("just-inferred"), 500);
      }
    }
  }
}

/* ══════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════ */
function chooseBestMove() {
  // 1. Adjacent proven-safe unvisited
  for (const [nr, nc] of getNeighbors(agentRow, agentCol)) {
    if (!grid[nr][nc].visited && grid[nr][nc].inferred) return { r:nr, c:nc };
  }

  // 2. BFS through visited cells to any safe frontier
  const visited = new Set();
  const queue   = [{ r:agentRow, c:agentCol, path:[] }];
  const key     = (r,c) => `${r},${c}`;

  while (queue.length > 0) {
    const { r, c, path } = queue.shift();
    if (visited.has(key(r,c))) continue;
    visited.add(key(r,c));

    for (const [nr,nc] of getNeighbors(r,c)) {
      if (visited.has(key(nr,nc))) continue;
      if (!grid[nr][nc].visited && grid[nr][nc].inferred) {
        return path.length === 0 ? { r:nr, c:nc } : path[0];
      }
      if (grid[nr][nc].visited) {
        queue.push({ r:nr, c:nc, path: path.length===0 ? [{r:nr,c:nc}] : path });
      }
    }
  }

  // 3. If gold collected, go home
  if (goldCollected) {
    const homePath = bfsPath(agentRow, agentCol, 0, 0);
    if (homePath && homePath.length > 0) return homePath[0];
  }

  return null;
}

function bfsPath(sr, sc, tr, tc) {
  const visited = new Set();
  const queue   = [{ r:sr, c:sc, path:[] }];
  const key     = (r,c) => `${r},${c}`;

  while (queue.length > 0) {
    const { r, c, path } = queue.shift();
    if (r === tr && c === tc) return path;
    if (visited.has(key(r,c))) continue;
    visited.add(key(r,c));

    for (const [nr,nc] of getNeighbors(r,c)) {
      if (!visited.has(key(nr,nc)) &&
          (grid[nr][nc].visited || (nr===tr&&nc===tc))) {
        queue.push({ r:nr, c:nc, path:[...path, {r:nr,c:nc}] });
      }
    }
  }
  return null;
}

/* ══════════════════════════════════════
   RENDERING
   ══════════════════════════════════════ */
function renderGrid() {
  gridContainer.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  gridContainer.innerHTML = "";

  for (let r = ROWS-1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const cell  = grid[r][c];
      const div   = document.createElement("div");
      div.classList.add("cell");
      div.dataset.r = r;
      div.dataset.c = c;

      const isAgent = r === agentRow && c === agentCol && agentAlive;
      let state;
      if (isAgent)                          state = "agent";
      else if (r===0 && c===0 && !cell.visited) state = "start";
      else if (cell.visited)                state = "safe";
      else if (cell.inferred)               state = "frontier";
      else                                  state = "unknown";

      div.classList.add(`state-${state}`);

      // Coord
      const coord = document.createElement("span");
      coord.className = "cell-coord";
      coord.textContent = `${r},${c}`;
      div.appendChild(coord);

      // Icon
      let icon = "";
      if (isAgent)                                           icon = "🤖";
      else if (gameOver && !cell.visited && cell.hasPit)    icon = "🕳️";
      else if (gameOver && !cell.visited && cell.hasWumpus) icon = "👾";
      else if (gameOver && !cell.visited && cell.hasGold)   icon = "💰";
      else if (cell.visited && cell.percepts.glitter)        icon = "💰";
      else if (state === "start")   icon = "🏠";
      else if (state === "safe")    icon = "✅";
      else if (state === "frontier") icon = "🔍";
      else                          icon = "";

      const iconEl = document.createElement("span");
      iconEl.className = "cell-icon";
      iconEl.textContent = icon;
      div.appendChild(iconEl);

      // Percept badges
      if (cell.visited || isAgent) {
        const badgeRow = document.createElement("div");
        badgeRow.className = "cell-percepts";
        if (cell.percepts.breeze) {
          const b = document.createElement("span");
          b.className = "percept-badge pb-breeze";
          b.textContent = "BRZ";
          badgeRow.appendChild(b);
        }
        if (cell.percepts.stench) {
          const s = document.createElement("span");
          s.className = "percept-badge pb-stench";
          s.textContent = "STN";
          badgeRow.appendChild(s);
        }
        if (cell.percepts.glitter) {
          const g = document.createElement("span");
          g.className = "percept-badge pb-glitter";
          g.textContent = "GLT";
          badgeRow.appendChild(g);
        }
        if (badgeRow.children.length > 0) div.appendChild(badgeRow);
      }

      // Tooltip events
      div.addEventListener("mouseenter", e => showCellTooltip(e, r, c));
      div.addEventListener("mousemove",  e => moveCellTooltip(e));
      div.addEventListener("mouseleave", hideCellTooltip);

      // Click to highlight
      div.addEventListener("click", () => {
        document.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected"));
        div.classList.add("selected");
      });

      gridContainer.appendChild(div);
    }
  }
}

function getCellEl(r, c) {
  return gridContainer.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

/* ══════════════════════════════════════
   GAME OVER
   ══════════════════════════════════════ */
function endGame(msg, type) {
  gameOver   = true;
  agentAlive = (type === "success");
  stopAuto();

  // Reveal all hazards
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].hasPit || grid[r][c].hasWumpus) {
        grid[r][c].inferred = false;
        grid[r][c].safe     = false;
      }
    }
  }

  renderGrid();
  setStatus(msg, type === "success" ? "win" : "bad");
  logMsg(msg, type === "success" ? "info" : "error");
  toast(msg, type === "success" ? "success" : type === "warn" ? "warning" : "danger");
  updateButtons(false);
  updateMetrics();
  updateKBViewer();

  const resultEl = metricResult;
  if (type === "success") {
    resultEl.textContent = "WIN 🏆";
    resultEl.style.color = "gold";
    setLiveStatus("WIN!", "success");
    showOverlay("🏆", "You Won!", "Agent collected the gold and returned home!", false);
  } else if (type === "warn") {
    resultEl.textContent = "STUCK";
    resultEl.style.color = "var(--warning)";
    setLiveStatus("Stuck", "");
    showOverlay("🤔", "Agent Stuck", "No safe moves available.", false);
  } else {
    resultEl.textContent = "LOST 💀";
    resultEl.style.color = "var(--danger)";
    setLiveStatus("Game Over", "danger");
    showOverlay("💀", "Game Over", msg, false);
  }

  setTimeout(hideOverlay, 2000);
}

/* ══════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════ */
function setStatus(msg, cls = "") {
  statusBox.innerHTML = msg;
  statusBox.className = "status-box " + cls;
}

let prevMetrics = {};
function animateMetric(el, newVal) {
  const prev = prevMetrics[el.id];
  if (prev !== undefined && prev !== newVal) {
    el.classList.remove("changed");
    void el.offsetWidth; // reflow
    el.classList.add("changed");
  }
  el.textContent = newVal;
  prevMetrics[el.id] = newVal;
}

function updateMetrics() {
  const total   = ROWS * COLS || 1;
  const visited = countVisited();
  const inf     = kb.getInferenceSteps();
  const clauses = kb.getClauseCount();

  animateMetric(metricInference, inf);
  animateMetric(metricVisited,   visited);
  animateMetric(metricSafe,      safeCellsProven);
  animateMetric(metricSteps,     agentSteps);
  animateMetric(metricClauses,   clauses);

  // Progress bars (relative to reasonable max)
  const pct = (v, max) => Math.min(100, Math.round((v/max)*100)) + "%";
  document.getElementById("barInference").style.width = pct(inf,        500);
  document.getElementById("barVisited").style.width   = pct(visited,    total);
  document.getElementById("barSafe").style.width      = pct(safeCellsProven, total);
  document.getElementById("barSteps").style.width     = pct(agentSteps, 50);
  document.getElementById("barClauses").style.width   = pct(clauses,    200);

  stepDisplay.textContent = agentSteps;
}

function updatePerceptDisplay() {
  if (!agentAlive || gameOver) { perceptDisplay.textContent = "—"; agentPosDisplay.textContent = "—"; return; }
  const cell  = grid[agentRow][agentCol];
  const parts = [];
  if (cell.percepts.breeze)  parts.push("💨 Breeze");
  if (cell.percepts.stench)  parts.push("💀 Stench");
  if (cell.percepts.glitter) parts.push("✨ Glitter");
  perceptDisplay.textContent = parts.length ? parts.join(" · ") : "None";
  agentPosDisplay.textContent = `(${agentRow}, ${agentCol})`;
}

function updateKBViewer() {
  kbViewer.innerHTML = "";
  const clauses = kb.getClauses();
  kbCount.textContent = clauses.length;

  const q = kbSearch.value.trim().toLowerCase();
  for (const clause of clauses) {
    const str = clauseStr(clause);
    const p   = document.createElement("p");
    p.textContent = str;
    if (q && !str.toLowerCase().includes(q)) p.classList.add("hidden-entry");
    kbViewer.appendChild(p);
  }
}

function logMsg(msg, type = "step") {
  const show = {
    info:  document.getElementById("filterInfo").checked,
    step:  document.getElementById("filterStep").checked,
    warn:  document.getElementById("filterWarn").checked,
    error: document.getElementById("filterError").checked
  };
  const p = document.createElement("p");
  p.textContent = msg;
  p.classList.add(type);
  p.dataset.type = type;
  if (!show[type]) p.classList.add("hidden-entry");
  kbLog.appendChild(p);
  kbLog.scrollTop = kbLog.scrollHeight;
}

function clearLog() {
  kbLog.innerHTML = "";
}

function countVisited() {
  let n = 0;
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) if(grid[r][c].visited) n++;
  return n;
}

function updateButtons(active) {
  btnStep.disabled  = !active;
  btnAuto.disabled  = !active;
  btnReset.disabled = !active;
  btnStop.disabled  = true;
}

/* ══════════════════════════════════════
   AUTO RUN
   ══════════════════════════════════════ */
function startAuto() {
  if (autoTimer || gameOver) return;
  const speed = clamp(parseInt(speedInput.value) || 800, 200, 3000);
  btnAuto.disabled = true;
  btnStop.disabled = false;
  btnStep.disabled = true;
  setLiveStatus("Auto running…", "active");
  toast(`Auto-run started (${speed}ms/step)`, "info");

  autoTimer = setInterval(() => {
    agentStep();
    updateKBViewer();
    if (gameOver) stopAuto();
  }, speed);
}

function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  if (!gameOver) {
    btnAuto.disabled = false;
    btnStop.disabled = true;
    btnStep.disabled = false;
    setLiveStatus("Paused", "");
  }
}

/* ══════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════ */
function getNeighbors(r, c) {
  return [[-1,0],[1,0],[0,-1],[0,1]]
    .map(([dr,dc]) => [r+dr, c+dc])
    .filter(([nr,nc]) => nr>=0 && nr<ROWS && nc>=0 && nc<COLS);
}
function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function clamp(v, mn, mx)  { return Math.max(mn, Math.min(mx, v)); }

/* ══════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════ */
btnNew.addEventListener("click", () => {
  initGame();
  firstVisit();
});

btnStep.addEventListener("click", () => {
  if (gameOver || !gameStarted) return;
  agentStep();
  updateKBViewer();
});

btnAuto.addEventListener("click",  startAuto);
btnStop.addEventListener("click",  stopAuto);

btnReset.addEventListener("click", () => {
  stopAuto();
  initGame();
  firstVisit();
});

document.getElementById("btnClearLog").addEventListener("click", () => {
  clearLog();
  toast("Log cleared", "info");
});

/* ── Keyboard shortcuts ── */
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "n" || e.key === "N") btnNew.click();
  if ((e.key === "s" || e.key === "S") && !btnStep.disabled)  btnStep.click();
  if ((e.key === "a" || e.key === "A") && !btnAuto.disabled)  btnAuto.click();
  if (e.key === "Escape") btnStop.click();
  if (e.key === "?" || e.key === "h" || e.key === "H") helpModal.classList.toggle("hidden");
});

/* ── Speed slider updates auto-timer on-the-fly ── */
speedInput.addEventListener("input", () => {
  if (autoTimer) {
    stopAuto();
    startAuto();
  }
});
