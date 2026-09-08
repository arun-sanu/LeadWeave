---
name: audit_client_storage_leaks
description: Scans frontend source files for insecure usage of localStorage/sessionStorage containing sensitive auth tokens, keys, or privilege flags.
parameters:
  target_directory: "frontend/src"
  prohibited_keys:
    - "leadweave_api_key"
    - "leadweave_supabase_token"
    - "leadweave_user_role"
    - "sb-*-auth-token"
rules:
  - flag_direct_storage_writes: true
  - recommend_http_only_migration: true
---

# Automated Storage & Token Leak Audit

Scans frontend source files for insecure usage of localStorage/sessionStorage containing sensitive auth tokens, keys, or privilege flags.
