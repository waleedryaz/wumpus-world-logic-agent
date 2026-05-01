// script.js - Enhanced Wumpus World Application with Gold Collection (FIXED)

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
        
        // Track dangers
        this.confirmedPits = new Set();
        this.confirmedWumpus = new Set();
        this.possiblePits = new Set();
        this.possibleWumpus = new Set();
        
        // Game state
        this.hasGold = false;
        this.gameOver = false;
        this.debugMode = false;
        this.moveCount = 0;
        
        this.initializeEventListeners();
        this.addLog("🎮 Welcome to Wumpus World! Configure settings and click Initialize.", "info");
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
                this.addLog(this.debugMode ? "🔍 Debug mode enabled - Hazards visible" : "🔍 Debug mode disabled", "info");
            }
        });
    }

    initialize() {
        this.rows = parseInt(document.getElementById('rows').value);
        this.cols = parseInt(document.getElementById('cols').value);
        
        if (this.rows < 4 || this.rows > 8 || this.cols < 4 || this.cols > 8) {
            this.showStatus("⚠️ Grid size must be between 4x4 and 8x8", "warning");
            return;
        }

        // Reset everything
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
        this.debugMode = document.getElementById('debugMode').checked;
        
        this.safe.add(this.coordToString(0, 0));
        this.visited.add(this.coordToString(0, 0));

        this.generateHazards();
        this.createGrid();
        this.updatePercepts();
        this.addInitialKnowledge();
        this.updateMetrics();
        this.renderGrid();
        
        document.getElementById('stepBtn').disabled = false;
        document.getElementById('autoBtn').disabled = false;
        
        document.getElementById('statusBanner').classList.add('hidden');
        
        this.addLog(`🎲 World initialized: ${this.rows}x${this.cols} grid`, "success");
        this.addLog(`🤖 Agent spawned at (0, 0)`, "info");
        this.addLog(`🎯 Objective: Find the gold and return safely!`, "info");
    }

    generateHazards() {
        // Place Wumpus (not at starting position)
        let wumpusPlaced = false;
        while (!wumpusPlaced) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            if ((r !== 0 || c !== 0) && (r > 1 || c > 1)) {
                this.wumpusPos = { row: r, col: c };
                wumpusPlaced = true;
            }
        }

        // Place Pits (20% of cells)
        let numPits = Math.floor(this.rows * this.cols * 0.2);
        numPits = Math.max(2, Math.min(numPits, this.rows * this.cols - 3));
        
        let pitsPlaced = 0;
        while (pitsPlaced < numPits) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            let coord = this.coordToString(r, c);
            
            if ((r !== 0 || c !== 0) && 
                (r !== this.wumpusPos.row || c !== this.wumpusPos.col) &&
                !this.pits.has(coord)) {
                this.pits.add(coord);
                pitsPlaced++;
            }
        }

        // Place Gold (safe location, not too close to start)
        let goldPlaced = false;
        while (!goldPlaced) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            let coord = this.coordToString(r, c);
            
            if ((r !== 0 || c !== 0) &&
                (r !== this.wumpusPos.row || c !== this.wumpusPos.col) &&
                !this.pits.has(coord) &&
                (Math.abs(r) + Math.abs(c) >= 2)) {
                this.goldPos = { row: r, col: c };
                goldPlaced = true;
            }
        }

        this.addLog(`👹 Wumpus placed at hidden location`, "warning");
        this.addLog(`🕳️ ${numPits} pits placed at hidden locations`, "warning");
        this.addLog(`💰 Gold placed at hidden location`, "warning");
    }

    createGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            let row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push({
                    row: r,
                    col: c,
                    hasBreeze: this.hasAdjacentPit(r, c),
                    hasStench: this.hasAdjacentWumpus(r, c),
                    hasGlitter: (r === this.goldPos.row && c === this.goldPos.col),
                    hasPit: this.pits.has(this.coordToString(r, c)),
                    hasWumpus: (r === this.wumpusPos.row && c === this.wumpusPos.col),
                    hasGold: (r === this.goldPos.row && c === this.goldPos.col)
                });
            }
            this.grid.push(row);
        }
    }

    hasAdjacentPit(row, col) {
        let neighbors = this.getNeighbors(row, col);
        for (let n of neighbors) {
            if (this.pits.has(this.coordToString(n.row, n.col))) {
                return true;
            }
        }
        return false;
    }

    hasAdjacentWumpus(row, col) {
        let neighbors = this.getNeighbors(row, col);
        for (let n of neighbors) {
            if (n.row === this.wumpusPos.row && n.col === this.wumpusPos.col) {
                return true;
            }
        }
        return false;
    }

    getNeighbors(row, col) {
        let neighbors = [];
        let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Up, Down, Left, Right
        
        for (let [dr, dc] of directions) {
            let newRow = row + dr;
            let newCol = col + dc;
            if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }
        
        return neighbors;
    }

    updatePercepts() {
        let cell = this.grid[this.agentPos.row][this.agentPos.col];
        this.percepts.breeze = cell.hasBreeze;
        this.percepts.stench = cell.hasStench;
        this.percepts.glitter = cell.hasGlitter;
        
        // Check for gold
        if (cell.hasGold && !this.hasGold) {
            this.hasGold = true;
            this.addLog(`💰 GOLD FOUND at (${this.agentPos.row}, ${this.agentPos.col})!`, "success");
            this.addLog(`🏠 New objective: Return to starting position (0, 0)`, "info");
            this.showStatus("🎉 Gold Collected! Return to (0,0) to win!", "success");
        }
    }

    addInitialKnowledge() {
        this.addKnowledgeForCell(this.agentPos.row, this.agentPos.col);
    }

    addKnowledgeForCell(row, col) {
        let cell = this.grid[row][col];
        let neighbors = this.getNeighbors(row, col);
        
        if (cell.hasBreeze) {
            let breezeVar = `B_${row}_${col}`;
            let pitVars = neighbors.map(n => `P_${n.row}_${n.col}`);
            this.logic.tellBiconditional(breezeVar, pitVars);
            this.logic.tell([breezeVar]);
            
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                if (!this.visited.has(coord)) {
                    this.possiblePits.add(coord);
                }
            }
            
            this.addLog(`💨 Breeze detected at (${row}, ${col}) - Pit in adjacent cells`, "warning");
        } else {
            for (let n of neighbors) {
                this.logic.tell([`!P_${n.row}_${n.col}`]);
                let coord = this.coordToString(n.row, n.col);
                this.possiblePits.delete(coord);
            }
            this.addLog(`✓ No breeze at (${row}, ${col}) - Adjacent cells safe from pits`, "success");
        }

        if (cell.hasStench) {
            let stenchVar = `S_${row}_${col}`;
            let wumpusVars = neighbors.map(n => `W_${n.row}_${n.col}`);
            this.logic.tellBiconditional(stenchVar, wumpusVars);
            this.logic.tell([stenchVar]);
            
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                if (!this.visited.has(coord)) {
                    this.possibleWumpus.add(coord);
                }
            }
            
            this.addLog(`💀 Stench detected at (${row}, ${col}) - Wumpus in adjacent cells`, "warning");
        } else {
            for (let n of neighbors) {
                this.logic.tell([`!W_${n.row}_${n.col}`]);
                let coord = this.coordToString(n.row, n.col);
                this.possibleWumpus.delete(coord);
            }
            this.addLog(`✓ No stench at (${row}, ${col}) - Adjacent cells safe from wumpus`, "success");
        }

        if (cell.hasGlitter) {
            this.addLog(`✨ Glitter detected at (${row}, ${col}) - GOLD IS HERE!`, "success");
        }

        this.logic.tell([`!P_${row}_${col}`]);
        this.logic.tell([`!W_${row}_${col}`]);
    }

    step() {
        if (this.isRunning || this.gameOver) return;

        this.moveCount++;

        // Check if we won (has gold and at starting position)
        if (this.hasGold && this.agentPos.row === 0 && this.agentPos.col === 0) {
            this.winGame();
            return;
        }

        let nextMove = null;

        // If we have gold, prioritize returning to start
        if (this.hasGold) {
            nextMove = this.findPathToStart();
            if (nextMove) {
                this.addLog(`🏠 Returning to start with gold...`, "info");
            }
        }

        // If no path to start or don't have gold yet, explore
        if (!nextMove) {
            nextMove = this.findNextSafeMove();
        }

        if (nextMove) {
            this.moveAgent(nextMove.row, nextMove.col);
        } else {
            this.stuckAgent();
        }
    }

    findPathToStart() {
        // BFS to find path back to (0, 0)
        if (this.agentPos.row === 0 && this.agentPos.col === 0) return null;

        let queue = [this.agentPos];
        let visitedBFS = new Set([this.coordToString(this.agentPos.row, this.agentPos.col)]);
        let parent = new Map();

        while (queue.length > 0) {
            let current = queue.shift();

            // Found start!
            if (current.row === 0 && current.col === 0) {
                // Backtrack to find first step
                let p = current;
                let prev = null;
                while (parent.has(this.coordToString(p.row, p.col))) {
                    prev = p;
                    p = parent.get(this.coordToString(p.row, p.col));
                }
                return prev; // Return first step towards start
            }

            let neighbors = this.getNeighbors(current.row, current.col);

            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);

                if (visitedBFS.has(coord)) continue;
                visitedBFS.add(coord);
                parent.set(coord, current);

                // Only move through visited safe cells
                if (this.visited.has(coord) || this.safe.has(coord)) {
                    queue.push(n);
                }
            }
        }

        return null; // No path found
    }

    findNextSafeMove() {
        // FIXED: First check ALL immediate neighbors before using BFS
        let neighbors = this.getNeighbors(this.agentPos.row, this.agentPos.col);
        
        // Try to find a safe unvisited neighbor
        for (let n of neighbors) {
            let coord = this.coordToString(n.row, n.col);
            
            // Skip if already visited
            if (this.visited.has(coord)) continue;
            
            // Try to prove this neighbor is safe
            if (this.isSafe(n.row, n.col)) {
                this.addLog(`→ Moving to adjacent safe cell (${n.row}, ${n.col})`, "info");
                return n;
            }
        }
        
        // If no immediate safe neighbor, use BFS to find any reachable safe cell
        return this.findSafeUnvisitedCellBFS();
    }

    isSafe(row, col) {
        let coord = this.coordToString(row, col);
        
        // If already confirmed dangerous, not safe
        if (this.confirmedPits.has(coord) || this.confirmedWumpus.has(coord)) {
            return false;
        }
        
        // Query KB: can we prove NOT Pit AND NOT Wumpus?
        let noPit = this.logic.ask(`!P_${row}_${col}`);
        let noWumpus = this.logic.ask(`!W_${row}_${col}`);
        
        if (noPit && noWumpus) {
            this.safe.add(coord);
            this.addLog(`✅ Proved (${row}, ${col}) is SAFE using ${this.logic.inferenceSteps} inference steps`, "success");
            return true;
        }
        
        this.addLog(`❓ Cannot prove (${row}, ${col}) is safe - Avoiding`, "warning");
        return false;
    }

    checkConfirmedPit(row, col) {
        let hasPit = this.logic.ask(`P_${row}_${col}`);
        
        if (hasPit) {
            let coord = this.coordToString(row, col);
            if (!this.confirmedPits.has(coord)) {
                this.confirmedPits.add(coord);
                this.possiblePits.delete(coord);
                this.addLog(`🕳️ CONFIRMED: Pit exists at (${row}, ${col})`, "error");
            }
            return true;
        }
        return false;
    }

    checkConfirmedWumpus(row, col) {
        let hasWumpus = this.logic.ask(`W_${row}_${col}`);
        
        if (hasWumpus) {
            let coord = this.coordToString(row, col);
            if (!this.confirmedWumpus.has(coord)) {
                this.confirmedWumpus.add(coord);
                this.possibleWumpus.delete(coord);
                this.addLog(`👹 CONFIRMED: Wumpus exists at (${row}, ${col})`, "error");
            }
            return true;
        }
        return false;
    }

    checkForConfirmedDangers() {
        // Check all unvisited cells that might be dangerous
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let coord = this.coordToString(r, c);
                
                if (!this.visited.has(coord) && !this.safe.has(coord)) {
                    this.checkConfirmedPit(r, c);
                    this.checkConfirmedWumpus(r, c);
                }
            }
        }
    }

    findSafeUnvisitedCellBFS() {
        // FIXED: Use proper BFS to find path to any safe unvisited cell
        let queue = [{pos: this.agentPos, path: []}];
        let visitedBFS = new Set([this.coordToString(this.agentPos.row, this.agentPos.col)]);
        
        while (queue.length > 0) {
            let {pos, path} = queue.shift();
            let neighbors = this.getNeighbors(pos.row, pos.col);
            
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                
                if (visitedBFS.has(coord)) continue;
                visitedBFS.add(coord);
                
                let newPath = [...path, n];
                
                // If this neighbor is safe and unvisited, we found a target!
                if (this.safe.has(coord) && !this.visited.has(coord)) {
                    // Return the FIRST step in the path
                    if (newPath.length > 0) {
                        this.addLog(`→ Navigating to safe cell (${n.row}, ${n.col}) via path`, "info");
                        return newPath[0];
                    }
                }
                
                // Continue BFS only through visited safe cells
                if (this.visited.has(coord)) {
                    queue.push({pos: n, path: newPath});
                }
            }
        }
        
        return null;
    }

    moveAgent(row, col) {
        this.agentPos = { row, col };
        this.visited.add(this.coordToString(row, col));
        this.safe.add(this.coordToString(row, col));
        
        let coord = this.coordToString(row, col);
        this.possiblePits.delete(coord);
        this.possibleWumpus.delete(coord);
        
        this.addLog(`🤖 Agent moved to (${row}, ${col})`, "info");
        
        this.updatePercepts();
        this.addKnowledgeForCell(row, col);
        this.checkForConfirmedDangers();
        
        this.updateMetrics();
        this.renderGrid();
    }

    stuckAgent() {
        this.gameOver = true;
        this.addLog(`⛔ AGENT STUCK: No safe moves available!`, "error");
        this.addLog(`📊 Final Stats: Moves: ${this.moveCount}, Explored: ${this.visited.size}/${this.rows * this.cols} cells`, "info");
        
        let unvisitedDangerous = [];
        let unvisitedUnknown = [];
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let coord = this.coordToString(r, c);
                if (!this.visited.has(coord)) {
                    if (this.possiblePits.has(coord) || this.possibleWumpus.has(coord) || 
                        this.confirmedPits.has(coord) || this.confirmedWumpus.has(coord)) {
                        unvisitedDangerous.push(`(${r},${c})`);
                    } else {
                        unvisitedUnknown.push(`(${r},${c})`);
                    }
                }
            }
        }
        
        if (unvisitedDangerous.length > 0) {
            this.addLog(`⚠️ Dangerous cells (cannot prove safe): ${unvisitedDangerous.join(', ')}`, "warning");
        }
        if (unvisitedUnknown.length > 0) {
            this.addLog(`❓ Unknown cells (unreachable): ${unvisitedUnknown.join(', ')}`, "info");
        }
        
        if (!this.hasGold) {
            this.showStatus(`💔 Game Over - Agent Stuck! Gold not found. Explored ${this.visited.size}/${this.rows * this.cols} cells`, "warning");
        } else {
            this.showStatus(`😢 Game Over - Agent Stuck with Gold! Couldn't return to start.`, "warning");
        }
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
    }

    winGame() {
        this.gameOver = true;
        this.addLog(`🎉 VICTORY! Agent returned with GOLD!`, "success");
        this.addLog(`📊 Stats: Moves: ${this.moveCount}, Cells Explored: ${this.visited.size}/${this.rows * this.cols}`, "success");
        this.addLog(`🧠 Total Inference Steps: ${this.logic.inferenceSteps}`, "success");
        
        let efficiency = ((this.visited.size / (this.rows * this.cols)) * 100).toFixed(1);
        this.showStatus(`🏆 MISSION COMPLETE! Gold retrieved in ${this.moveCount} moves! (${efficiency}% explored)`, "success");
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        
        // Celebration animation
        this.celebrateWin();
    }

    celebrateWin() {
        // Add confetti effect
        let container = document.querySelector('.container');
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                let confetti = document.createElement('div');
                confetti.textContent = ['🎉', '🎊', '⭐', '✨', '🏆', '💰'][Math.floor(Math.random() * 6)];
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.top = '-50px';
                confetti.style.fontSize = '40px';
                confetti.style.zIndex = '9999';
                confetti.style.pointerEvents = 'none';
                confetti.style.animation = 'fall 4s linear forwards';
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
            }, 1000);
        }
    }

    updateMetrics() {
        document.getElementById('inferenceSteps').textContent = this.logic.inferenceSteps.toLocaleString();
        
        let perceptText = [];
        if (this.percepts.breeze) perceptText.push("💨 Breeze");
        if (this.percepts.stench) perceptText.push("💀 Stench");
        if (this.percepts.glitter) perceptText.push("✨ Glitter");
        document.getElementById('percepts').textContent = perceptText.length > 0 ? perceptText.join(" ") : "None";
        
        document.getElementById('agentPos').textContent = `(${this.agentPos.row}, ${this.agentPos.col})`;
        document.getElementById('safeCells').textContent = this.safe.size;
        document.getElementById('confirmedPits').textContent = this.confirmedPits.size;
        document.getElementById('confirmedWumpus').textContent = this.confirmedWumpus.size;
        
        let goldStatus = this.hasGold ? "🏆 Collected!" : "🔍 Searching...";
        if (this.hasGold && this.agentPos.row === 0 && this.agentPos.col === 0) {
            goldStatus = "🎉 Secured!";
        }
        document.getElementById('goldStatus').textContent = goldStatus;
        
        let explorationPercent = ((this.visited.size / (this.rows * this.cols)) * 100).toFixed(1);
        document.getElementById('explorationProgress').textContent = `${explorationPercent}%`;
        
        document.getElementById('gridSize').textContent = `${this.rows}×${this.cols}`;
        document.getElementById('cellsExplored').textContent = `${this.visited.size}/${this.rows * this.cols} explored`;
        
        let kbText = this.logic.getRecentClauses(20);
        document.getElementById('kbContent').textContent = kbText || "No clauses yet";
        document.getElementById('kbSize').textContent = `${this.logic.getKBSize()} clauses`;
    }

    renderGrid() {
        let container = document.getElementById('gridContainer');
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.cols}, 90px)`;
        container.style.gridTemplateRows = `repeat(${this.rows}, 90px)`;
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let cell = this.createCellElement(r, c);
                container.appendChild(cell);
            }
        }
    }

    createCellElement(row, col) {
        let div = document.createElement('div');
        div.className = 'cell';
        
        let coord = this.coordToString(row, col);
        let cellData = this.grid[row][col];
        
        // Coordinate label
        let coordLabel = document.createElement('div');
        coordLabel.className = 'cell-coord';
        coordLabel.textContent = `${row},${col}`;
        div.appendChild(coordLabel);
        
        // Debug mode - show actual hazards with striped pattern
        if (this.debugMode && !this.visited.has(coord)) {
            if (cellData.hasPit) {
                div.style.background = 'repeating-linear-gradient(45deg, #fecaca, #fecaca 10px, #fca5a5 10px, #fca5a5 20px)';
            }
            if (cellData.hasWumpus) {
                div.style.background = 'repeating-linear-gradient(45deg, #ddd6fe, #ddd6fe 10px, #c4b5fd 10px, #c4b5fd 20px)';
            }
            if (cellData.hasGold) {
                div.style.background = 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 10px, #fde68a 10px, #fde68a 20px)';
            }
        }
        
        // Determine cell status
        if (this.confirmedPits.has(coord)) {
            div.classList.add('pit');
            let icon = document.createElement('div');
            icon.className = 'cell-content';
            icon.textContent = '🕳️';
            div.appendChild(icon);
        } else if (this.confirmedWumpus.has(coord)) {
            div.classList.add('wumpus');
            let icon = document.createElement('div');
            icon.className = 'cell-content';
            icon.textContent = '👹';
            div.appendChild(icon);
        } else if (cellData.hasGold && this.visited.has(coord) && !this.hasGold) {
            div.classList.add('gold');
            let icon = document.createElement('div');
            icon.className = 'cell-content';
            icon.textContent = '💰';
            div.appendChild(icon);
        } else if (this.visited.has(coord)) {
            div.classList.add('safe');
        } else if (this.safe.has(coord)) {
            div.classList.add('safe');
            div.style.opacity = '0.7';
        } else if (this.possiblePits.has(coord) || this.possibleWumpus.has(coord)) {
            div.classList.add('possible-danger');
            let icon = document.createElement('div');
            icon.className = 'cell-content';
            icon.textContent = '⚠️';
            div.appendChild(icon);
        } else {
            div.classList.add('unknown');
        }
        
        // Show percepts if visited
        if (this.visited.has(coord)) {
            let perceptDiv = document.createElement('div');
            perceptDiv.className = 'percept-icons';
            if (cellData.hasBreeze) perceptDiv.textContent += '💨 ';
            if (cellData.hasStench) perceptDiv.textContent += '💀 ';
            if (cellData.hasGlitter && !this.hasGold) perceptDiv.textContent += '✨';
            if (perceptDiv.textContent) div.appendChild(perceptDiv);
        }
        
        // Show agent
        if (row === this.agentPos.row && col === this.agentPos.col) {
            div.classList.add('agent');
            
            // Show gold on agent if collected
            if (this.hasGold) {
                let goldBadge = document.createElement('div');
                goldBadge.style.position = 'absolute';
                goldBadge.style.top = '5px';
                goldBadge.style.right = '5px';
                goldBadge.style.fontSize = '24px';
                goldBadge.textContent = '💰';
                goldBadge.style.animation = 'bounce 1s infinite';
                goldBadge.style.zIndex = '15';
                div.appendChild(goldBadge);
            }
        }
        
        return div;
    }

    coordToString(row, col) {
        return `${row},${col}`;
    }

    showStatus(message, type) {
        let banner = document.getElementById('statusBanner');
        let text = banner.querySelector('.status-text');
        
        banner.className = 'status-banner ' + type;
        text.textContent = message;
        banner.classList.remove('hidden');
        
        // Auto-hide after 5 seconds for non-critical messages
        if (type === 'info') {
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 5000);
        }
    }

    addLog(message, type = "info") {
        let logContent = document.getElementById('logContent');
        let entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        let timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Keep only last 100 entries
        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    clearLog() {
        document.getElementById('logContent').innerHTML = '';
        this.addLog("Log cleared", "info");
    }

    reset() {
        if (this.autoRunInterval) {
            clearInterval(this.autoRunInterval);
        }
        
        this.rows = 5;
        this.cols = 5;
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
        
        let container = document.getElementById('gridContainer');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎮</div>
                <h3>Ready to Explore!</h3>
                <p>Configure the grid settings and click "Initialize World" to begin</p>
            </div>
        `;
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        document.getElementById('autoBtn').innerHTML = '<span class="btn-icon">▶️</span> Auto Run';
        
        document.getElementById('inferenceSteps').textContent = '0';
        document.getElementById('percepts').textContent = 'None';
        document.getElementById('agentPos').textContent = '(0, 0)';
        document.getElementById('safeCells').textContent = '0';
        document.getElementById('confirmedPits').textContent = '0';
        document.getElementById('confirmedWumpus').textContent = '0';
        document.getElementById('goldStatus').textContent = 'Not Found';
        document.getElementById('explorationProgress').textContent = '0%';
        document.getElementById('gridSize').textContent = '0×0';
        document.getElementById('cellsExplored').textContent = '0/0 explored';
        document.getElementById('kbContent').textContent = 'Waiting for initialization...';
        document.getElementById('kbSize').textContent = '0 clauses';
        document.getElementById('logContent').innerHTML = '';
        document.getElementById('statusBanner').classList.add('hidden');
        
        this.addLog("🔄 System reset - Ready for new adventure!", "info");
    }
}

// Add CSS for confetti animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fall {
        to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the application
let world = new WumpusWorld();
