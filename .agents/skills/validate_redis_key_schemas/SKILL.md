---
name: validate_redis_key_schemas
description: Inspects backend Redis service layers and cache decorators to ensure all cache keys follow standardized namespacing and have explicit TTL bindings.
parameters:
  target_file: 'src/common/cache/cache.service.ts'
  required_prefix_pattern: '^{env}:{namespace}:{entity}:'
  max_ttl_seconds: 86400
  enforce_dynamic_keys: true
---

# Redis Key Schema Enforcer

Inspects backend Redis service layers and cache decorators to ensure all cache keys follow standardized namespacing and have explicit TTL bindings.
