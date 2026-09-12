# Git Upload & Exclusion Security Rules

## Mandatory Exclusion Rule: Do NOT Upload Secrets & Excluded Files

Never commit sensitive credentials, environments, dependencies, build outputs, session storage, or local test artifacts to Git/GitHub.

### 🔴 Files to Keep Out (Exclude from Git)

1. **Secret Configuration Files:**
   - `.env`, `.env.local`, `.env.production.local` (Contains live Supabase credentials, JWT secrets, database connection strings, and WhatsApp tokens).
2. **Dependencies & Virtual Environments:**
   - `node_modules/` and `dashboard/node_modules/`
   - `.venv/` (Python virtual environments)
3. **Build Artifacts & Compiled Code:**
   - `dist/` (NestJS build output)
   - `dashboard/dist/` or `dashboard/build/`
4. **WhatsApp Session Data & Storage:**
   - `.wwebjs_auth/` and `.wwebjs_cache/`
   - `data/` and `uploads/`
5. **Test Screenshots & Local Temp Files:**
   - Screenshots like `dashboard/browser_test*.png`
   - One-off diagnostic scripts created locally (e.g. `test-login-now.js`, `deep-audit-all-routes.js`, `inspect-auth-users.js`) unless explicitly accepted as permanent project utility scripts.
