/* ============================================================
   SCRIPT.JS — Wumpus World Game Engine + UI
   ============================================================ */
"use strict";

/* ── DOM References ── */
const gridContainer    = document.getElementById("gridContainer");
const btnNew           = document.getElementById("btnNew");
const btnStep          = document.getElementById("btnStep");
const btnAuto          = document.getElementById("btnAuto");
const btnStop          = document.getElementById("btnStop");
const btnReset         = document.getElementById("btnReset");
const rowsInput        = document.getElementById("rowsInput");
const colsInput        = document.getElementById("colsInput");
const pitCountInput    = document.getElementById("pitCountInput");
const speedInput       = document.getElementById("speedInput");
const statusBox        = document.getElementById("statusBox");
const perceptDisplay   = document.getElementById("perceptDisplay");
const kbLog            = document.getElementById("kbLog");
const kbViewer         = document.getElementById("kbViewer");
const metricInference  = document.getElementById("metricInference");
const metricVisited    = document.getElementById("metricVisited");
const metricSafe       = document.getElementById("metricSafe");
const metricSteps      = document.getElementById("metricSteps");
const metricClauses    = document.getElementById("metricClauses");
const metricResult     = document.getElementById("metricResult");

/* ── Game State ── */
let ROWS, COLS, PIT_COUNT;
let grid          = [];   // 2D array of cell objects
let agentRow      = 0;
let agentCol      = 0;
let agentAlive    = false;
let gameOver      = false;
let goldCollected = false;
let autoTimer     = null;
let agentSteps    = 0;
let safeCellsProven = 0;

const kb = new KnowledgeBase();

/* ── Cell Object ──
   {
     hasPit:    bool,  hasWumpus: bool,  hasGold: bool,
     visited:   bool,  safe:      bool,  inferred: bool,
     percepts:  { breeze, stench, glitter },
     row, col
   }
*/

/* ════════════════════════════════════════
   INITIALISATION
   ════════════════════════════════════════ */
function initGame() {
  ROWS      = clamp(parseInt(rowsInput.value)    || 4, 3, 8);
  COLS      = clamp(parseInt(colsInput.value)    || 4, 3, 8);
  PIT_COUNT = clamp(parseInt(pitCountInput.value)|| 3, 1, Math.floor(ROWS*COLS*0.4));

  rowsInput.value    = ROWS;
  colsInput.value    = COLS;
  pitCountInput.value = PIT_COUNT;

  agentRow      = 0;
  agentCol      = 0;
  agentAlive    = true;
  gameOver      = false;
  goldCollected = false;
  agentSteps    = 0;
  safeCellsProven = 0;

  kb.reset();
  buildGrid();
  placeHazards();
  computePercepts();

  // Agent starts at (0,0) — always safe, no pit or wumpus placed there
  grid[0][0].safe    = true;
  grid[0][0].visited = false; // will be set on first step

  // Tell KB that (0,0) is safe
  kb.tell(neg(atom("P_0_0")));
  kb.tell(neg(atom("W_0_0")));

  renderGrid();
  setStatus(`New ${ROWS}×${COLS} grid. ${PIT_COUNT} pits hidden. Agent at (0,0).`, "info");
  clearLog();
  updateMetrics();
  updateButtons(true);
  stopAuto();
}

function buildGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = {
        row:r, col:c,
        hasPit:false, hasWumpus:false, hasGold:false,
        visited:false, safe:false, inferred:false,
        percepts:{ breeze:false, stench:false, glitter:false }
      };
    }
  }
}

function placeHazards() {
  const forbidden = new Set(["0,0"]);

  // Place pits
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

  // Place Wumpus
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

  // Place Gold (not on agent start, not on same cell as hazards for clarity)
  let gPlaced = false;
  let attempts = 0;
  while (!gPlaced && attempts < 50) {
    const r = randInt(0, ROWS-1), c = randInt(0, COLS-1);
    if (r !== 0 || c !== 0) { grid[r][c].hasGold = true; gPlaced = true; }
    attempts++;
  }
}

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

/* ════════════════════════════════════════
   AGENT STEP
   ════════════════════════════════════════ */
function agentStep() {
  if (gameOver) { stopAuto(); return; }

  const cell = grid[agentRow][agentCol];

  // Mark visited
  if (!cell.visited) {
    cell.visited = true;
    cell.safe    = true;
    agentSteps++;
    tellKBPercepts(agentRow, agentCol);
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
  if (cell.hasGold) {
    goldCollected = true;
    cell.hasGold  = false;
    logMsg("🥇 Gold collected!", "info");
    // Try to return home
  }

  // Infer safe cells around current position
  inferSafeNeighbors(agentRow, agentCol);

  // Choose next move
  const next = chooseBestMove();
  if (!next) {
    endGame("🤔 Agent is stuck — no safe unvisited cell reachable.", "warn");
    return;
  }

  logMsg(`Agent moves to (${next.r},${next.c})`, "step");
  agentRow = next.r;
  agentCol = next.c;

  // If agent returns home after gold
  if (goldCollected && agentRow === 0 && agentCol === 0) {
    endGame("🏆 Agent returned home with the Gold! WIN!", "success");
    return;
  }

  renderGrid();
  updateMetrics();
  updatePerceptDisplay();
}

/* ── Tell KB about percepts at (r,c) ── */
function tellKBPercepts(r, c) {
  const cell      = grid[r][c];
  const neighbors = getNeighbors(r, c);
  const label     = `${r}_${c}`;

  // Breeze percept: B_r_c ⟺ ⋁ P_neighbors
  if (cell.percepts.breeze) {
    logMsg(`TELL: Breeze at (${r},${c})`, "info");
    kb.tell(atom(`B_${label}`));
    // B_r_c → P_n1 ∨ P_n2 ∨ ...
    if (neighbors.length > 0) {
      const pitOrs = neighbors.map(([nr,nc]) => atom(`P_${nr}_${nc}`));
      kb.tell(implies(atom(`B_${label}`), or(...pitOrs)));
      // Each pit neighbor → breeze at (r,c)
      for (const [nr,nc] of neighbors) {
        kb.tell(implies(atom(`P_${nr}_${nc}`), atom(`B_${label}`)));
      }
    }
  } else {
    // No breeze → no pit in any neighbor
    logMsg(`TELL: No Breeze at (${r},${c}) → neighbors safe from pits`, "info");
    kb.tell(neg(atom(`B_${label}`)));
    for (const [nr,nc] of neighbors) {
      kb.tell(neg(atom(`P_${nr}_${nc}`)));
    }
  }

  // Stench percept: S_r_c ⟺ ⋁ W_neighbors
  if (cell.percepts.stench) {
    logMsg(`TELL: Stench at (${r},${c})`, "info");
    kb.tell(atom(`S_${label}`));
    if (neighbors.length > 0) {
      const wumpusOrs = neighbors.map(([nr,nc]) => atom(`W_${nr}_${nc}`));
      kb.tell(implies(atom(`S_${label}`), or(...wumpusOrs)));
      for (const [nr,nc] of neighbors) {
        kb.tell(implies(atom(`W_${nr}_${nc}`), atom(`S_${label}`)));
      }
    }
  } else {
    logMsg(`TELL: No Stench at (${r},${c}) → neighbors safe from Wumpus`, "info");
    kb.tell(neg(atom(`S_${label}`)));
    for (const [nr,nc] of neighbors) {
      kb.tell(neg(atom(`W_${nr}_${nc}`)));
    }
  }

  // Current cell is definitely safe (agent is here and alive)
  kb.tell(neg(atom(`P_${r}_${c}`)));
  kb.tell(neg(atom(`W_${r}_${c}`)));
}

/* ── Run Resolution on neighbors ── */
function inferSafeNeighbors(r, c) {
  for (const [nr, nc] of getNeighbors(r, c)) {
    if (grid[nr][nc].visited) continue;
    if (grid[nr][nc].inferred) continue;

    const result = kb.askSafe(nr, nc);
    for (const line of result.logLines) logMsg(line, "step");

    if (result.proved) {
      grid[nr][nc].inferred = true;
      grid[nr][nc].safe     = true;
      safeCellsProven++;
      logMsg(`✅ (${nr},${nc}) proven safe by resolution`, "info");
    }
  }
}

/* ── Choose next move (BFS-based safe navigation) ──
   Priority:
   1. Unvisited & proven-safe adjacent cell
   2. Unvisited & proven-safe reachable cell (BFS through visited cells)
   3. Return home if gold collected
*/
function chooseBestMove() {
  // 1. Adjacent proven-safe unvisited
  for (const [nr, nc] of getNeighbors(agentRow, agentCol)) {
    if (!grid[nr][nc].visited && grid[nr][nc].inferred) {
      return { r:nr, c:nc };
    }
  }

  // 2. BFS through visited cells to find a safe unvisited frontier
  const visited  = new Set();
  const queue    = [{ r:agentRow, c:agentCol, path:[] }];
  const key      = (r,c) => `${r},${c}`;

  while (queue.length > 0) {
    const { r, c, path } = queue.shift();
    if (visited.has(key(r,c))) continue;
    visited.add(key(r,c));

    for (const [nr,nc] of getNeighbors(r,c)) {
      if (visited.has(key(nr,nc))) continue;

      if (!grid[nr][nc].visited && grid[nr][nc].inferred) {
        // Found safe unvisited cell; return the first step of the path
        if (path.length === 0) return { r:nr, c:nc };
        return path[0];
      }
      if (grid[nr][nc].visited) {
        queue.push({ r:nr, c:nc, path: path.length===0 ? [{r:nr,c:nc}] : path });
      }
    }
  }

  // 3. If gold collected, try to go home via BFS
  if (goldCollected) {
    const homePath = bfsPath(agentRow, agentCol, 0, 0);
    if (homePath && homePath.length > 0) return homePath[0];
  }

  return null;
}

/* BFS to find path through visited cells */
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
      if (!visited.has(key(nr,nc)) && (grid[nr][nc].visited || (nr===tr&&nc===tc))) {
        queue.push({ r:nr, c:nc, path:[...path, {r:nr,c:nc}] });
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════
   RENDERING
   ════════════════════════════════════════ */
function renderGrid() {
  gridContainer.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  gridContainer.innerHTML = "";

  // Render rows bottom-to-top so (0,0) appears bottom-left
  for (let r = ROWS-1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const div  = document.createElement("div");
      div.classList.add("cell");

      // Determine state
      const isAgent = r === agentRow && c === agentCol && agentAlive;
      let state;
      if (isAgent)                         state = "agent";
      else if (r===0&&c===0&&!cell.visited) state = "start";
      else if (cell.visited)               state = "safe";
      else if (cell.inferred)              state = "frontier";
      else                                 state = "unknown";

      div.classList.add(`state-${state}`);

      // Coord label
      const coordLabel = document.createElement("span");
      coordLabel.className = "cell-coord";
      coordLabel.textContent = `${r},${c}`;
      div.appendChild(coordLabel);

      // Determine icon
      let icon = "";
      if (isAgent)                       icon = "🤖";
      else if (!cell.visited && cell.hasGold && gameOver)  icon = "💰";
      else if (!cell.visited && cell.hasPit && gameOver)   icon = "🕳️";
      else if (!cell.visited && cell.hasWumpus && gameOver) icon = "👾";
      else if (cell.visited && cell.percepts.glitter)      icon = "💰";
      else if (state === "start")        icon = "🏠";
      else if (state === "safe")         icon = "✅";
      else if (state === "frontier")     icon = "🔍";
      else                               icon = "";

      const iconEl = document.createElement("span");
      iconEl.className = "cell-icon";
      iconEl.textContent = icon;
      div.appendChild(iconEl);

      // Percept badges (only for visited cells)
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

      // Tooltip
      div.title = buildTooltip(r, c);

      gridContainer.appendChild(div);
    }
  }
}

function buildTooltip(r, c) {
  const cell = grid[r][c];
  let t = `Cell (${r},${c})\n`;
  t += `Visited: ${cell.visited}\n`;
  t += `Safe(proven): ${cell.inferred}\n`;
  if (cell.visited) {
    t += `Breeze: ${cell.percepts.breeze}\n`;
    t += `Stench: ${cell.percepts.stench}\n`;
  }
  if (gameOver) {
    t += `Pit: ${cell.hasPit}\n`;
    t += `Wumpus: ${cell.hasWumpus}\n`;
    t += `Gold: ${cell.hasGold}\n`;
  }
  return t;
}

/* ════════════════════════════════════════
   GAME OVER
   ════════════════════════════════════════ */
function endGame(msg, type) {
  gameOver   = true;
  agentAlive = (type === "success");
  stopAuto();

  // Reveal the world
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].hasPit || grid[r][c].hasWumpus) {
        grid[r][c].inferred = false;
        grid[r][c].safe     = false;
      }
    }
  }
  renderGrid();

  setStatus(msg, type);
  metricResult.textContent = type === "success" ? "WIN 🏆" : type === "warn" ? "STUCK" : "LOST 💀";
  metricResult.style.color = type === "success" ? "#3fb950" : type === "warn" ? "#d29922" : "#f85149";
  updateButtons(false);
  updateMetrics();
  logMsg(msg, type === "success" ? "info" : "error");
  updateKBViewer();
}

/* ════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════ */
function setStatus(msg, type = "info") {
  statusBox.innerHTML = `<b>${msg}</b>`;
  statusBox.style.borderColor = type==="info"    ? "var(--accent2)"
                               : type==="danger" ? "var(--danger)"
                               : type==="warn"   ? "var(--warning)"
                               : type==="success"? "gold"
                               : "var(--border)";
}

function logMsg(msg, type = "") {
  const p = document.createElement("p");
  p.textContent = msg;
  if (type) p.classList.add(type);
  kbLog.appendChild(p);
  kbLog.scrollTop = kbLog.scrollHeight;
}

function clearLog() {
  kbLog.innerHTML = "";
}

function updateMetrics() {
  metricInference.textContent = kb.getInferenceSteps();
  metricVisited.textContent   = countVisited();
  metricSafe.textContent      = safeCellsProven;
  metricSteps.textContent     = agentSteps;
  metricClauses.textContent   = kb.getClauseCount();
}

function updatePerceptDisplay() {
  if (!agentAlive || gameOver) { perceptDisplay.textContent = "—"; return; }
  const cell = grid[agentRow][agentCol];
  const parts = [];
  if (cell.percepts.breeze)  parts.push("💨 Breeze");
  if (cell.percepts.stench)  parts.push("💀 Stench");
  if (cell.percepts.glitter) parts.push("✨ Glitter");
  perceptDisplay.textContent = parts.length ? parts.join(" | ") : "None";
}

function updateKBViewer() {
  kbViewer.innerHTML = "";
  for (const clause of kb.getClauses()) {
    const p = document.createElement("p");
    p.textContent = clauseStr(clause);
    kbViewer.appendChild(p);
  }
  kbViewer.scrollTop = 0;
}

function countVisited() {
  let n = 0;
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if(grid[r][c].visited) n++;
  return n;
}

function updateButtons(active) {
  btnStep.disabled  = !active;
  btnAuto.disabled  = !active;
  btnReset.disabled = !active;
  btnStop.disabled  = true;
}

function startAuto() {
  if (autoTimer) return;
  const speed = clamp(parseInt(speedInput.value) || 800, 200, 3000);
  btnAuto.disabled = true;
  btnStop.disabled = false;
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
  }
}

/* ════════════════════════════════════════
   UTILITY
   ════════════════════════════════════════ */
function getNeighbors(r, c) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  return dirs
    .map(([dr,dc]) => [r+dr, c+dc])
    .filter(([nr,nc]) => nr>=0 && nr<ROWS && nc>=0 && nc<COLS);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* ════════════════════════════════════════
   FIRST STEP: visit (0,0) on game start
   ════════════════════════════════════════ */
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
  setStatus(`Agent at (0,0). ${cell.percepts.breeze?"💨 Breeze! ":""}${cell.percepts.stench?"💀 Stench! ":""}${cell.percepts.glitter?"✨ Glitter! ":""}Ready to explore.`, "info");
}

/* ════════════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════════════ */
btnNew.addEventListener("click", () => {
  initGame();
  firstVisit();
});

btnStep.addEventListener("click", () => {
  if (gameOver) return;
  agentStep();
  updateKBViewer();
});

btnAuto.addEventListener("click", startAuto);
btnStop.addEventListener("click", stopAuto);

btnReset.addEventListener("click", () => {
  stopAuto();
  initGame();
  firstVisit();
});

/* ── Keyboard shortcuts ── */
document.addEventListener("keydown", e => {
  if (e.key === "n" || e.key === "N") btnNew.click();
  if (e.key === "s" || e.key === "S") { if (!btnStep.disabled) btnStep.click(); }
  if (e.key === "a" || e.key === "A") { if (!btnAuto.disabled) btnAuto.click(); }
  if (e.key === "Escape")             btnStop.click();
});
