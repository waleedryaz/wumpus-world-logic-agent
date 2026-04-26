// script.js - Main Wumpus World Application (IMPROVED VERSION)

class WumpusWorld {
    constructor() {
        this.rows = 4;
        this.cols = 4;
        this.grid = [];
        this.agentPos = { row: 0, col: 0 };
        this.visited = new Set();
        this.safe = new Set();
        this.pits = new Set();
        this.wumpusPos = null;
        this.percepts = { breeze: false, stench: false };
        this.logic = new LogicEngine();
        this.isRunning = false;
        this.autoRunInterval = null;
        
        // Track confirmed and possible dangers
        this.confirmedPits = new Set();
        this.confirmedWumpus = new Set();
        this.possiblePits = new Set();
        this.possibleWumpus = new Set();
        
        this.initializeEventListeners();
        this.addLog("Welcome to Wumpus World! Configure grid and click Initialize.", "info");
    }

    initializeEventListeners() {
        document.getElementById('initBtn').addEventListener('click', () => this.initialize());
        document.getElementById('stepBtn').addEventListener('click', () => this.step());
        document.getElementById('autoBtn').addEventListener('click', () => this.toggleAutoRun());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }

    initialize() {
        this.rows = parseInt(document.getElementById('rows').value);
        this.cols = parseInt(document.getElementById('cols').value);
        
        if (this.rows < 3 || this.rows > 8 || this.cols < 3 || this.cols > 8) {
            alert("Grid size must be between 3x3 and 8x8");
            return;
        }

        // Reset everything
        this.grid = [];
        this.agentPos = { row: 0, col: 0 };
        this.visited = new Set();
        this.safe = new Set();
        this.pits = new Set();
        this.wumpusPos = null;
        this.logic.reset();
        this.isRunning = false;
        this.confirmedPits = new Set();
        this.confirmedWumpus = new Set();
        this.possiblePits = new Set();
        this.possibleWumpus = new Set();
        
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
        
        this.addLog(`Grid initialized: ${this.rows}x${this.cols}`, "success");
        this.addLog(`Agent starts at (0, 0)`, "info");
    }

    generateHazards() {
        let wumpusPlaced = false;
        while (!wumpusPlaced) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            if (r !== 0 || c !== 0) {
                this.wumpusPos = { row: r, col: c };
                wumpusPlaced = true;
            }
        }

        let numPits = Math.floor(this.rows * this.cols * 0.2);
        numPits = Math.max(2, Math.min(numPits, this.rows * this.cols - 2));
        
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

        this.addLog(`Wumpus placed - Location Hidden`, "warning");
        this.addLog(`${numPits} pits placed - Locations Hidden`, "warning");
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
                    hasPit: this.pits.has(this.coordToString(r, c)),
                    hasWumpus: (r === this.wumpusPos.row && c === this.wumpusPos.col)
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
        let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
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
            
            // Mark neighbors as possibly dangerous
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                if (!this.visited.has(coord)) {
                    this.possiblePits.add(coord);
                }
            }
            
            this.addLog(`💨 Breeze at (${row}, ${col}) => Pit nearby`, "info");
        } else {
            for (let n of neighbors) {
                this.logic.tell([`!P_${n.row}_${n.col}`]);
                let coord = this.coordToString(n.row, n.col);
                this.possiblePits.delete(coord);
            }
            this.addLog(`No Breeze at (${row}, ${col}) => Neighbors safe from pits`, "info");
        }

        if (cell.hasStench) {
            let stenchVar = `S_${row}_${col}`;
            let wumpusVars = neighbors.map(n => `W_${n.row}_${n.col}`);
            this.logic.tellBiconditional(stenchVar, wumpusVars);
            this.logic.tell([stenchVar]);
            
            // Mark neighbors as possibly dangerous
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                if (!this.visited.has(coord)) {
                    this.possibleWumpus.add(coord);
                }
            }
            
            this.addLog(`💀 Stench at (${row}, ${col}) => Wumpus nearby`, "info");
        } else {
            for (let n of neighbors) {
                this.logic.tell([`!W_${n.row}_${n.col}`]);
                let coord = this.coordToString(n.row, n.col);
                this.possibleWumpus.delete(coord);
            }
            this.addLog(`No Stench at (${row}, ${col}) => Neighbors safe from wumpus`, "info");
        }

        this.logic.tell([`!P_${row}_${col}`]);
        this.logic.tell([`!W_${row}_${col}`]);
    }

    step() {
        if (this.isRunning) return;

        let nextMove = this.findNextSafeMove();
        
        if (nextMove) {
            this.moveAgent(nextMove.row, nextMove.col);
        } else {
            this.addLog("⚠️ No more safe moves! Agent is stuck or exploration complete.", "warning");
            this.addLog(`Safe cells: ${this.safe.size}, Visited: ${this.visited.size}, Total: ${this.rows * this.cols}`, "info");
            
            // Show why agent is stuck
            let unvisited = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    let coord = this.coordToString(r, c);
                    if (!this.visited.has(coord)) {
                        unvisited.push(`(${r},${c})`);
                    }
                }
            }
            if (unvisited.length > 0) {
                this.addLog(`⛔ Unvisited cells (might be dangerous): ${unvisited.join(', ')}`, "warning");
            }
            
            document.getElementById('stepBtn').disabled = true;
            document.getElementById('autoBtn').disabled = true;
        }
    }

    findNextSafeMove() {
        // First, check immediate neighbors
        let neighbors = this.getNeighbors(this.agentPos.row, this.agentPos.col);
        
        for (let n of neighbors) {
            let coord = this.coordToString(n.row, n.col);
            
            if (this.visited.has(coord)) continue;
            
            if (this.isSafe(n.row, n.col)) {
                return n;
            }
        }
        
        // If no immediate safe neighbor, use BFS to find path through safe cells
        return this.findSafeUnvisitedCell();
    }

    isSafe(row, col) {
        let noPit = this.logic.ask(`!P_${row}_${col}`);
        let noWumpus = this.logic.ask(`!W_${row}_${col}`);
        
        if (noPit && noWumpus) {
            this.safe.add(this.coordToString(row, col));
            this.addLog(`✅ Proved (${row}, ${col}) is SAFE (${this.logic.inferenceSteps} inference steps)`, "success");
            return true;
        }
        
        this.addLog(`❓ Cannot prove (${row}, ${col}) is safe (might be dangerous)`, "warning");
        return false;
    }

    checkConfirmedPit(row, col) {
        let hasPit = this.logic.ask(`P_${row}_${col}`);
        
        if (hasPit) {
            let coord = this.coordToString(row, col);
            if (!this.confirmedPits.has(coord)) {
                this.confirmedPits.add(coord);
                this.possiblePits.delete(coord);
                this.addLog(`🕳️ CONFIRMED PIT at (${row}, ${col}) via resolution!`, "error");
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
                this.addLog(`👹 CONFIRMED WUMPUS at (${row}, ${col}) via resolution!`, "error");
            }
            return true;
        }
        return false;
    }

    checkForConfirmedDangers() {
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

    findSafeUnvisitedCell() {
        let queue = [this.agentPos];
        let visited = new Set([this.coordToString(this.agentPos.row, this.agentPos.col)]);
        let parent = new Map();
        
        while (queue.length > 0) {
            let current = queue.shift();
            let neighbors = this.getNeighbors(current.row, current.col);
            
            for (let n of neighbors) {
                let coord = this.coordToString(n.row, n.col);
                
                if (visited.has(coord)) continue;
                visited.add(coord);
                parent.set(coord, current);
                
                if (this.safe.has(coord) && !this.visited.has(coord)) {
                    let path = [n];
                    let p = n;
                    while (parent.has(this.coordToString(p.row, p.col))) {
                        p = parent.get(this.coordToString(p.row, p.col));
                        path.unshift(p);
                    }
                    return path[1] || n;
                }
                
                if (this.visited.has(coord)) {
                    queue.push(n);
                }
            }
        }
        
        return null;
    }

    moveAgent(row, col) {
        this.agentPos = { row, col };
        this.visited.add(this.coordToString(row, col));
        this.safe.add(this.coordToString(row, col));
        
        // Remove from possible dangers
        let coord = this.coordToString(row, col);
        this.possiblePits.delete(coord);
        this.possibleWumpus.delete(coord);
        
        this.addLog(`🤖 Agent moved to (${row}, ${col})`, "success");
        
        this.updatePercepts();
        this.addKnowledgeForCell(row, col);
        this.checkForConfirmedDangers();
        
        this.updateMetrics();
        this.renderGrid();
    }

    toggleAutoRun() {
        if (this.isRunning) {
            clearInterval(this.autoRunInterval);
            this.isRunning = false;
            document.getElementById('autoBtn').textContent = 'Auto Run';
            document.getElementById('stepBtn').disabled = false;
        } else {
            this.isRunning = true;
            document.getElementById('autoBtn').textContent = 'Stop';
            document.getElementById('stepBtn').disabled = true;
            
            this.autoRunInterval = setInterval(() => {
                this.step();
                
                if (document.getElementById('stepBtn').disabled) {
                    this.toggleAutoRun();
                }
            }, 1200);
        }
    }

    updateMetrics() {
        document.getElementById('inferenceSteps').textContent = this.logic.inferenceSteps;
        
        let perceptText = [];
        if (this.percepts.breeze) perceptText.push("💨 Breeze");
        if (this.percepts.stench) perceptText.push("💀 Stench");
        document.getElementById('percepts').textContent = perceptText.length > 0 ? perceptText.join(", ") : "None";
        
        document.getElementById('agentPos').textContent = `(${this.agentPos.row}, ${this.agentPos.col})`;
        document.getElementById('safeCells').textContent = this.safe.size;
        document.getElementById('confirmedPits').textContent = this.confirmedPits.size;
        document.getElementById('confirmedWumpus').textContent = this.confirmedWumpus.size;
        
        let kbText = this.logic.getRecentClauses(15);
        document.getElementById('kbContent').textContent = kbText || "No clauses yet";
    }

    renderGrid() {
        let container = document.getElementById('gridContainer');
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.cols}, 80px)`;
        container.style.gridTemplateRows = `repeat(${this.rows}, 80px)`;
        
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
        
        // Determine cell status and styling
        if (this.confirmedPits.has(coord)) {
            div.classList.add('pit');
            let pitIcon = document.createElement('div');
            pitIcon.style.fontSize = '40px';
            pitIcon.textContent = '🕳️';
            div.appendChild(pitIcon);
        } else if (this.confirmedWumpus.has(coord)) {
            div.classList.add('wumpus');
            let wumpusIcon = document.createElement('div');
            wumpusIcon.style.fontSize = '40px';
            wumpusIcon.textContent = '👹';
            div.appendChild(wumpusIcon);
        } else if (this.visited.has(coord)) {
            div.classList.add('safe');
        } else if (this.safe.has(coord)) {
            div.classList.add('safe');
            div.style.opacity = '0.7';
        } else if (this.possiblePits.has(coord) || this.possibleWumpus.has(coord)) {
            // Show possible dangers with warning color
            div.classList.add('unknown');
            div.style.background = 'linear-gradient(135deg, #fbd38d 0%, #f6ad55 100%)';
            div.style.borderColor = '#ed8936';
            
            let warningIcon = document.createElement('div');
            warningIcon.style.fontSize = '24px';
            warningIcon.textContent = '⚠️';
            div.appendChild(warningIcon);
        } else {
            div.classList.add('unknown');
        }
        
        // Show percepts if visited
        if (this.visited.has(coord)) {
            let perceptDiv = document.createElement('div');
            perceptDiv.className = 'percept-icons';
            if (cellData.hasBreeze) perceptDiv.textContent += '💨';
            if (cellData.hasStench) perceptDiv.textContent += '💀';
            if (perceptDiv.textContent) div.appendChild(perceptDiv);
        }
        
        // Show agent
        if (row === this.agentPos.row && col === this.agentPos.col) {
            div.classList.add('agent');
        }
        
        return div;
    }

    coordToString(row, col) {
        return `${row},${col}`;
    }

    addLog(message, type = "info") {
        let logContent = document.getElementById('logContent');
        let entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        let timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    reset() {
        if (this.autoRunInterval) {
            clearInterval(this.autoRunInterval);
        }
        
        this.rows = 4;
        this.cols = 4;
        this.grid = [];
        this.agentPos = { row: 0, col: 0 };
        this.visited = new Set();
        this.safe = new Set();
        this.pits = new Set();
        this.wumpusPos = null;
        this.logic.reset();
        this.isRunning = false;
        this.confirmedPits = new Set();
        this.confirmedWumpus = new Set();
        this.possiblePits = new Set();
        this.possibleWumpus = new Set();
        
        document.getElementById('gridContainer').innerHTML = '<p style="text-align:center;color:#999;">Initialize grid to start</p>';
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        document.getElementById('autoBtn').textContent = 'Auto Run';
        
        document.getElementById('inferenceSteps').textContent = '0';
        document.getElementById('percepts').textContent = 'None';
        document.getElementById('agentPos').textContent = '(0, 0)';
        document.getElementById('safeCells').textContent = '0';
        document.getElementById('confirmedPits').textContent = '0';
        document.getElementById('confirmedWumpus').textContent = '0';
        document.getElementById('kbContent').textContent = 'Waiting for initialization...';
        document.getElementById('logContent').innerHTML = '';
        
        this.addLog("System reset. Configure and initialize grid.", "info");
    }
}

// Initialize the application
let world = new WumpusWorld();
