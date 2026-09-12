import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  role?: string;
  companyId?: string;
  assignedSessions?: string[];
  userMetadata?: Record<string, unknown>;
  appMetadata?: Record<string, unknown>;
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient: SupabaseClient | null = null;
  private readonly jwtSecret: string;
  private readonly supabaseUrl: string;
  private readonly anonKey: string;
  private readonly serviceRoleKey: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('security.supabase.url') || process.env.SUPABASE_URL || '';
    this.anonKey = this.configService.get<string>('security.supabase.anonKey') || process.env.SUPABASE_ANON_KEY || '';
    this.serviceRoleKey =
      this.configService.get<string>('security.supabase.serviceRoleKey') || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.jwtSecret =
      this.configService.get<string>('security.supabase.jwtSecret') || process.env.SUPABASE_JWT_SECRET || '';

    if (this.supabaseUrl && (this.serviceRoleKey || this.anonKey)) {
      this.supabaseClient = createClient(this.supabaseUrl, this.serviceRoleKey || this.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.logger.log('Supabase client initialized successfully');
    } else {
      this.logger.log(
        'Supabase credentials not fully configured; offline JWT verification will be used if secret provided',
      );
    }
  }

  /**
   * Check if Supabase auth verification is enabled/available.
   */
  isEnabled(): boolean {
    return Boolean(this.supabaseClient || this.jwtSecret);
  }

  /**
   * Verify a Supabase JWT token and extract the user profile.
   */
  async verifyToken(token: string): Promise<SupabaseAuthUser | null> {
    if (!token) return null;

    let authUser: SupabaseAuthUser | null = null;

    // Fast path: if jwtSecret is configured, verify signature locally
    if (this.jwtSecret) {
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
        if (decoded && decoded.sub) {
          const userMeta = (decoded['user_metadata'] as Record<string, unknown>) || {};
          const appMeta = (decoded['app_metadata'] as Record<string, unknown>) || {};
          const userRole = userMeta['role'] || appMeta['role'] || decoded['role'] || 'authenticated';

          const companyId =
            (userMeta['company_id'] as string) ||
            (userMeta['companyId'] as string) ||
            (appMeta['company_id'] as string) ||
            (appMeta['companyId'] as string);

          const assignedSessions =
            (userMeta['assigned_sessions'] as string[]) || (userMeta['assignedSessions'] as string[]);

          authUser = {
            id: decoded.sub,
            email: decoded.email as string | undefined,
            role: String(userRole),
            companyId,
            assignedSessions: Array.isArray(assignedSessions) ? assignedSessions : undefined,
            userMetadata: userMeta,
            appMetadata: appMeta,
          };
        }
      } catch (err) {
        this.logger.debug(`Local JWT verification failed: ${(err as Error).message}`);
      }
    }

    // Fallback path: verify token via Supabase Auth API if not yet verified
    if (!authUser && this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient.auth.getUser(token);
        if (error || !data?.user) {
          if (error) {
            this.logger.debug(`Supabase remote token verification error: ${error.message}`);
          }
          return null;
        }

        const user: User = data.user;
        const userMeta = user.user_metadata || {};
        const appMeta = user.app_metadata || {};
        const userRole = userMeta['role'] || appMeta['role'] || user.role || 'authenticated';

        const companyId =
          (userMeta['company_id'] as string) ||
          (userMeta['companyId'] as string) ||
          (appMeta['company_id'] as string) ||
          (appMeta['companyId'] as string);

        const assignedSessions =
          (userMeta['assigned_sessions'] as string[]) || (userMeta['assignedSessions'] as string[]);

        authUser = {
          id: user.id,
          email: user.email,
          role: String(userRole),
          companyId,
          assignedSessions: Array.isArray(assignedSessions) ? assignedSessions : undefined,
          userMetadata: userMeta,
          appMetadata: appMeta,
        };
      } catch (err) {
        this.logger.warn(`Failed to verify Supabase token with client: ${(err as Error).message}`);
        return null;
      }
    }

    if (!authUser) return null;

    // Enrich companyId, role, and assignedSessions from profiles table if client is available
    if (this.supabaseClient) {
      try {
        const { data: profile } = await this.supabaseClient
          .from('profiles')
          .select('company_id, role, assigned_sessions')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profile) {
          if (profile.company_id) authUser.companyId = profile.company_id;
          if (profile.role) authUser.role = profile.role;
          if (profile.assigned_sessions && Array.isArray(profile.assigned_sessions)) {
            authUser.assignedSessions = profile.assigned_sessions;
          }
        }
      } catch (profileErr) {
        this.logger.debug(`Failed to enrich profile for user ${authUser.id}: ${(profileErr as Error).message}`);
      }
    }

    return authUser;
  }

  /**
   * Get the initialized Supabase client instance if available.
   */
  getClient(): SupabaseClient | null {
    return this.supabaseClient;
  }

  /**
   * Register or update instance metadata in Supabase on boot/install.
   */
  async registerInstance(data: {
    instanceId: string;
    hostname?: string;
    keyPrefix: string;
    version?: string;
    companyId?: string;
    activeSessionsCount?: number;
  }): Promise<boolean> {
    if (!this.supabaseClient) return false;

    try {
      const payload: Record<string, unknown> = {
        id: data.instanceId,
        key_prefix: data.keyPrefix,
        status: 'active',
        version: data.version || '0.23.0',
        last_heartbeat_at: new Date().toISOString(),
      };

      if (data.hostname) payload.hostname = data.hostname;
      if (data.companyId) payload.company_id = data.companyId;
      if (data.activeSessionsCount !== undefined) payload.active_sessions_count = data.activeSessionsCount;

      const { error } = await this.supabaseClient.from('instances').upsert(payload, { onConflict: 'id' });

      if (error) {
        this.logger.debug(`Failed to sync instance metadata to Supabase: ${error.message}`);
        return false;
      }

      this.logger.log(`Synced instance registration to Supabase: ${data.instanceId} (${data.keyPrefix}...)`);
      return true;
    } catch (err) {
      this.logger.debug(`Instance registration error: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Pair an instance with a company ID in Supabase upon successful user login.
   */
  async pairInstanceWithCompany(instanceId: string, companyId: string): Promise<boolean> {
    if (!this.supabaseClient || !instanceId || !companyId) return false;

    try {
      const { error } = await this.supabaseClient
        .from('instances')
        .update({
          company_id: companyId,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      if (error) {
        this.logger.debug(`Failed to pair instance ${instanceId} with company ${companyId}: ${error.message}`);
        return false;
      }

      this.logger.log(`Successfully paired instance ${instanceId} with company ${companyId}`);
      return true;
    } catch (err) {
      this.logger.debug(`Error pairing instance with company: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Push periodic heartbeat metrics (active session count, timestamp) to Supabase.
   */
  async sendHeartbeat(instanceId: string, activeSessionsCount: number): Promise<boolean> {
    if (!this.supabaseClient || !instanceId) return false;

    try {
      const { error } = await this.supabaseClient
        .from('instances')
        .update({
          active_sessions_count: activeSessionsCount,
          last_heartbeat_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      if (error) {
        this.logger.debug(`Heartbeat sync error for instance ${instanceId}: ${error.message}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.debug(`Heartbeat exception: ${(err as Error).message}`);
      return false;
    }
  }
}
