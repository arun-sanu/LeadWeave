---
trigger: always_on
description: Protocols for macro-level architecture mapping (Graphifyy) and micro-level AST retrieval (jcode).
---

# Code Exploration & Retrieval Protocols

### 1. Architectural & Cross-Module Queries (Macro Layer)
- Consult `graphifyy` (or `graphify query "<query>"`) first to trace module boundaries, dependency paths, and architectural relationships.
- Do NOT perform raw directory scans or full codebase greps when the dependency graph already maps relationships.
- Refer to `graphify-out/graph.json` or `graphify-out/wiki/index.md` before touching code.

### 2. Symbol & Implementation Queries (Micro Layer)
- Once the target module or file is isolated, use `jcode` (or AST query tools) to retrieve specific symbol definitions, type signatures, interfaces, and call graphs.
- NEVER read entire large files into context if `jcode` can retrieve the targeted function or class AST chunk.

### 3. Surgical Code Modification
- Propose and apply targeted diffs restricted to the exact line ranges identified by `jcode`.
- After modifying code files, keep the macro layer in sync by running `graphify update .`.
