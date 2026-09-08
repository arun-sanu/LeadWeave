/**
 * Per-request async context, propagated to every log line and audit record produced while handling a
 * request. Today it carries the X-Request-ID plus the resolved API key and client IP, so audit log
 * rows are stamped with who made the call and from where WITHOUT every controller having to thread
 * `@CurrentApiKey()` + `req.ip` into each `auditService.log*()` call (most call sites legitimately
 * don't know the key — they fire from deep inside services). Backed by a dedicated AsyncLocalStorage
 * instance — independent of the existing plugin/hook ALS instances (multiple ALS instances coexist fine).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  /** The API key that authenticated this request, if any (@Public routes have none). */
  apiKeyId?: string;
  apiKeyName?: string;
  /** Allowed sessions for session-scoped API keys (null/undefined = unrestricted). */
  allowedSessions?: string[] | null;
  /** The Supabase user that authenticated this request, if any. */
  userId?: string;
  userEmail?: string;
  userRole?: string;
  companyId?: string;
  /** The real client IP (ProxyAwareThrottlerGuard's notion, honoring TRUSTED_PROXIES). */
  ipAddress?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export interface RequestActor {
  apiKeyId?: string;
  apiKeyName?: string;
  allowedSessions?: string[] | null;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  companyId?: string;
  ipAddress?: string;
}

/** Run `fn` (and every async continuation it starts) with `requestId` as the active context. */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestContextStorage.run({ requestId }, fn);
}

/** The active request id, or `undefined` when not running inside a request scope. */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

/**
 * Stamp the resolved API key / Supabase user + client IP into the active request context so downstream audit log
 * writes (which typically happen inside services without DI access to the key/user) can attribute the
 * action. No-op outside a request scope (e.g. worker/cron), so callers don't need to guard. The
 * guard/middleware call this once they've resolved the key or token; services never need to.
 */
export function setRequestActor(actor: RequestActor): void {
  const store = requestContextStorage.getStore();
  if (!store) return; // not in a request scope — nothing to stamp
  if (actor.apiKeyId !== undefined) store.apiKeyId = actor.apiKeyId;
  if (actor.apiKeyName !== undefined) store.apiKeyName = actor.apiKeyName;
  if (actor.allowedSessions !== undefined) store.allowedSessions = actor.allowedSessions;
  if (actor.userId !== undefined) store.userId = actor.userId;
  if (actor.userEmail !== undefined) store.userEmail = actor.userEmail;
  if (actor.userRole !== undefined) store.userRole = actor.userRole;
  if (actor.companyId !== undefined) store.companyId = actor.companyId;
  if (actor.ipAddress !== undefined) store.ipAddress = actor.ipAddress;
}

/** The active request's resolved actor (API key / user + IP), or `undefined` outside a request scope. */
export function getRequestActor(): RequestActor | undefined {
  const store = requestContextStorage.getStore();
  if (!store) return undefined;
  return {
    apiKeyId: store.apiKeyId,
    apiKeyName: store.apiKeyName,
    allowedSessions: store.allowedSessions,
    userId: store.userId,
    userEmail: store.userEmail,
    userRole: store.userRole,
    companyId: store.companyId,
    ipAddress: store.ipAddress,
  };
}

/** Get the active session scope from ALS context (null = unrestricted, string[] = restricted to IDs). */
export function getActiveSessionScope(): string[] | null | undefined {
  return requestContextStorage.getStore()?.allowedSessions;
}

/** Get the active tenant / company scope from ALS context. */
export function getActiveTenantScope(): string | undefined {
  return requestContextStorage.getStore()?.companyId;
}
