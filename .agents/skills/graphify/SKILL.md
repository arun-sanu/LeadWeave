---
name: graphify
description: Parse and map the LeadWeave codebase into an AST knowledge graph. Use for any architecture question, module dependency lookup, call-path tracing, or impact analysis before touching code.
---

# Graphify Skill — LeadWeave Fork

## When to invoke this skill

- Before any broad `grep`/`find` scan of the src/ tree
- When asked "how does X work", "what calls Y", "what modules depend on Z"
- Before refactoring a service or controller
- After code changes: run `graphify update .` to keep the graph current (free, AST-only, no API key)

## Quick Commands

```bash
# Query the graph (BFS traversal — most useful)
graphify query "<question>"

# Trace a relationship between two concepts
graphify path "SessionService" "WebhookService"

# Deep-dive a single node
graphify explain "SessionEngineLifecycleService"

# Top architectural hubs
graphify god-nodes --top 10

# Update graph after code edits (no LLM needed)
graphify update .

# Serve interactive graph UI (runs on port 4000 by default if started)
python -m graphify.serve graphify-out/graph.json --port 4000
```

## LeadWeave Graph Stats (current)

- **13,955 nodes · 30,339 edges · 708 communities**
- Key god-nodes: `ApiResponse`, `RequireRole`, `WhatsAppWebJsAdapter`
- Graph: `graphify-out/graph.json`
- Report: `graphify-out/GRAPH_REPORT.md`
- HTML viewer: `graphify-out/graph.html`

## Anti-Ban Rule Reminder

When tracing any message-send or webhook path, verify that rate-limiting, randomized delay, and HMAC verification are present in the call chain per `.agents/rules/GEMINI.md`.

## Keeping the Graph Fresh

Git hooks are installed — `graphify update .` runs automatically on every `git commit` and `git checkout`. No manual action needed after commits.
