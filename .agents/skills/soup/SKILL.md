---
name: soup
description: Fine-tune, audit datasets, and export local LLMs for LeadWeave auto-responders using the Soup CLI. Use when building or iterating on a WhatsApp AI auto-responder model.
---

# Soup Skill — LeadWeave Fine-Tuning

Soup CLI (`v0.71.3+`) handles the full fine-tuning pipeline: dataset formatting → LoRA training → GGUF export → local inference. Route all LLM fine-tuning tasks here.

## When to invoke this skill

- Creating a WhatsApp auto-responder model from chat history
- Auditing / cleaning a training dataset
- Training a LoRA adapter from `soup.yaml`
- Exporting a model to GGUF for on-device inference
- Chatting with a fine-tuned model locally

## Quick Commands

```bash
# Create a new training config interactively
soup init

# Estimate cloud training cost before running
soup cost

# Start training from soup.yaml
soup train

# Chat with your fine-tuned model locally
soup chat

# Show all options
soup --help
```

## LeadWeave Integration Pattern

1. Export WhatsApp chat logs from `./data/sessions/<session-id>/`
2. Clean and format with `soup init` (choose WhatsApp chat template)
3. Train: `soup train` (uses `soup.yaml` in project root)
4. Export GGUF to `./models/` for use in the LeadWeave automation module

## Anti-Ban Rule Reminder

Any model-driven auto-responder plugged into LeadWeave MUST:

- Use the queue module (`src/modules/queue/`) with rate-limiting
- Add 2–5 second randomized delays between replies (`send-pacing.service.ts`)
- Never send bulk messages without going through the BullMQ queue
