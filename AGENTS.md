# LeadWeave Agent Operating System & Execution Contract

## Mandatory Execution Contract: Autonomous Multi-Tier Pipeline

On **every single prompt and development task**, the agent must automatically orchestrate:

1. **Graphifyy (Macro Layer):** Map module boundaries, dependency topologies, and affected paths (`graphify query`).
2. **jcode (Micro Layer):** Use AST parsing (`jcode_get_symbol`, `jcode_get_outline`, `jcode_find_call_sites`) to retrieve exact symbol definitions and line ranges without loading full files into context.
3. **Automatic Skill & Tool Selection:** Automatically cross-reference and invoke domain-specific skills (`nestjs-best-practices`, `react-best-practices`, `whatsapp-api-protocols`, `emil-design-eng`, `owasp-security-audit`, etc.) without waiting for user mentions.
4. **Automatic Agent & Workflow Assignment:** Automatically adopt the relevant ECC workflow (`/orch-add-feature`, `/orch-fix-defect`, `/orch-refine-code`, `/code-review`, `/tdd-workflow`) and agent role (`@planner`, `@tdd-guide`, `@code-reviewer`, `@sec-remediator`).
5. **Surgical Diffing & Sync:** Apply edits only to line ranges identified by `jcode`, verify with tests, and synchronize the knowledge graph with `graphify update .`.

See detailed rule definitions in:

- [.agents/rules/autonomous-dev-pipeline.md](.agents/rules/autonomous-dev-pipeline.md)
- [.agents/rules/code-retrieval.md](.agents/rules/code-retrieval.md)
- [.agents/rules/git-upload-exclusion-rules.md](.agents/rules/git-upload-exclusion-rules.md)
- [.agents/rules/GEMINI.md](.agents/rules/GEMINI.md)
