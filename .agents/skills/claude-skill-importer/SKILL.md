---
name: claude-skill-importer
description: Import or adapt community skills from awesome-claude-skills repositories into Antigravity workspace skills. Use when the user wants to bring in a Claude skill from GitHub or a community repo.
---
# Claude Skill Importer — LeadWeave Workspace

Adapts community Claude skills (from `awesome-claude-skills`, GitHub, etc.) into the Antigravity `.agents/skills/` format used by this workspace.

## When to invoke this skill
- User wants to add a new skill from a community repo
- User pastes a Claude `CLAUDE.md` skill and wants it converted to `.agents/skills/<name>/SKILL.md`
- User wants to check what skills are currently active in the workspace

## Currently Active Skills

| Skill | Path | Purpose |
|-------|------|---------|
| `graphify` | `.agents/skills/graphify/SKILL.md` | Codebase AST graph queries |
| `soup` | `.agents/skills/soup/SKILL.md` | LLM fine-tuning pipeline |
| `claude-skill-importer` | `.agents/skills/claude-skill-importer/SKILL.md` | This skill — import more skills |
| `nestjs-best-practices` | `.agents/skills/nestjs-best-practices/SKILL.md` | OpenWA NestJS backend architecture rules |
| `systematic-debugging` | `.agents/skills/systematic-debugging/SKILL.md` | Strict debugging framework and OpenWA bounds |
| `emil-design-eng` | `.agents/skills/emil-design-eng/SKILL.md` | UI polish, animations, and component logic |
| `no-ai-design-slop` | `.agents/skills/no-ai-design-slop/SKILL.md` | Prevents generic AI UI generation |
| `design-first-ui-prompting` | `.agents/skills/design-first-ui-prompting/SKILL.md` | Spec-driven, constraint-based UI outputs |

## Import Procedure

1. Locate the source skill (GitHub URL or paste content)
2. Create the directory: `mkdir -p .agents/skills/<skill-name>/`
3. Write `.agents/skills/<skill-name>/SKILL.md` with:

```yaml
---
name: <skill-name>
description: <one-line description for the agent to match on>
---
# <Skill Title>

<Adapted instructions here>
```

4. If the skill has helper scripts, place them in `.agents/skills/<skill-name>/scripts/`
5. Test by mentioning the skill name in a prompt

## Adaptation Rules
- Convert any `ANTHROPIC_API_KEY` references to `GEMINI_API_KEY` (this workspace uses Antigravity/Gemini)
- Replace `claude` CLI calls with equivalent `agy` / Antigravity commands where applicable
- Remove Claude-Code-specific `--allowedTools` blocks; Antigravity handles tool permissions differently
- Keep the `name` and `description` frontmatter — these are how the agent discovers skills
