// script.js - Fixed Wumpus World with Correct Movement in All Directions

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
                this.addLog(this.debugMode ? "🔍 Debug mode enabled" : "🔍 Debug mode disabled", "info");
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
        this.addLog(`🎯 Objective: Find gold and return safely!`, "info");
    }

    generateHazards() {
        // Place Wumpus
        let wumpusPlaced = false;
        while (!wumpusPlaced) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            if ((r !== 0 || c !== 0) && (r > 1 || c > 1)) {
                this.wumpusPos = { row: r, col: c };
                wumpusPlaced = true;
            }
        }

        // Place Pits
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

        // Place Gold
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

        this.addLog(`👹 Wumpus hidden | 🕳️ ${numPits} pits hidden | 💰 Gold hidden`, "warning");
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
        // All 4 directions: up, down, left, right
        if (row > 0) neighbors.push({ row: row - 1, col: col }); // Up
        if (row < this.rows - 1) neighbors.push({ row: row + 1, col: col }); // Down
        if (col > 0) neighbors.push({ row: row, col: col - 1 }); // Left
        if (col < this.cols - 1) neighbors.push({ row: row, col: col + 1 }); // Right
        return neighbors;
    }

    updatePercepts() {
        let cell = this.grid[this.agentPos.row][this.agentPos.col];
        this.percepts.breeze = cell.hasBreeze;
        this.percepts.stench = cell.hasStench;
        this.percepts.glitter = cell.hasGlitter;
        
        if (cell.hasGold && !this.hasGold) {
            this.hasGold = true;
            this.addLog(`💰 GOLD FOUND at (${this.agentPos.row}, ${this.agentPos.col})!`, "success");
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
            this.addLog(`💨 Breeze at (${row},${col})`, "warning");
        } else {
            for (let n of neighbors) {
                this.logic.tell([`!P_${n.row}_${n.col}`]);
                this.possiblePits.delete(this.coordToString(n.row, n.col));
            }
            this.addLog(`✓ No breeze at (${row},${col})`, "success");
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
            this.addLog(`💀 Stench at (${row},${col})`, "warning");
        } else {
            for (let n of neighbors) {
                this.logic.tell([`!W_${n.row}_${n.col}`]);
                this.possibleWumpus.delete(this.coordToString(n.row, n.col));
            }
            this.addLog(`✓ No stench at (${row},${col})`, "success");
        }

        if (cell.hasGlitter) {
            this.addLog(`✨ Glitter at (${row},${col})!`, "success");
        }

        this.logic.tell([`!P_${row}_${col}`]);
        this.logic.tell([`!W_${row}_${col}`]);
    }

    step() {
        if (this.gameOver) return;

        this.moveCount++;

        // Check win condition
        if (this.hasGold && this.agentPos.row === 0 && this.agentPos.col === 0) {
            this.winGame();
            return;
        }

        let nextMove = null;

        // If has gold, return to start
        if (this.hasGold) {
            nextMove = this.findPathToStart();
        }

        // Otherwise explore
        if (!nextMove) {
            nextMove = this.findNextMove();
        }

        if (nextMove) {
            this.moveAgent(nextMove.row, nextMove.col);
        } else {
            this.stuckAgent();
        }
    }

    findPathToStart() {
        if (this.agentPos.row === 0 && this.agentPos.col === 0) return null;

        let queue = [[this.agentPos]];
        let visited = new Set([this.coordToString(this.agentPos.row, this.agentPos.col)]);

        while (queue.length > 0) {
            let path = queue.shift();
            let current = path[path.length - 1];

            let neighbors = this.getNeighbors(current.row, current.col);
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                
                if (visited.has(coord)) continue;
                visited.add(coord);

                let newPath = [...path, n];

                // Found start!
                if (n.row === 0 && n.col === 0) {
                    return newPath[1]; // Return first step
                }

                // Only traverse safe visited cells
                if (this.visited.has(coord)) {
                    queue.push(newPath);
                }
            }
        }
        return null;
    }

    findNextMove() {
        // Step 1: Check all immediate unvisited neighbors
        let neighbors = this.getNeighbors(this.agentPos.row, this.agentPos.col);
        
        for (let n of neighbors) {
            let coord = this.coordToString(n.row, n.col);
            
            // Skip visited
            if (this.visited.has(coord)) continue;
            
            // Skip confirmed dangers
            if (this.confirmedPits.has(coord) || this.confirmedWumpus.has(coord)) {
                continue;
            }
            
            // Try to prove safe
            if (this.canProveSafe(n.row, n.col)) {
                this.addLog(`→ Moving to safe neighbor (${n.row},${n.col})`, "info");
                return n;
            }
        }
        
        // Step 2: Find path to any safe unvisited cell
        let queue = [[this.agentPos]];
        let visited = new Set([this.coordToString(this.agentPos.row, this.agentPos.col)]);

        while (queue.length > 0) {
            let path = queue.shift();
            let current = path[path.length - 1];

            let neighbors = this.getNeighbors(current.row, current.col);
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                
                if (visited.has(coord)) continue;
                visited.add(coord);

                let newPath = [...path, n];

                // Found safe unvisited target!
                if (this.safe.has(coord) && !this.visited.has(coord)) {
                    this.addLog(`→ Navigating to (${n.row},${n.col}) via path`, "info");
                    return newPath[1]; // Return first step
                }

                // Only traverse visited cells
                if (this.visited.has(coord)) {
                    queue.push(newPath);
                }
            }
        }

        return null;
    }

    canProveSafe(row, col) {
        let coord = this.coordToString(row, col);
        
        // Already proven safe
        if (this.safe.has(coord)) return true;
        
        // Already confirmed dangerous
        if (this.confirmedPits.has(coord) || this.confirmedWumpus.has(coord)) {
            return false;
        }
        
        // Try to prove using logic
        let noPit = this.logic.ask(`!P_${row}_${col}`);
        let noWumpus = this.logic.ask(`!W_${row}_${col}`);
        
        if (noPit && noWumpus) {
            this.safe.add(coord);
            this.addLog(`✅ Proved (${row},${col}) is safe (${this.logic.inferenceSteps} steps)`, "success");
            return true;
        }
        
        // Check if we can prove it's dangerous
        let hasPit = this.logic.ask(`P_${row}_${col}`);
        if (hasPit && !this.confirmedPits.has(coord)) {
            this.confirmedPits.add(coord);
            this.possiblePits.delete(coord);
            this.addLog(`🕳️ Proved pit at (${row},${col})`, "error");
        }
        
        let hasWumpus = this.logic.ask(`W_${row}_${col}`);
        if (hasWumpus && !this.confirmedWumpus.has(coord)) {
            this.confirmedWumpus.add(coord);
            this.possibleWumpus.delete(coord);
            this.addLog(`👹 Proved wumpus at (${row},${col})`, "error");
        }
        
        return false;
    }

    moveAgent(row, col) {
        this.agentPos = { row, col };
        this.visited.add(this.coordToString(row, col));
        this.safe.add(this.coordToString(row, col));
        
        let coord = this.coordToString(row, col);
        this.possiblePits.delete(coord);
        this.possibleWumpus.delete(coord);
        
        this.addLog(`🤖 Moved to (${row},${col})`, "info");
        
        this.updatePercepts();
        this.addKnowledgeForCell(row, col);
        
        this.updateMetrics();
        this.renderGrid();
    }

    stuckAgent() {
        this.gameOver = true;
        this.addLog(`⛔ STUCK! No safe moves.`, "error");
        this.addLog(`📊 Moves: ${this.moveCount} | Explored: ${this.visited.size}/${this.rows * this.cols}`, "info");
        
        if (!this.hasGold) {
            this.showStatus(`💔 Game Over - Stuck! Explored ${this.visited.size}/${this.rows * this.cols} cells`, "warning");
        } else {
            this.showStatus(`😢 Game Over - Stuck with gold!`, "warning");
        }
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
    }

    winGame() {
        this.gameOver = true;
        this.addLog(`🎉 VICTORY! Returned with gold!`, "success");
        this.addLog(`📊 Moves: ${this.moveCount} | Explored: ${this.visited.size}/${this.rows * this.cols}`, "success");
        
        let efficiency = ((this.visited.size / (this.rows * this.cols)) * 100).toFixed(1);
        this.showStatus(`🏆 COMPLETE! Gold in ${this.moveCount} moves (${efficiency}% explored)`, "success");
        
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        this.celebrateWin();
    }

    celebrateWin() {
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
        if (this.hasGold && this.agentPos.row === 0 && this.agentPos.col === 0) goldStatus = "🎉 Secured!";
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
                container.appendChild(this.createCellElement(r, c));
            }
        }
    }

    createCellElement(row, col) {
        let div = document.createElement('div');
        div.className = 'cell';
        
        let coord = this.coordToString(row, col);
        let cellData = this.grid[row][col];
        
        // Coordinate
        let coordLabel = document.createElement('div');
        coordLabel.className = 'cell-coord';
        coordLabel.textContent = `${row},${col}`;
        div.appendChild(coordLabel);
        
        // Debug mode
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
        
        // Cell status
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
        
        // Percepts
        if (this.visited.has(coord)) {
            let perceptDiv = document.createElement('div');
            perceptDiv.className = 'percept-icons';
            if (cellData.hasBreeze) perceptDiv.textContent += '💨 ';
            if (cellData.hasStench) perceptDiv.textContent += '💀 ';
            if (cellData.hasGlitter && !this.hasGold) perceptDiv.textContent += '✨';
            if (perceptDiv.textContent) div.appendChild(perceptDiv);
        }
        
        // Agent
        if (row === this.agentPos.row && col === this.agentPos.col) {
            div.classList.add('agent');
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
        if (type === 'info') {
            setTimeout(() => banner.classList.add('hidden'), 5000);
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
        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    clearLog() {
        document.getElementById('logContent').innerHTML = '';
        this.addLog("Log cleared", "info");
    }

    reset() {
        if (this.autoRunInterval) clearInterval(this.autoRunInterval);
        
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
        
        document.getElementById('gridContainer').innerHTML = `
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
        
        this.addLog("🔄 System reset - Ready!", "info");
    }
}

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

let world = new WumpusWorld();
