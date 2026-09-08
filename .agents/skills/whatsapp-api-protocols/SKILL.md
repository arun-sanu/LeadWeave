---
name: whatsapp-api-protocols
description: Strict guidelines for interacting with WhatsApp messaging infrastructure. Use whenever writing webhook handlers, message senders, or AI auto-responders in OpenWA.
---

# WhatsApp Anti-Ban & API Protocols

When writing or modifying code that interacts with WhatsApp (sending messages, parsing webhooks, or managing sessions), adhere strictly to these protocols to prevent account bans and ensure reliability.

## 1. Rate Limiting & Delays (Crucial)
- **Never send messages in a tight loop.** If processing a batch or queue, enforce randomized, human-mimicking delays between each outgoing message.
- **Delay Logic:** Implement a 2 to 5-second asynchronous wait (e.g., `await new Promise(res => setTimeout(res, Math.random() * 3000 + 2000))`) before dispatching AI auto-responses or bulk messages.

## 2. Webhook Security
- **HMAC Verification:** All incoming webhook payloads from WhatsApp/Meta MUST be verified using HMAC-SHA256 signatures before parsing. Do not process unverified payloads.
- **Immediate ACK:** Always return a `200 OK` immediately upon receiving a webhook to prevent WhatsApp from retrying. Offload the actual processing of the message (database writes, AI generation) to a background queue or asynchronous handler.

## 3. Payload Structure & Error Handling
- **Idempotency:** Webhooks can be delivered more than once. Always check your database to see if a message ID (`msg_id`) has already been processed before taking action.
- **Graceful Failures:** If sending a message fails due to rate limits (e.g., HTTP 429), implement an exponential backoff retry mechanism. Never crash the main service loop.
- **Session Management:** If using Baileys or WWebJS, ensure sessions are saved securely and connection drops trigger an automatic, delayed reconnect rather than an immediate spin-loop.
