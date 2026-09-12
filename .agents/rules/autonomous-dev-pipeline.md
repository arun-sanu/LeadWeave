---
trigger: always_on
description: Universal Autonomous Development Pipeline with Everything Claude Code (ECC) integration. Automatically executes Graphifyy, jcode, ECC agents, domain skills, and assigned workflows on every prompt.
---

# Universal Autonomous Development Pipeline (ECC Integrated)

On **each and every development prompt**, the agent must automatically execute this 5-stage orchestration pipeline without requiring explicit user instructions, flags, or `@` mentions:

---

## 1. Macro Architecture Discovery (Graphifyy)

- **First Step:** Query the knowledge graph via `graphifyy` MCP or CLI:
  ```bash
  graphify query "<module_or_feature>"
  ```
- Map module dependencies, service boundaries, and upstream/downstream relationships.
- Trace shortest paths with `graphify path "<Source>" "<Target>"` when cross-module changes are required.
- Do NOT perform brute-force directory traversals or full-codebase greps when the dependency graph already maps relationships.

---

## 2. Micro AST & Symbol Retrieval (jcode)

- **Surgical Inspection:** Use `jcode` AST tools to retrieve exact target symbols:
  - `jcode_get_outline`: Extract high-level declarations and exact line numbers of a file.
  - `jcode_get_symbol`: Pull specific class, method, function, or interface AST chunks and exact line ranges.
  - `jcode_find_call_sites`: Find exact call sites across the codebase before altering signatures.
- NEVER load entire large file buffers into context when targeted AST chunks can be retrieved.

---

## 3. ECC Skill & Tool Routing Matrix (Everything Claude Code)

Adhere to the ECC conventions (`everything-claude-code` skill). Cross-reference `.agents/skills/` and immediately activate matching domain skills based on task context:

| Context                  | Auto-Activated Skills                                                                       | Enforcement Focus                                                |
| :----------------------- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------- |
| **NestJS / Backend**     | `nestjs-best-practices`, `backend-patterns`, `api-design`                                   | Modules, Controllers, Services, DTOs with `class-validator`      |
| **WhatsApp / Messaging** | `whatsapp-api-protocols`, `owasp-security-audit`, `webhook-testing`                         | Anti-ban delays (2-5s), HMAC verification, rate limits           |
| **Dashboard / React UI** | `react-best-practices`, `emil-design-eng`, `no-ai-design-slop`, `design-first-ui-prompting` | Spring physics animations, zero generic AI slop, premium styling |
| **State / Redis**        | `validate_redis_key_schemas`                                                                | Namespace standards, explicit TTL bindings                       |
| **Testing**              | `testing-best-practices`, `tdd-workflow`                                                    | Jest / Supertest unit & E2E tests, 80%+ coverage                 |
| **General Dev**          | `everything-claude-code`, `ecc-guide`                                                       | Conventional commits, structured planning, ECC hook rules        |

---

## 4. ECC Agent Persona & Workflow Assignment

Map the incoming request to its canonical ECC workflow and persona from `.agents/workflows/` and `.agents/agents/`:

| Task Type                  | Assigned Workflow                     | Lead Agent Persona                            | Execution Standard                                         |
| :------------------------- | :------------------------------------ | :-------------------------------------------- | :--------------------------------------------------------- |
| **New Feature Request**    | `/orch-add-feature` or `/feature-dev` | `@planner` + `@architect`                     | PRD/Architecture plan → TDD scaffolding → implementation   |
| **Bug / Issue Resolution** | `/orch-fix-defect`                    | `@silent-failure-hunter` + `@tdd-guide`       | Write failing regression test first → fix to green         |
| **Code Refactoring**       | `/orch-refine-code`                   | `@code-simplifier` + `@refactor-cleaner`      | Behavior-preserving AST refactor; confirm tests stay green |
| **Code Review / Audit**    | `/code-review`                        | `@code-reviewer` + `@sec-remediator`          | Audit against security, typing, and WhatsApp anti-ban      |
| **Build & Type Errors**    | `/build-fix`                          | `@build-error-resolver`                       | Minimal, non-breaking type and compile fixes               |
| **Performance / Caching**  | `/test-coverage` or custom loop       | `@performance-optimizer` + `@cache-architect` | Memory leak checks, Redis caching, query optimization      |

---

## 5. Surgical Execution, ECC Hooks & Synchronization

1. **Targeted Diffs:** Apply edits strictly to the exact line ranges identified by `jcode`.
2. **Verification & Hooks:** Run unit/integration tests and type checks (`npm test`, `npm run lint`). Adhere to any ECC hooks or Plankton formatting requirements triggered by file changes.
3. **Graph Synchronization:** After modifying code, run:
   ```bash
   graphify update .
   ```
   to keep the macro AST knowledge graph in sync.
