/* ============================================================
   LOGIC.JS — Propositional Logic KB + Resolution Refutation
   ============================================================
   
   Representation:
     A literal is:  { name: "P_1_2", neg: false }   (positive)
                    { name: "P_1_2", neg: true  }   (negative)
   
   A clause is an array of literals  (disjunction).
   The KB is an array of clauses     (conjunction of disjunctions = CNF).
   
   Workflow:
     1. TELL(sentence) — convert a propositional sentence to CNF clauses
        and add them to the KB.
     2. ASK(literal)   — use Resolution Refutation:
        To prove α, add ¬α to KB and try to derive the empty clause.
   ============================================================ */

"use strict";

/* ── Literal helpers ── */
function makeLit(name, neg = false) { return { name, neg }; }
function negLit(lit)                { return { name: lit.name, neg: !lit.neg }; }
function litStr(lit)                { return (lit.neg ? "¬" : "") + lit.name; }
function litsEqual(a, b)            { return a.name === b.name && a.neg === b.neg; }

/* ── Clause helpers ── */
function clauseStr(clause) {
  if (clause.length === 0) return "□ (empty)";
  return "(" + clause.map(litStr).join(" ∨ ") + ")";
}

function clausesEqual(c1, c2) {
  if (c1.length !== c2.length) return false;
  const s1 = [...c1].sort((a,b)=>litStr(a).localeCompare(litStr(b)));
  const s2 = [...c2].sort((a,b)=>litStr(a).localeCompare(litStr(b)));
  return s1.every((l,i) => litsEqual(l, s2[i]));
}

/* Remove duplicate literals inside a single clause */
function dedupeClause(clause) {
  const seen = new Set();
  return clause.filter(lit => {
    const key = litStr(lit);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* A clause is a tautology if it contains both L and ¬L */
function isTautology(clause) {
  for (const lit of clause) {
    if (clause.some(l => l.name === lit.name && l.neg !== lit.neg)) return true;
  }
  return false;
}

/* ── CNF Conversion ──
   We support a simple sentence format (used internally by TELL):
   Sentences are JS objects:
     { type: "atom",    name: "P_1_2" }
     { type: "neg",     arg: <sent> }
     { type: "and",     args: [<sent>, ...] }
     { type: "or",      args: [<sent>, ...] }
     { type: "implies", left: <sent>, right: <sent> }
     { type: "biconditional", left: <sent>, right: <sent> }
*/
function atom(name)        { return { type: "atom", name }; }
function neg(arg)          { return { type: "neg", arg }; }
function and(...args)      { return { type: "and", args }; }
function or(...args)       { return { type: "or",  args }; }
function implies(l, r)     { return { type: "implies", left: l, right: r }; }
function biconditional(l,r){ return { type: "biconditional", left: l, right: r }; }

/* Step 1: Eliminate biconditionals → implications */
function elimBiconditional(s) {
  if (s.type === "atom") return s;
  if (s.type === "biconditional") {
    const l = elimBiconditional(s.left);
    const r = elimBiconditional(s.right);
    return and(implies(l, r), implies(r, l));
  }
  if (s.type === "implies") return { type:"implies", left: elimBiconditional(s.left), right: elimBiconditional(s.right) };
  if (s.type === "neg")     return { type:"neg", arg: elimBiconditional(s.arg) };
  if (s.type === "and")     return { type:"and", args: s.args.map(elimBiconditional) };
  if (s.type === "or")      return { type:"or",  args: s.args.map(elimBiconditional) };
  return s;
}

/* Step 2: Eliminate implications: A→B becomes ¬A∨B */
function elimImplication(s) {
  if (s.type === "atom") return s;
  if (s.type === "implies") {
    return or(neg(elimImplication(s.left)), elimImplication(s.right));
  }
  if (s.type === "neg")  return { type:"neg", arg: elimImplication(s.arg) };
  if (s.type === "and")  return { type:"and", args: s.args.map(elimImplication) };
  if (s.type === "or")   return { type:"or",  args: s.args.map(elimImplication) };
  return s;
}

/* Step 3: Move negations inward (De Morgan, double-neg) */
function moveNegInward(s) {
  if (s.type === "atom") return s;
  if (s.type === "neg") {
    const a = s.arg;
    if (a.type === "atom") return s;                               // ¬P stays
    if (a.type === "neg")  return moveNegInward(a.arg);           // ¬¬A → A
    if (a.type === "and")  return moveNegInward(or(...a.args.map(x=>neg(x)))); // De Morgan
    if (a.type === "or")   return moveNegInward(and(...a.args.map(x=>neg(x)))); // De Morgan
  }
  if (s.type === "and") return { type:"and", args: s.args.map(moveNegInward) };
  if (s.type === "or")  return { type:"or",  args: s.args.map(moveNegInward) };
  return s;
}

/* Step 4: Distribute OR over AND: (A ∧ B) ∨ C → (A∨C) ∧ (B∨C) */
function distribute(s) {
  if (s.type === "atom" || s.type === "neg") return s;
  if (s.type === "and") return { type:"and", args: s.args.map(distribute) };
  if (s.type === "or") {
    // flatten ORs first
    const flat = flattenOr(s).map(distribute);
    // find any AND among them
    const andIdx = flat.findIndex(x => x.type === "and");
    if (andIdx === -1) return { type:"or", args: flat };
    const andNode = flat[andIdx];
    const rest    = flat.filter((_,i) => i !== andIdx);
    // distribute: (A∧B) ∨ rest → (A∨rest) ∧ (B∨rest)
    return distribute({
      type: "and",
      args: andNode.args.map(a => ({ type:"or", args: [a, ...rest] }))
    });
  }
  return s;
}

function flattenOr(s) {
  if (s.type !== "or") return [s];
  return s.args.flatMap(flattenOr);
}
function flattenAnd(s) {
  if (s.type !== "and") return [s];
  return s.args.flatMap(flattenAnd);
}

/* Extract clauses (arrays of literals) from CNF sentence tree */
function extractClauses(s) {
  const cnfSentence = distribute(moveNegInward(elimImplication(elimBiconditional(s))));
  const andArgs = flattenAnd(cnfSentence);
  const clauses = andArgs.map(clause => {
    const orArgs = flattenOr(clause);
    return orArgs.map(lit => {
      if (lit.type === "atom") return makeLit(lit.name, false);
      if (lit.type === "neg" && lit.arg.type === "atom") return makeLit(lit.arg.name, true);
      console.warn("Unexpected literal form", lit);
      return null;
    }).filter(Boolean);
  });
  return clauses
    .map(dedupeClause)
    .filter(c => !isTautology(c));
}

/* ============================================================
   KNOWLEDGE BASE CLASS
   ============================================================ */
class KnowledgeBase {
  constructor() {
    this.clauses        = [];   // CNF clauses
    this.inferenceSteps = 0;
    this.log            = [];   // resolution log entries
  }

  reset() {
    this.clauses        = [];
    this.inferenceSteps = 0;
    this.log            = [];
  }

  /* TELL: add a sentence to the KB */
  tell(sentence) {
    const newClauses = extractClauses(sentence);
    let added = 0;
    for (const c of newClauses) {
      if (!this.hasClause(c)) {
        this.clauses.push(c);
        added++;
      }
    }
    return added;
  }

  /* Convenience: tell a raw CNF clause (array of literals) */
  tellClause(clause) {
    const c = dedupeClause(clause);
    if (!isTautology(c) && !this.hasClause(c)) {
      this.clauses.push(c);
      return true;
    }
    return false;
  }

  hasClause(clause) {
    return this.clauses.some(c => clausesEqual(c, clause));
  }

  /* ── Resolution Refutation ──
     To prove α (a single positive/negative literal):
       1. Add ¬α as a unit clause to a working set.
       2. Repeatedly resolve pairs of clauses.
       3. If the empty clause □ is derived → α is proved (return true).
       4. If no new clauses can be derived     → α cannot be proved (return false).
     Returns: { proved: bool, steps: number, logLines: string[] }
  */
  ask(literal) {
    const logLines   = [];
    const negAlpha   = negLit(literal);
    const hypothesis = [negAlpha];   // ¬α unit clause

    logLines.push(`ASK: Prove ${litStr(literal)}`);
    logLines.push(`Assume ${litStr(negAlpha)} (refutation)`);

    // Working set = KB clauses + hypothesis
    const working = [...this.clauses.map(c=>[...c]), hypothesis];
    let steps = 0;
    const MAX_STEPS = 800;

    while (steps < MAX_STEPS) {
      const newClauses = [];

      for (let i = 0; i < working.length; i++) {
        for (let j = i + 1; j < working.length; j++) {
          const resolvents = this._resolve(working[i], working[j]);
          steps++;

          for (const r of resolvents) {
            // Empty clause found → contradiction → literal proved
            if (r.length === 0) {
              logLines.push(`✔ Empty clause derived in ${steps} steps → ${litStr(literal)} proved`);
              this.inferenceSteps += steps;
              return { proved: true, steps, logLines };
            }
            // Only add non-tautological, non-duplicate clauses
            if (!isTautology(r) &&
                !working.some(c => clausesEqual(c, r)) &&
                !newClauses.some(c => clausesEqual(c, r))) {
              newClauses.push(r);
              logLines.push(`  Resolve → ${clauseStr(r)}`);
            }
          }
        }
      }

      if (newClauses.length === 0) {
        logLines.push(`✘ No new clauses; ${litStr(literal)} cannot be proved`);
        this.inferenceSteps += steps;
        return { proved: false, steps, logLines };
      }
      working.push(...newClauses);
    }

    logLines.push(`✘ Step limit reached (${MAX_STEPS})`);
    this.inferenceSteps += steps;
    return { proved: false, steps, logLines };
  }

  /* Resolve two clauses on their complementary literals.
     Returns array of resolvents (may be empty array). */
  _resolve(c1, c2) {
    const resolvents = [];
    for (const lit1 of c1) {
      for (const lit2 of c2) {
        if (lit1.name === lit2.name && lit1.neg !== lit2.neg) {
          // Found complementary pair → resolve
          const resolvent = [
            ...c1.filter(l => !litsEqual(l, lit1)),
            ...c2.filter(l => !litsEqual(l, lit2))
          ];
          const deduped = dedupeClause(resolvent);
          resolvents.push(deduped);
        }
      }
    }
    return resolvents;
  }

  /* Ask if a cell is definitely SAFE:  prove ¬P_r_c ∧ ¬W_r_c */
  askSafe(row, col) {
    const pitLit    = makeLit(`P_${row}_${col}`, false);  // P_r_c (pit present)
    const wumpusLit = makeLit(`W_${row}_${col}`, false);  // W_r_c (wumpus present)

    const noPit    = this.ask(negLit(pitLit));     // prove ¬P_r_c
    const noWumpus = this.ask(negLit(wumpusLit));  // prove ¬W_r_c

    const proved = noPit.proved && noWumpus.proved;
    const steps  = noPit.steps + noWumpus.steps;
    const logLines = [
      `--- Safe check (${row},${col}) ---`,
      ...noPit.logLines,
      ...noWumpus.logLines,
      proved
        ? `✅ Cell (${row},${col}) PROVEN SAFE`
        : `⚠️ Cell (${row},${col}) not proven safe`
    ];
    return { proved, steps, logLines };
  }

  /* Convenience getters */
  getClauseCount()     { return this.clauses.length; }
  getInferenceSteps()  { return this.inferenceSteps; }
  getClauses()         { return this.clauses; }
}
