// logic.js - Propositional Logic and Resolution Engine

class LogicEngine {
    constructor() {
        this.kb = []; // Knowledge Base in CNF
        this.inferenceSteps = 0;
    }

    reset() {
        this.kb = [];
        this.inferenceSteps = 0;
    }

    tell(clause) {
        if (clause.length > 0) {
            this.kb.push([...clause]);
        }
    }

    tellBiconditional(left, rightDisjuncts) {
        let clause1 = ["!" + left, ...rightDisjuncts];
        this.tell(clause1);

        for (let rightLit of rightDisjuncts) {
            let clause2 = ["!" + rightLit, left];
            this.tell(clause2);
        }
    }

    ask(query) {
        let negatedQuery = this.negate(query);
        let tempKB = [...this.kb.map(c => [...c]), [negatedQuery]];
        
        this.inferenceSteps = 0;
        let result = this.resolution(tempKB);
        
        return result;
    }

    resolution(clauses) {
        let newClauses = [];
        let maxSteps = 1000;
        
        while (this.inferenceSteps < maxSteps) {
            let pairs = this.getAllPairs(clauses);
            
            for (let [ci, cj] of pairs) {
                this.inferenceSteps++;
                
                let resolvents = this.resolve(clauses[ci], clauses[cj]);
                
                for (let resolvent of resolvents) {
                    if (resolvent.length === 0) {
                        return true;
                    }
                    
                    if (!this.containsClause(clauses, resolvent) && 
                        !this.containsClause(newClauses, resolvent)) {
                        newClauses.push(resolvent);
                    }
                }
            }
            
            if (newClauses.length === 0) {
                return false;
            }
            
            clauses = [...clauses, ...newClauses];
            newClauses = [];
        }
        
        return false;
    }

    resolve(ci, cj) {
        let resolvents = [];
        
        for (let li of ci) {
            for (let lj of cj) {
                if (this.areComplementary(li, lj)) {
                    let resolvent = [
                        ...ci.filter(l => l !== li),
                        ...cj.filter(l => l !== lj)
                    ];
                    
                    resolvent = [...new Set(resolvent)];
                    
                    if (!this.isTautology(resolvent)) {
                        resolvents.push(resolvent);
                    }
                }
            }
        }
        
        return resolvents;
    }

    areComplementary(l1, l2) {
        return (l1 === "!" + l2) || (l2 === "!" + l1);
    }

    isTautology(clause) {
        for (let lit of clause) {
            if (clause.includes(this.negate(lit))) {
                return true;
            }
        }
        return false;
    }

    negate(literal) {
        if (literal.startsWith("!")) {
            return literal.substring(1);
        } else {
            return "!" + literal;
        }
    }

    getAllPairs(clauses) {
        let pairs = [];
        for (let i = 0; i < clauses.length; i++) {
            for (let j = i + 1; j < clauses.length; j++) {
                pairs.push([i, j]);
            }
        }
        return pairs;
    }

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

    getRecentClauses(count = 10) {
        let recent = this.kb.slice(-count);
        return recent.map(clause => {
            return clause.join(" ∨ ");
        }).join("\n");
    }

    getKBSize() {
        return this.kb.length;
    }
}
