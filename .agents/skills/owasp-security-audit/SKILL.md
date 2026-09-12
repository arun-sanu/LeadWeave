---
name: owasp-security-audit
description: Security guidelines and auditing rules based on OWASP Top 10. Use when building APIs, Auth flows, or interacting with the database.
---

# OWASP Security Audit Rules

When writing authentication guards, database queries, or handling user input in OpenWA, strictly enforce the following security baselines:

## 1. Broken Access Control & Auth

- **Always Verify Ownership:** Never assume a user has the right to access a resource just because they have a valid session. Always verify that the resource (e.g., a WhatsApp log, a webhook config) belongs to the authenticated user's tenant/organization.
- **Fail Securely:** Authentication guards (like `api-key.guard.ts`) must default to denying access on error or ambiguity.

## 2. Injection Prevention (SQL / NoSQL / Command)

- **Parameterization:** If writing raw SQL or interacting with query builders, never concatenate user input directly. Always use parameterized queries.
- **Input Validation:** Use `class-validator` strictly on all NestJS DTOs. Strip unknown properties (`whitelist: true` in ValidationPipe) to prevent mass assignment vulnerabilities.

## 3. Data Exposure & Secrets

- **No Secrets in Logs:** Never `console.log` or log error objects that might contain JWTs, API keys, database connection strings, or full user objects.
- **DTO Scrubbing:** Ensure API responses only return exactly what the frontend needs. Strip out password hashes, internal IDs, or sensitive tokens from entity objects before returning them.

## 4. Cross-Site Scripting (XSS)

- **React Escaping:** React escapes HTML by default. NEVER use `dangerouslySetInnerHTML` unless rendering explicitly sanitized Markdown/HTML (e.g., using DOMPurify).
