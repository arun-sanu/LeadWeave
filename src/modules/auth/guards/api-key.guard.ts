import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { SupabaseService } from '../supabase.service';
import { ApiKeyRole, ApiKey } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY, SESSION_SCOPED_KEY, UNSCOPED_KEY } from '../decorators/auth.decorators';
import { resolveClientIp } from '../../../common/utils/ip';
import { setRequestActor } from '../../../common/services/request-context';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly supabaseService?: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    try {
      return await this.authorize(request, context);
    } catch (err) {
      // Record rejected/denied authentication attempts so the audit log has a forensic trail for
      // credential probing. Fire-and-forget: audit logging is best-effort and must never turn a
      // 401/403 into a failure of the guard itself.
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        // Stamp at least the IP so the failed-auth audit row below is attributable even though the
        // key was never resolved. setRequestActor is a no-op outside a request scope.
        setRequestActor({ ipAddress: this.getClientIp(request) });
        void this.auditService.logWarn(AuditAction.API_KEY_AUTH_FAILED, {
          ipAddress: this.getClientIp(request),
          method: request.method,
          path: request.path,
          errorMessage: err.message,
        });
      }
      throw err;
    }
  }

  private async authorize(request: Request, context: ExecutionContext): Promise<boolean> {
    const clientIp = this.getClientIp(request);
    (request as Request & { clientIp?: string }).clientIp = clientIp;

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 1. Check for Bearer token if Supabase verification is configured (from Header or HttpOnly Cookie)
    const authHeader = request.headers['authorization'];
    const hasBearerHeader = authHeader?.startsWith('Bearer ');
    const isSupabaseCookie = !hasBearerHeader && !!request.cookies?.['leadweave_token'];
    const bearerToken = hasBearerHeader
      ? authHeader?.substring(7)
      : (request.cookies?.['leadweave_token'] as string | undefined);

    if (bearerToken && this.supabaseService?.isEnabled?.()) {
      this.validateCsrfIfCookieAuth(request, isSupabaseCookie);
      const supabaseUser = await this.supabaseService.verifyToken(bearerToken);
      if (supabaseUser) {
        const companyId = supabaseUser.companyId;
        const rawRole = (supabaseUser.role || 'user').toLowerCase();
        const isSuperAdmin = rawRole === 'superadmin' || rawRole === 'developer';
        const isCompanyAdmin = rawRole === 'companyadmin' || rawRole === 'admin';

        // Map Supabase user role to ApiKeyRole for role enforcement
        const mappedRole = this.mapSupabaseRoleToApiKeyRole(supabaseUser.role);
        const effectiveAllowedSessions = (isSuperAdmin || isCompanyAdmin)
          ? null
          : (supabaseUser.assignedSessions || []);

        setRequestActor({
          userId: supabaseUser.id,
          userEmail: supabaseUser.email,
          userRole: supabaseUser.role,
          companyId,
          allowedSessions: effectiveAllowedSessions,
          ipAddress: clientIp,
        });

        if (requiredRole && !this.hasRolePermission(mappedRole, requiredRole)) {
          throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
        }

        // Attach synthetic user / apiKey object to request for downstream controller handlers
        const syntheticApiKey: Partial<ApiKey> & { companyId?: string; userId?: string } = {
          id: `supabase:${supabaseUser.id}`,
          name: supabaseUser.email || `Supabase User (${supabaseUser.id})`,
          role: mappedRole,
          allowedSessions: effectiveAllowedSessions,
          allowedIps: [],
          companyId,
        };
        (request as Request & { apiKey: typeof syntheticApiKey; user?: typeof supabaseUser }).apiKey = syntheticApiKey as ApiKey;
        (request as Request & { user?: typeof supabaseUser }).user = supabaseUser;

        return true;
      }
    }

    // 2. Fallback to standard API Key authentication
    const { key: apiKeyHeader, isCookie: isApiKeyCookie } = this.extractApiKey(request);

    if (!apiKeyHeader) {
      throw new UnauthorizedException('API key is required');
    }

    this.validateCsrfIfCookieAuth(request, isApiKeyCookie);

    // Resolve the session id used for the key's allowedSessions scope.
    const sessionScoped = this.reflector.getAllAndOverride<boolean>(SESSION_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const sessionId = (request.params['sessionId'] || (sessionScoped ? request.params['id'] : undefined)) as
      string | undefined;

    // Validate API key
    const apiKey = await this.authService.validateApiKey(apiKeyHeader, clientIp, sessionId);

    setRequestActor({
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      allowedSessions: apiKey.allowedSessions,
      ipAddress: clientIp,
    });

    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    const requireUnscoped = this.reflector.getAllAndOverride<boolean>(UNSCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireUnscoped && (apiKey.allowedSessions?.length ?? 0) > 0) {
      throw new ForbiddenException('Session-scoped API keys are not permitted on this route');
    }

    // Attach API key to request for use in controllers
    (request as Request & { apiKey: typeof apiKey }).apiKey = apiKey;

    return true;
  }

  private validateCsrfIfCookieAuth(request: Request, isCookieAuth: boolean): void {
    if (!isCookieAuth) {
      return; // Direct programmatic API clients (X-API-Key / Authorization) are exempt from browser-ambient CSRF
    }

    const method = request.method?.toUpperCase();
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      return;
    }

    // 1. Enforce Sec-Fetch-Site protection if present
    const secFetchSite = request.headers['sec-fetch-site'];
    if (secFetchSite === 'cross-site') {
      throw new ForbiddenException('Cross-site mutation request rejected (CSRF protection)');
    }

    // 2. Validate Origin / Referer header if present
    const origin = request.headers['origin'] as string | undefined;
    const referer = request.headers['referer'] as string | undefined;
    const host = request.headers['host'];

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (host && originUrl.host !== host) {
          const corsOrigins = this.configService.get<string[]>('security.corsOrigins') ?? [];
          const isAllowedCors = corsOrigins.includes(origin) || corsOrigins.includes('*');
          if (!isAllowedCors && process.env.NODE_ENV === 'production') {
            throw new ForbiddenException('Invalid request origin (CSRF protection)');
          }
        }
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
        throw new ForbiddenException('Malformed request origin header');
      }
    } else if (referer && process.env.NODE_ENV === 'production') {
      try {
        const refererUrl = new URL(referer);
        if (host && refererUrl.host !== host) {
          const corsOrigins = this.configService.get<string[]>('security.corsOrigins') ?? [];
          const isAllowedCors = corsOrigins.some(c => referer.startsWith(c)) || corsOrigins.includes('*');
          if (!isAllowedCors) {
            throw new ForbiddenException('Invalid request referer (CSRF protection)');
          }
        }
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
      }
    }
  }

  private extractApiKey(request: Request): { key?: string; isCookie: boolean } {
    // Support X-API-Key header, Authorization Bearer, and HttpOnly cookies
    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) return { key: xApiKey, isCookie: false };

    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return { key: authHeader.substring(7), isCookie: false };
    }

    const cookieApiKey = request.cookies?.['leadweave_api_key'] as string | undefined;
    if (cookieApiKey) return { key: cookieApiKey, isCookie: true };

    const cookieToken = request.cookies?.['leadweave_token'] as string | undefined;
    if (cookieToken) return { key: cookieToken, isCookie: true };

    return { isCookie: false };
  }

  private mapSupabaseRoleToApiKeyRole(supabaseRole?: string): ApiKeyRole {
    if (!supabaseRole) return ApiKeyRole.VIEWER; // Default authenticated users to read-only access unless explicitly elevated
    const roleLower = supabaseRole.toLowerCase();
    if (
      roleLower === 'admin' ||
      roleLower === 'superadmin' ||
      roleLower === 'companyadmin' ||
      roleLower === 'developer' ||
      roleLower === 'service_role'
    )
      return ApiKeyRole.ADMIN;
    if (roleLower === 'operator') return ApiKeyRole.OPERATOR;
    if (roleLower === 'viewer' || roleLower === 'readonly' || roleLower === 'read-only') return ApiKeyRole.VIEWER;
    return ApiKeyRole.VIEWER;
  }

  private hasRolePermission(userRole: ApiKeyRole, requiredRole: ApiKeyRole): boolean {
    const roleHierarchy: Record<ApiKeyRole, number> = {
      [ApiKeyRole.ADMIN]: 3,
      [ApiKeyRole.OPERATOR]: 2,
      [ApiKeyRole.VIEWER]: 1,
    };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Resolve the real client IP used for the API key's allowedIps whitelist.
   */
  private getClientIp(request: Request): string {
    const trustedProxies = this.configService.get<string[]>('security.trustedProxies') ?? [];
    return resolveClientIp(request, trustedProxies);
  }
}

