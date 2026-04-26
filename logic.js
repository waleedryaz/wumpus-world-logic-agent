// logic.js - Propositional Logic and Resolution Engine

class LogicEngine {
    constructor() {
        this.kb = []; // Knowledge Base in CNF
        this.inferenceSteps = 0;
    }

    // Reset the knowledge base
    reset() {
        this.kb = [];
        this.inferenceSteps = 0;
    }

    // Add a clause to KB (already in CNF form)
    tell(clause) {
        // clause is an array of literals, e.g., ["P_1_2", "P_2_1", "!B_1_1"]
        if (clause.length > 0) {
            this.kb.push([...clause]);
        }
    }

    // Convert bi-conditional to CNF and add to KB
    // Example: B_1_1 <=> (P_0_1 OR P_1_0 OR P_2_1 OR P_1_2)
    tellBiconditional(left, rightDisjuncts) {
        // left => right (as clauses)
        // If left is true, at least one of right must be true
        // !left OR right[0] OR right[1] OR ...
        let clause1 = ["!" + left, ...rightDisjuncts];
        this.tell(clause1);

        // right => left (for each literal in right)
        // If any right literal is true, left must be true
        // For each rightLiteral: !rightLiteral OR left
        for (let rightLit of rightDisjuncts) {
            let clause2 = ["!" + rightLit, left];
            this.tell(clause2);
        }
    }

    // Ask if a literal can be proven true using resolution
    ask(query) {
        // To prove query, we try to prove NOT query leads to contradiction
        // Add negation of query to KB temporarily
        let negatedQuery = this.negate(query);
        let tempKB = [...this.kb.map(c => [...c]), [negatedQuery]];
        
        this.inferenceSteps = 0;
        let result = this.resolution(tempKB);
        
        return result; // true if contradiction found (query is proven)
    }

    // Resolution algorithm
    resolution(clauses) {
        let newClauses = [];
        let maxSteps = 1000; // Prevent infinite loops
        
        while (this.inferenceSteps < maxSteps) {
            let pairs = this.getAllPairs(clauses);
            
            for (let [ci, cj] of pairs) {
                this.inferenceSteps++;
                
                let resolvents = this.resolve(clauses[ci], clauses[cj]);
                
                for (let resolvent of resolvents) {
                    // Empty clause means contradiction found
                    if (resolvent.length === 0) {
                        return true; // Proven
                    }
                    
                    // Check if resolvent is new
                    if (!this.containsClause(clauses, resolvent) && 
                        !this.containsClause(newClauses, resolvent)) {
                        newClauses.push(resolvent);
                    }
                }
            }
            
            // If no new clauses, we can't prove it
            if (newClauses.length === 0) {
                return false;
            }
            
            // Add new clauses to our set
            clauses = [...clauses, ...newClauses];
            newClauses = [];
        }
        
        return false; // Couldn't prove within step limit
    }

    // Resolve two clauses
    resolve(ci, cj) {
        let resolvents = [];
        
        for (let li of ci) {
            for (let lj of cj) {
                // Check if literals are complementary
                if (this.areComplementary(li, lj)) {
                    // Create resolvent by combining clauses without these literals
                    let resolvent = [
                        ...ci.filter(l => l !== li),
                        ...cj.filter(l => l !== lj)
                    ];
                    
                    // Remove duplicates
                    resolvent = [...new Set(resolvent)];
                    
                    // Simplify (remove tautologies)
                    if (!this.isTautology(resolvent)) {
                        resolvents.push(resolvent);
                    }
                }
            }
        }
        
        return resolvents;
    }

    // Check if two literals are complementary (p and !p)
    areComplementary(l1, l2) {
        return (l1 === "!" + l2) || (l2 === "!" + l1);
    }

    // Check if clause is a tautology (contains both p and !p)
    isTautology(clause) {
        for (let lit of clause) {
            if (clause.includes(this.negate(lit))) {
                return true;
            }
        }
        return false;
    }

    // Negate a literal
    negate(literal) {
        if (literal.startsWith("!")) {
            return literal.substring(1);
        } else {
            return "!" + literal;
        }
    }

    // Get all pairs of clause indices
    getAllPairs(clauses) {
        let pairs = [];
        for (let i = 0; i < clauses.length; i++) {
            for (let j = i + 1; j < clauses.length; j++) {
                pairs.push([i, j]);
            }
        }
        return pairs;
    }

    // Check if a clause already exists in clause set
    containsClause(clauseSet, clause) {
        let sortedClause = [...clause].sort().join(",");
        for (let c of clauseSet) {
            let sortedC = [...c].sort().join(",");
            if (sortedC === sortedClause) {
                return true;
            }
        }
        return false;
    }

    // Get recent KB clauses for display
    getRecentClauses(count = 10) {
        let recent = this.kb.slice(-count);
        return recent.map(clause => {
            return clause.join(" ∨ ");
        }).join("\n");
    }

    // Get KB size
    getKBSize() {
        return this.kb.length;
    }
}