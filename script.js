// script.js - Main Wumpus World Application

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
        
        // Validate
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
        
        // Mark starting position as safe and visited
        this.safe.add(this.coordToString(0, 0));
        this.visited.add(this.coordToString(0, 0));

        // Generate hazards
        this.generateHazards();
        
        // Create grid
        this.createGrid();
        
        // Get initial percepts
        this.updatePercepts();
        
        // Add initial knowledge
        this.addInitialKnowledge();
        
        // Update UI
        this.updateMetrics();
        this.renderGrid();
        
        // Enable buttons
        document.getElementById('stepBtn').disabled = false;
        document.getElementById('autoBtn').disabled = false;
        
        this.addLog(`Grid initialized: ${this.rows}x${this.cols}`, "success");
        this.addLog(`Agent starts at (0, 0)`, "info");
    }

    generateHazards() {
        // Place Wumpus (not at starting position)
        let wumpusPlaced = false;
        while (!wumpusPlaced) {
            let r = Math.floor(Math.random() * this.rows);
            let c = Math.floor(Math.random() * this.cols);
            if (r !== 0 || c !== 0) {
                this.wumpusPos = { row: r, col: c };
                wumpusPlaced = true;
            }
        }

        // Place Pits (20% of cells, not at starting position or wumpus)
        let numPits = Math.floor(this.rows * this.cols * 0.15);
        numPits = Math.max(1, Math.min(numPits, this.rows * this.cols - 2));
        
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

        this.addLog(`Wumpus at (${this.wumpusPos.row}, ${this.wumpusPos.col}) - Hidden`, "warning");
        this.addLog(`${numPits} pits placed - Hidden`, "warning");
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
        // Add knowledge about current position
        this.addKnowledgeForCell(this.agentPos.row, this.agentPos.col);
    }

    addKnowledgeForCell(row, col) {
        let cell = this.grid[row][col];
        let neighbors = this.getNeighbors(row, col);
        
        // If breeze, then at least one neighbor has pit
        if (cell.hasBreeze) {
            let breezeVar = `B_${row}_${col}`;
            let pitVars = neighbors.map(n => `P_${n.row}_${n.col}`);
            this.logic.tellBiconditional(breezeVar, pitVars);
            this.logic.tell([breezeVar]); // We perceive breeze
            
            this.addLog(`Breeze at (${row}, ${col}) => Pit in neighbors`, "info");
        } else {
            // No breeze means no pits in neighbors
            for (let n of neighbors) {
                this.logic.tell([`!P_${n.row}_${n.col}`]);
            }
            this.addLog(`No Breeze at (${row}, ${col}) => Neighbors are safe from pits`, "info");
        }

        // If stench, then wumpus in one of neighbors
        if (cell.hasStench) {
            let stenchVar = `S_${row}_${col}`;
            let wumpusVars = neighbors.map(n => `W_${n.row}_${n.col}`);
            this.logic.tellBiconditional(stenchVar, wumpusVars);
            this.logic.tell([stenchVar]); // We perceive stench
            
            this.addLog(`Stench at (${row}, ${col}) => Wumpus in neighbors`, "info");
        } else {
            // No stench means no wumpus in neighbors
            for (let n of neighbors) {
                this.logic.tell([`!W_${n.row}_${n.col}`]);
            }
            this.addLog(`No Stench at (${row}, ${col}) => Neighbors are safe from wumpus`, "info");
        }

        // Current cell is safe (no pit, no wumpus)
        this.logic.tell([`!P_${row}_${col}`]);
        this.logic.tell([`!W_${row}_${col}`]);
    }

    step() {
        if (this.isRunning) return;

        // Find next safe unvisited cell
        let nextMove = this.findNextSafeMove();
        
        if (nextMove) {
            this.moveAgent(nextMove.row, nextMove.col);
        } else {
            this.addLog("No more safe moves found! Exploration complete or stuck.", "warning");
            document.getElementById('stepBtn').disabled = true;
            document.getElementById('autoBtn').disabled = true;
        }
    }

    findNextSafeMove() {
        let neighbors = this.getNeighbors(this.agentPos.row, this.agentPos.col);
        
        for (let n of neighbors) {
            let coord = this.coordToString(n.row, n.col);
            
            // Skip if already visited
            if (this.visited.has(coord)) continue;
            
            // Check if we can prove it's safe
            if (this.isSafe(n.row, n.col)) {
                return n;
            }
        }
        
        // If no safe neighbor, try BFS to find safe unvisited cell
        return this.findSafeUnvisitedCell();
    }

    isSafe(row, col) {
        // Query KB: can we prove NOT Pit AND NOT Wumpus?
        let noPit = this.logic.ask(`!P_${row}_${col}`);
        let noWumpus = this.logic.ask(`!W_${row}_${col}`);
        
        if (noPit && noWumpus) {
            this.safe.add(this.coordToString(row, col));
            this.addLog(`Proved (${row}, ${col}) is SAFE via resolution (${this.logic.inferenceSteps} steps)`, "success");
            return true;
        }
        
        return false;
    }

    findSafeUnvisitedCell() {
        // BFS to find path to any safe unvisited cell
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
                
                // If this neighbor is safe and unvisited, return first step
                if (this.safe.has(coord) && !this.visited.has(coord)) {
                    // Backtrack to find first step
                    let path = [n];
                    let p = n;
                    while (parent.has(this.coordToString(p.row, p.col))) {
                        p = parent.get(this.coordToString(p.row, p.col));
                        path.unshift(p);
                    }
                    // Return first step (neighbor of current position)
                    return path[1] || n;
                }
                
                // Only continue through visited safe cells
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
        
        this.addLog(`Agent moved to (${row}, ${col})`, "success");
        
        // Update percepts
        this.updatePercepts();
        
        // Add knowledge from new position
        this.addKnowledgeForCell(row, col);
        
        // Update UI
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
                
                // Stop if no more moves
                if (document.getElementById('stepBtn').disabled) {
                    this.toggleAutoRun();
                }
            }, 1000);
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
        
        // Update KB display
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
        
        // Add coordinate label
        let coordLabel = document.createElement('div');
        coordLabel.className = 'cell-coord';
        coordLabel.textContent = `${row},${col}`;
        div.appendChild(coordLabel);
        
        // Determine cell status
        if (this.visited.has(coord)) {
            div.classList.add('safe');
        } else if (this.safe.has(coord)) {
            div.classList.add('safe');
        } else {
            div.classList.add('unknown');
        }
        
        // Show actual hazards only if visited (for debugging, remove in production)
        // For full hidden version, comment out these lines:
        /*
        if (cellData.hasPit && this.visited.has(coord)) {
            div.classList.add('pit');
            div.textContent += '🕳️';
        }
        if (cellData.hasWumpus && this.visited.has(coord)) {
            div.classList.add('wumpus');
            div.textContent += '👹';
        }
        */
        
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
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
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
        
        document.getElementById('gridContainer').innerHTML = '<p style="text-align:center;color:#999;">Initialize grid to start</p>';
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('autoBtn').disabled = true;
        document.getElementById('autoBtn').textContent = 'Auto Run';
        
        document.getElementById('inferenceSteps').textContent = '0';
        document.getElementById('percepts').textContent = 'None';
        document.getElementById('agentPos').textContent = '(0, 0)';
        document.getElementById('safeCells').textContent = '0';
        document.getElementById('kbContent').textContent = 'Waiting for initialization...';
        document.getElementById('logContent').innerHTML = '';
        
        this.addLog("System reset. Configure and initialize grid.", "info");
    }
}

// Initialize the application
let world = new WumpusWorld();