// script.js - PROPER Knowledge-Based Agent Implementation

class WumpusWorld {
    constructor() {
        this.rows = 5;
        this.cols = 5;
        this.grid = [];
        this.agentPos = { row: 0, col: 0 };
        this.visited = new Set();
        this.safe = new Set();
        this.pits = new Set();
        this.wumpusPos = null;
        this.goldPos = null;
        this.percepts = { breeze: false, stench: false, glitter: false };
        this.logic = new LogicEngine();
        this.isRunning = false;
        this.autoRunInterval = null;
        
        this.confirmedPits = new Set();
        this.confirmedWumpus = new Set();
        this.possiblePits = new Set();
        this.possibleWumpus = new Set();
        
        this.hasGold = false;
        this.gameOver = false;
        this.debugMode = false;
        this.moveCount = 0;
        
        this.initializeEventListeners();
        this.addLog("🎮 Welcome! Enable debug mode to see hazards, then initialize.", "info");
    }

    initializeEventListeners() {
        document.getElementById('initBtn').addEventListener('click', () => this.initialize());
        document.getElementById('stepBtn').addEventListener('click', () => this.step());
        document.getElementById('autoBtn').addEventListener('click', () => this.toggleAutoRun());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('clearLog').addEventListener('click', () => this.clearLog());
        document.getElementById('debugMode').addEventListener('change', (e) => {
            this.debugMode = e.target.checked;
            if (this.grid.length > 0) {
                this.renderGrid();
            }
        });
    }

    initialize() {
        this.rows = parseInt(document.getElementById('rows').value);
        this.cols = parseInt(document.getElementById('cols').value);
        
        if (this.rows < 4 || this.rows > 8 || this.cols < 4 || this.cols > 8) {
            alert("Grid must be 4x4 to 8x8");
            return;
        }

        this.grid = [];
        this.agentPos = { row: 0, col: 0 };
        this.visited = new Set();
        this.safe = new Set();
        this.pits = new Set();
        this.wumpusPos = null;
        this.goldPos = null;
        this.logic.reset();
        this.isRunning = false;
        this.confirmedPits = new Set();
        this.confirmedWumpus = new Set();
        this.possiblePits = new Set();
        this.possibleWumpus = new Set();
        this.hasGold = false;
        this.gameOver = false;
        this.moveCount = 0;
        
        // Start position is safe
        this.safe.add("0,0");
        this.visited.add("0,0");

        this.generateHazards();
        this.createGrid();
        this.updatePercepts();
        this.processCurrentCell();
        this.updateMetrics();
        this.renderGrid();
        
        document.getElementById('stepBtn').disabled = false;
        document.getElementById('autoBtn').disabled = false;
        document.getElementById('statusBanner').classList.add('hidden');
        
        this.addLog(`🎲 ${this.rows}x${this.cols} world created`, "success");
        this.addLog(`🤖 Agent at (0,0) - Starting exploration`, "info");
    }

    generateHazards() {
        // Wumpus - at least 2 cells away from start
        let validPositions = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (Math.abs(r) + Math.abs(c) >= 2) {
                    validPositions.push({row: r, col: c});
                }
            }
        }
        this.wumpusPos = validPositions[Math.floor(Math.random() * validPositions.length)];

        // Pits - 15-20% of grid
        let numPits = Math.floor(this.rows * this.cols * 0.18);
        let pitsPlaced = 0;
        while (pitsPlaced < numPits) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            let coord = `${r},${c}`;
            
            if ((r === 0 && c === 0)) continue;
            if (r === this.wumpusPos.row && c === this.wumpusPos.col) continue;
            if (this.pits.has(coord)) continue;
            
            this.pits.add(coord);
            pitsPlaced++;
        }

        // Gold - safe location
        let goldPlaced = false;
        while (!goldPlaced) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            let coord = `${r},${c}`;
            
            if (r === 0 && c === 0) continue;
            if (r === this.wumpusPos.row && c === this.wumpusPos.col) continue;
            if (this.pits.has(coord)) continue;
            
            this.goldPos = {row: r, col: c};
            goldPlaced = true;
        }

        this.addLog(`Hidden: Wumpus, ${numPits} pits, 1 gold`, "warning");
    }

    createGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            let row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    row: r,
                    col: c,
                    hasBreeze: this.checkAdjacentPit(r, c),
                    hasStench: this.checkAdjacentWumpus(r, c),
                    hasGlitter: (r === this.goldPos.row && c === this.goldPos.col),
                    hasPit: this.pits.has(`${r},${c}`),
                    hasWumpus: (r === this.wumpusPos.row && c === this.wumpusPos.col),
                    hasGold: (r === this.goldPos.row && c === this.goldPos.col)
                });
            }
            this.grid.push(row);
        }
    }

    checkAdjacentPit(row, col) {
        let neighbors = this.getNeighbors(row, col);
        return neighbors.some(n => this.pits.has(`${n.row},${n.col}`));
    }

    checkAdjacentWumpus(row, col) {
        let neighbors = this.getNeighbors(row, col);
        return neighbors.some(n => n.row === this.wumpusPos.row && n.col === this.wumpusPos.col);
    }

    getNeighbors(row, col) {
        let neighbors = [];
        if (row > 0) neighbors.push({row: row - 1, col: col});
        if (row < this.rows - 1) neighbors.push({row: row + 1, col: col});
        if (col > 0) neighbors.push({row: row, col: col - 1});
        if (col < this.cols - 1) neighbors.push({row: row, col: col + 1});
        return neighbors;
    }

    updatePercepts() {
        let cell = this.grid[this.agentPos.row][this.agentPos.col];
        this.percepts.breeze = cell.hasBreeze;
        this.percepts.stench = cell.hasStench;
        this.percepts.glitter = cell.hasGlitter;
        
        if (cell.hasGold && !this.hasGold) {
            this.hasGold = true;
            this.addLog(`💰 GOLD COLLECTED at (${this.agentPos.row},${this.agentPos.col})!`, "success");
            this.showStatus("🎉 Gold found! Return to (0,0)", "success");
        }
    }

    processCurrentCell() {
        let r = this.agentPos.row;
        let c = this.agentPos.col;
        let cell = this.grid[r][c];
        let neighbors = this.getNeighbors(r, c);
        
        // Tell KB this cell is safe
        this.logic.tell([`!P_${r}_${c}`]);
        this.logic.tell([`!W_${r}_${c}`]);
        
        if (cell.hasBreeze) {
            // Breeze means at least one neighbor has pit
            let pitVars = neighbors.map(n => `P_${n.row}_${n.col}`);
            let breezeVar = `B_${r}_${c}`;
            
            // B ⇔ (P1 ∨ P2 ∨ P3 ∨ P4)
            this.logic.tellBiconditional(breezeVar, pitVars);
            this.logic.tell([breezeVar]);
            
            // Mark neighbors as possibly dangerous
            neighbors.forEach(n => {
                let coord = `${n.row},${n.col}`;
                if (!this.visited.has(coord)) {
                    this.possiblePits.add(coord);
                }
            });
            
            this.addLog(`💨 Breeze at (${r},${c})`, "warning");
        } else {
            // No breeze = all neighbors safe from pits
            neighbors.forEach(n => {
                this.logic.tell([`!P_${n.row}_${n.col}`]);
                this.possiblePits.delete(`${n.row},${n.col}`);
            });
            this.addLog(`✓ No breeze - neighbors safe from pits`, "success");
        }

        if (cell.hasStench) {
            let wumpusVars = neighbors.map(n => `W_${n.row}_${n.col}`);
            let stenchVar = `S_${r}_${c}`;
            
            this.logic.tellBiconditional(stenchVar, wumpusVars);
            this.logic.tell([stenchVar]);
            
            neighbors.forEach(n => {
                let coord = `${n.row},${n.col}`;
                if (!this.visited.has(coord)) {
                    this.possibleWumpus.add(coord);
                }
            });
            
            this.addLog(`💀 Stench at (${r},${c})`, "warning");
        } else {
            neighbors.forEach(n => {
                this.logic.tell([`!W_${n.row}_${n.col}`]);
                this.possibleWumpus.delete(`${n.row},${n.col}`);
            });
            this.addLog(`✓ No stench - neighbors safe from wumpus`, "success");
        }

        // Now infer safety of all unvisited cells
        this.inferSafety();
    }

    inferSafety() {
        // Check all unvisited cells to see if we can prove them safe or dangerous
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let coord = `${r},${c}`;
                if (this.visited.has(coord)) continue;
                
                // Try to prove safe
                let noPit = this.logic.ask(`!P_${r}_${c}`);
                let noWumpus = this.logic.ask(`!W_${r}_${c}`);
                
                if (noPit && noWumpus) {
                    if (!this.safe.has(coord)) {
                        this.safe.add(coord);
                        this.addLog(`✅ Inferred (${r},${c}) is SAFE`, "success");
                    }
                    this.possiblePits.delete(coord);
                    this.possibleWumpus.delete(coord);
                }
                
                // Try to prove dangerous
                let hasPit = this.logic.ask(`P_${r}_${c}`);
                if (hasPit && !this.confirmedPits.has(coord)) {
                    this.confirmedPits.add(coord);
                    this.possiblePits.delete(coord);
                    this.safe.delete(coord);
                    this.addLog(`🕳️ Inferred PIT at (${r},${c})`, "error");
                }
                
                let hasWumpus = this.logic.ask(`W_${r}_${c}`);
                if (hasWumpus && !this.confirmedWumpus.has(coord)) {
                    this.confirmedWumpus.add(coord);
                    this.possibleWumpus.delete(coord);
                    this.safe.delete(coord);
                    this.addLog(`👹 Inferred WUMPUS at (${r},${c})`, "error");
                }
            }
        }
    }

    step() {
        if (this.gameOver) return;

        this.moveCount++;

        // Win condition
        if (this.hasGold && this.agentPos.row === 0 && this.agentPos.col === 0) {
            this.winGame();
            return;
        }

        let nextMove = null;

        // Priority 1: If we have gold, return home
        if (this.hasGold) {
            nextMove = this.findPathTo(0, 0);
            if (nextMove) {
                this.addLog(`🏠 Returning home with gold`, "info");
            }
        } 
        // Priority 2: If we see gold, go get it
        else if (this.percepts.glitter) {
            // Already on gold, collect it
            this.hasGold = true;
        }
        // Priority 3: Explore safe unvisited cells
        else {
            nextMove = this.findSafeUnvisitedCell();
        }

        if (nextMove) {
            this.moveToCell(nextMove.row, nextMove.col);
        } else {
            this.handleStuck();
        }
    }

    findSafeUnvisitedCell() {
        // Get all safe unvisited cells
        let safeUnvisited = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let coord = `${r},${c}`;
                if (this.safe.has(coord) && !this.visited.has(coord)) {
                    safeUnvisited.push({row: r, col: c});
                }
            }
        }

        if (safeUnvisited.length === 0) {
            return null;
        }

        // Find closest one using BFS
        let closest = null;
        let shortestPath = null;

        for (let target of safeUnvisited) {
            let path = this.findPathTo(target.row, target.col);
            if (path && (!shortestPath || path.distance < shortestPath.distance)) {
                closest = target;
                shortestPath = path;
            }
        }

        return shortestPath;
    }

    findPathTo(targetRow, targetCol) {
        // BFS to find path from current position to target
        let queue = [{pos: this.agentPos, path: [], distance: 0}];
        let visited = new Set([`${this.agentPos.row},${this.agentPos.col}`]);

        while (queue.length > 0) {
            let {pos, path, distance} = queue.shift();

            // Found target
            if (pos.row === targetRow && pos.col === targetCol) {
                if (path.length > 0) {
                    return {row: path[0].row, col: path[0].col, distance: distance};
                }
                return null; // Already at target
            }

            let neighbors = this.getNeighbors(pos.row, pos.col);
            for (let n of neighbors) {
                let coord = `${n.row},${n.col}`;
                if (visited.has(coord)) continue;
                
                // Can only traverse visited OR safe cells
                if (!this.visited.has(coord) && !this.safe.has(coord)) continue;
                
                visited.add(coord);
                let newPath = path.length === 0 ? [n] : path;
                queue.push({pos: n, path: newPath, distance: distance + 1});
            }
        }

        return null; // No path found
    }

    moveToCell(row, col) {
        this.agentPos = {row, col};
        let coord = `${row},${col}`;
        
        this.visited.add(coord);
        this.safe.add(coord);
        this.possiblePits.delete(coord);
        this.possibleWumpus.delete(coord);
        
        this.addLog(`🤖 Moved to (${row},${col})`, "info");
        
        this.updatePercepts();
        this.processCurrentCell();
        this.updateMetrics();
        this.renderGrid();
    }

    handleStuck() {
        this.gameOver = true;
        
        let safeCount = 0;
        let dangerCount = 0;
        let unknownCount = 0;
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let coord = `${r},${c}`;
                if (this.visited.has(coord)) continue;
                
                if (this.confirmedPits.has(coord) || this.confirmedWumpus.has(coord)) {
                    dangerCount++;
                } else if (this.safe.has(coord)) {
                    safeCount++;
                } else {
                    unknownCount++;
                }
            }
        }
        
        this.addLog(`⛔ STUCK! Safe unvisited: ${safeCount}, Dangerous: ${dangerCount}, Unknown: ${unknownCount}`, "error");
        
        if (!this.hasGold) {
            this.showStatus(`💔 Agent stuck - Gold not found (${this.visited.size}/${this.rows*this.cols} explored)`, "warning");
        } else {
            this.showStatus(`😢 Agent stuck with gold - Cannot return`, "warning");
        }
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
    }

    winGame() {
        this.gameOver = true;
        let efficiency = ((this.visited.size / (this.rows * this.cols)) * 100).toFixed(1);
        
        this.addLog(`🎉 VICTORY! Gold secured!`, "success");
        this.addLog(`📊 Moves: ${this.moveCount}, Explored: ${efficiency}%`, "success");
        
        this.showStatus(`🏆 Mission Complete! ${this.moveCount} moves, ${efficiency}% explored`, "success");
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        
        this.celebrateWin();
    }

    celebrateWin() {
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                let confetti = document.createElement('div');
                confetti.textContent = ['🎉','🎊','⭐','✨','🏆','💰'][Math.floor(Math.random()*6)];
                confetti.style.cssText = `position:fixed;left:${Math.random()*100}%;top:-50px;font-size:40px;z-index:9999;pointer-events:none;animation:fall 4s linear forwards`;
                document.body.appendChild(confetti);
                setTimeout(() => confetti.remove(), 4000);
            }, i * 150);
        }
    }

    toggleAutoRun() {
        if (this.isRunning) {
            clearInterval(this.autoRunInterval);
            this.isRunning = false;
            document.getElementById('autoBtn').innerHTML = '<span class="btn-icon">▶️</span> Auto Run';
            document.getElementById('stepBtn').disabled = false;
        } else {
            this.isRunning = true;
            document.getElementById('autoBtn').innerHTML = '<span class="btn-icon">⏸️</span> Stop';
            document.getElementById('stepBtn').disabled = true;
            
            this.autoRunInterval = setInterval(() => {
                if (this.gameOver) {
                    this.toggleAutoRun();
                    return;
                }
                this.step();
            }, 800);
        }
    }

    updateMetrics() {
        document.getElementById('inferenceSteps').textContent = this.logic.inferenceSteps.toLocaleString();
        
        let perceptText = [];
        if (this.percepts.breeze) perceptText.push("💨");
        if (this.percepts.stench) perceptText.push("💀");
        if (this.percepts.glitter) perceptText.push("✨");
        document.getElementById('percepts').textContent = perceptText.join(" ") || "None";
        
        document.getElementById('agentPos').textContent = `(${this.agentPos.row},${this.agentPos.col})`;
        document.getElementById('safeCells').textContent = this.safe.size;
        document.getElementById('confirmedPits').textContent = this.confirmedPits.size;
        document.getElementById('confirmedWumpus').textContent = this.confirmedWumpus.size;
        document.getElementById('goldStatus').textContent = this.hasGold ? "🏆 Collected" : "🔍 Searching";
        
        let progress = ((this.visited.size / (this.rows * this.cols)) * 100).toFixed(1);
        document.getElementById('explorationProgress').textContent = `${progress}%`;
        document.getElementById('gridSize').textContent = `${this.rows}×${this.cols}`;
        document.getElementById('cellsExplored').textContent = `${this.visited.size}/${this.rows*this.cols}`;
        
        let kbText = this.logic.getRecentClauses(20);
        document.getElementById('kbContent').textContent = kbText || "Empty";
        document.getElementById('kbSize').textContent = `${this.logic.getKBSize()} clauses`;
    }

    renderGrid() {
        let container = document.getElementById('gridContainer');
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.cols}, 90px)`;
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                container.appendChild(this.createCell(r, c));
            }
        }
    }

    createCell(r, c) {
        let div = document.createElement('div');
        div.className = 'cell';
        let coord = `${r},${c}`;
        let cell = this.grid[r][c];
        
        // Coordinate
        let label = document.createElement('div');
        label.className = 'cell-coord';
        label.textContent = `${r},${c}`;
        div.appendChild(label);
        
        // Debug mode - show hidden hazards
        if (this.debugMode && !this.visited.has(coord)) {
            if (cell.hasPit) {
                div.style.background = 'repeating-linear-gradient(45deg,#fca5a5,#fca5a5 10px,#f87171 10px,#f87171 20px)';
            }
            if (cell.hasWumpus) {
                div.style.background = 'repeating-linear-gradient(45deg,#c4b5fd,#c4b5fd 10px,#a78bfa 10px,#a78bfa 20px)';
            }
            if (cell.hasGold) {
                div.style.background = 'repeating-linear-gradient(45deg,#fde68a,#fde68a 10px,#fcd34d 10px,#fcd34d 20px)';
            }
        }
        
        // Cell state
        if (this.confirmedPits.has(coord)) {
            div.classList.add('pit');
            div.innerHTML += '<div class="cell-content">🕳️</div>';
        } else if (this.confirmedWumpus.has(coord)) {
            div.classList.add('wumpus');
            div.innerHTML += '<div class="cell-content">👹</div>';
        } else if (this.visited.has(coord)) {
            div.classList.add('safe');
            if (cell.hasGold && !this.hasGold) {
                div.innerHTML += '<div class="cell-content">💰</div>';
            }
        } else if (this.safe.has(coord)) {
            div.classList.add('safe');
            div.style.opacity = '0.6';
        } else if (this.possiblePits.has(coord) || this.possibleWumpus.has(coord)) {
            div.classList.add('possible-danger');
            div.innerHTML += '<div class="cell-content">⚠️</div>';
        } else {
            div.classList.add('unknown');
        }
        
        // Percepts
        if (this.visited.has(coord)) {
            let percepts = '';
            if (cell.hasBreeze) percepts += '💨';
            if (cell.hasStench) percepts += '💀';
            if (cell.hasGlitter && !this.hasGold) percepts += '✨';
            if (percepts) {
                div.innerHTML += `<div class="percept-icons">${percepts}</div>`;
            }
        }
        
        // Agent
        if (r === this.agentPos.row && c === this.agentPos.col) {
            div.classList.add('agent');
            if (this.hasGold) {
                div.innerHTML += '<div style="position:absolute;top:5px;right:5px;font-size:20px;z-index:15">💰</div>';
            }
        }
        
        return div;
    }

    showStatus(msg, type) {
        let banner = document.getElementById('statusBanner');
        banner.className = 'status-banner ' + type;
        banner.querySelector('.status-text').textContent = msg;
        banner.classList.remove('hidden');
    }

    addLog(msg, type = "info") {
        let log = document.getElementById('logContent');
        let entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        while (log.children.length > 100) log.removeChild(log.firstChild);
    }

    clearLog() {
        document.getElementById('logContent').innerHTML = '';
    }

    reset() {
        if (this.autoRunInterval) clearInterval(this.autoRunInterval);
        
        Object.assign(this, {
            rows: 5, cols: 5, grid: [], agentPos: {row:0, col:0},
            visited: new Set(), safe: new Set(), pits: new Set(),
            wumpusPos: null, goldPos: null, hasGold: false,
            gameOver: false, moveCount: 0, isRunning: false,
            confirmedPits: new Set(), confirmedWumpus: new Set(),
            possiblePits: new Set(), possibleWumpus: new Set()
        });
        
        this.logic.reset();
        
        document.getElementById('gridContainer').innerHTML = '<div class="empty-state"><div class="empty-icon">🎮</div><h3>Ready!</h3><p>Click Initialize World</p></div>';
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        document.getElementById('statusBanner').classList.add('hidden');
        
        ['inferenceSteps','safeCells','confirmedPits','confirmedWumpus'].forEach(id => 
            document.getElementById(id).textContent = '0'
        );
        document.getElementById('percepts').textContent = 'None';
        document.getElementById('agentPos').textContent = '(0,0)';
        document.getElementById('goldStatus').textContent = 'Not Found';
        document.getElementById('explorationProgress').textContent = '0%';
        document.getElementById('logContent').innerHTML = '';
        
        this.addLog("Reset complete", "info");
    }
}

document.head.insertAdjacentHTML('beforeend', '<style>@keyframes fall{to{transform:translateY(100vh) rotate(720deg);opacity:0}}</style>');
let world = new WumpusWorld();
