---
name: webhook-testing
description: Use this skill for testing real-time webhooks locally. It provides instructions on how to use tunneling tools to test payload signatures (HMAC) and filters.
---
# Webhook Testing — LeadWeave

## When to invoke this skill
- When adding new webhook events
- When debugging webhook dispatch logic or HMAC signature issues
- When testing smart webhook filters locally

## Setup & Testing Procedure
1. **Start the Tunnel**: Run a local tunnel to expose the local dev server. For example:
   ```bash
   ngrok http 2785
   ```
2. **Register the Webhook**: Use the LeadWeave API to register your new webhook endpoint (the ngrok URL).
   ```bash
   curl -X POST http://localhost:2785/api/sessions/{sessionId}/webhooks \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_API_KEY" \
     -d '{
       "url": "https://<your-ngrok-id>.ngrok.io/webhook",
       "events": ["message.received", "session.status"],
       "secret": "test-secret"
     }'
   ```
3. **Trigger Events**: Interact with the WhatsApp session (e.g., send a message) to trigger the webhook.
4. **Inspect Payloads**: Use the ngrok web inspector (usually `http://127.0.0.1:4040`) to inspect the raw headers (including the HMAC signature in `X-LeadWeave-Signature`) and body of the webhook payload sent by LeadWeave.
