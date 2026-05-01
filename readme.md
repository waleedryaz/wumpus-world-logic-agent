# 🎯 Wumpus World - Knowledge-Based Logic Agent

A web-based implementation of the classic Wumpus World problem using Propositional Logic and Resolution Refutation for automated reasoning.

## 🔗 Live Demo
**Live URL:** https://wumpus-world-logic-agent.vercel.app/

---

## 📋 Features

- ✅ **Dynamic Grid Configuration** (3x3 to 8x8)
- ✅ **Random Hazard Generation** (Pits & Wumpus)
- ✅ **Propositional Logic Knowledge Base**
- ✅ **Resolution Refutation Engine** (Automated theorem proving)
- ✅ **Real-time Metrics Dashboard**
- ✅ **Interactive Visualization**
- ✅ **Step-by-step or Auto-run modes**

---

## 🧠 How It Works

 Knowledge Representation
The agent maintains a Knowledge Base (KB) in Conjunctive Normal Form (CNF). When it perceives:
- **Breeze** → At least one adjacent cell has a Pit
- **Stench** → At least one adjacent cell has the Wumpus
