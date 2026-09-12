## 0. Mandatory Execution Contract: Autonomous Multi-Tier Pipeline

On **every single prompt and development task**, the agent must automatically orchestrate:

1. **Graphifyy (Macro Layer):** Map module boundaries, dependency topologies, and affected paths (`graphify query`).
2. **jcode (Micro Layer):** Use AST parsing (`jcode_get_symbol`, `jcode_get_outline`, `jcode_find_call_sites`) to retrieve exact symbol definitions and line ranges without loading full files.
3. **Automatic Skill & Tool Selection:** Automatically cross-reference and invoke domain-specific skills (`nestjs-best-practices`, `react-best-practices`, `whatsapp-api-protocols`, `emil-design-eng`, etc.) without waiting for user mentions.
4. **Automatic Agent & Workflow Assignment:** Automatically adopt the relevant ECC workflow (`/orch-add-feature`, `/orch-fix-defect`, `/orch-refine-code`, `/code-review`, `/tdd-workflow`) and agent role (`@planner`, `@tdd-guide`, `@code-reviewer`, `@sec-remediator`).
5. **Surgical Diffing & Sync:** Apply edits only to line ranges identified by `jcode`, verify with tests, and synchronize the knowledge graph with `graphify update .`.

## 1. Architecture & Tech Stack

- **Framework:** NestJS 11 design patterns (Module, Controller, Service, DTOs with `class-validator`).
- **Codebase Indexing:** Before doing broad multi-file scans, always check `graphify-out/graph.json` or `GRAPH_REPORT.md` to map NestJS module dependencies with minimal token overhead.

## 2. WhatsApp Anti-Ban Protocols

- All automated messaging endpoints, webhooks, or AI auto-responders MUST implement:
  - Strict rate-limiting per session.
  - Randomized queues and human-mimicking delay logic (e.g., 2–5 second delays between messages).
  - Webhook HMAC signature verification.

## 3. Tool Routing Strategy

- **Codebase Intelligence (Macro & Micro):**
  - **Macro Layer (Graphifyy):** Use `graphifyy` (or `graphify query "<question>"`) first to map module boundaries, dependency paths, and architectural relationships without reading raw directory structures or running full grep scans.
  - **Micro Layer (jcode):** Use `jcode` AST tools to retrieve specific symbol definitions, type signatures, interfaces, and call graphs. Never read entire files into context when targeted AST chunks can be retrieved.
  - **Surgical Diffing:** Apply targeted edits based on exact line ranges identified by `jcode`. Keep the macro graph current with `graphify update .`.
- **Task Automation:** Check .agents/workflows/ for relevant workflow triggers before writing boilerplate.
- **Universal Skill Routing:** Actively cross-reference the >100 available skills in `.agents/skills/` for any task. Automatically invoke domain-specific skills (e.g., Three.js, animations, specific UI components, Supabase, debugging) whenever their context applies to the current user request, without waiting for explicit `@` mentions.
- **Agent & ECC Integration:** Automatically consult and invoke specialized agents (e.g., `@sec-remediator`, `@cache-architect`, and the 68+ ECC agents in `.agents/agents/`) and ECC workflows (e.g., `tdd-workflow`, `code-review`) based on the task context. Use these as your default methodology for planning, refactoring, security audits, and testing without requiring explicit user prompts.
- **Model Fine-Tuning & Local AI:** Route dataset formatting, LoRA training, and GGUF exports through `soup`.

## 4. UI & Frontend Design System

- **Design Enforcement:** ALWAYS prioritize `emil-design-eng`, `no-ai-design-slop`, and `design-first-ui-prompting` skills when touching dashboard UI or frontend components. Do NOT accept generic UI layouts or AI default styling. Wait for specific viewport sizing, typography overrides, and exact color palettes. Ensure all animations and CSS transitions adhere to the Emil Kowalski spring-physics and easing rules.

## 5. Git Upload & Security Exclusion Rules

- **Mandatory Exclusions:** Never commit `.env` (contains live Supabase credentials, JWT secrets, DB connections, WhatsApp tokens), `node_modules/`, `.venv/`, `dist/`, `.wwebjs_auth/`, `.wwebjs_cache/`, `data/`, `uploads/`, test screenshots (`dashboard/browser_test*.png`), or one-off local diagnostic scripts to Git/GitHub. Refer to [.agents/rules/git-upload-exclusion-rules.md](.agents/rules/git-upload-exclusion-rules.md) for details.
