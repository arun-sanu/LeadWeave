/**
 * Resolve the effective session filter for a scoped read. The calling key's `allowedSessions` is
 * authoritative: a request-supplied `sessionId` may only narrow WITHIN that scope, never broaden it.
 * This is the shared fix for endpoints that accept `sessionId` as a query param, which the
 * ApiKeyGuard's route-param-only fence does not cover (see audit + webhook delivery-failures).
 *
 * Returns:
 *   - `null`     → no filter; the caller queries all sessions (unrestricted key, no narrowing)
 *   - `string[]` (non-empty) → filter `sessionId IN (...)` (the whole allowlist, or a single narrowed id)
 *   - `[]`       → the requested session is outside the key's scope; the caller must return nothing
 *
 * A null/empty `allowedSessions` means "unrestricted" (e.g. an ADMIN key), mirroring the guard model.
 */
export function resolveSessionScope(
  allowedSessions: string[] | null | undefined,
  requestedSessionId?: string,
): string[] | null {
  const scoped = allowedSessions != null && allowedSessions.length > 0;
  if (scoped) {
    return requestedSessionId ? allowedSessions.filter(s => s === requestedSessionId) : allowedSessions;
  }
  return requestedSessionId ? [requestedSessionId] : null;
}

/**
 * True when `sessionScope` — a resource's session binding, where null/undefined means "all
 * sessions" — falls inside the calling key's `allowedSessions`. An unrestricted key (no allowlist)
 * sees every scope; a scoped key only sees resources bound to one of its own sessions, so a null
 * scope (and the '*' wildcard) is never inside its fence. Use this on surfaces whose session
 * binding travels in the request body or in persisted rows, which the ApiKeyGuard's route-param
 * fence cannot reach (the same body/persisted-scope pattern the integration-instance controller
 * uses to confine a scoped key to instances bound inside its allowedSessions).
 */
export function sessionScopeVisible(
  allowedSessions: string[] | null | undefined,
  sessionScope: string | null | undefined,
): boolean {
  if (allowedSessions == null || allowedSessions.length === 0) return true;
  return sessionScope != null && sessionScope !== '*' && allowedSessions.includes(sessionScope);
}

/**
 * Apply session scoping to a TypeORM SelectQueryBuilder.
 * Uses explicitScope if provided, otherwise transparently reads active session scope from AsyncLocalStorage request context.
 *
 * If unrestricted (null/undefined), returns query builder unmodified.
 * If restricted with 0 allowed sessions, appends '1 = 0' to return an empty set securely.
 * If restricted with sessions, appends `sessionColumn IN (:...__allowedSessions)`.
 */
export function applySessionScopeToQuery<T>(
  qb: any,
  sessionColumn = 'sessionId',
  explicitScope?: string[] | null,
): any {
  const { getActiveSessionScope } = require('../services/request-context');
  const scope = explicitScope !== undefined ? explicitScope : getActiveSessionScope();
  if (scope === null || scope === undefined) {
    return qb;
  }
  if (scope.length === 0) {
    return qb.andWhere('1 = 0');
  }
  const colExpr = qb.alias ? `${qb.alias}.${sessionColumn}` : sessionColumn;
  return qb.andWhere(`${colExpr} IN (:...__allowedSessions)`, { __allowedSessions: scope });
}

/**
 * Apply tenant / company isolation scoping to a TypeORM SelectQueryBuilder.
 * Uses explicitCompanyId if provided, otherwise reads active tenant company ID from AsyncLocalStorage request context.
 *
 * If no companyId is present (e.g. system background jobs or non-tenant auth), returns qb unmodified.
 * If companyId is present, appends `${companyColumn} = :__companyId`.
 */
export function applyTenantScopeToQuery<T>(
  qb: any,
  companyColumn = 'companyId',
  explicitCompanyId?: string | null,
): any {
  const { getActiveTenantScope } = require('../services/request-context');
  const companyId = explicitCompanyId !== undefined ? explicitCompanyId : getActiveTenantScope();
  if (!companyId) {
    return qb;
  }
  const colExpr = qb.alias ? `${qb.alias}.${companyColumn}` : companyColumn;
  return qb.andWhere(`${colExpr} = :__companyId`, { __companyId: companyId });
}
