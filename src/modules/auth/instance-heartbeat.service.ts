import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as os from 'os';
import { SupabaseService } from './supabase.service';

@Injectable()
export class InstanceHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstanceHeartbeatService.name);
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    // Run heartbeat every 5 minutes (300,000 ms)
    this.heartbeatInterval = setInterval(() => {
      void this.performHeartbeat();
    }, 5 * 60 * 1000);

    // Initial heartbeat after 10 seconds
    setTimeout(() => {
      void this.performHeartbeat();
    }, 10_000);
  }

  onModuleDestroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async performHeartbeat(): Promise<void> {
    try {
      const supabaseService = this.moduleRef.get(SupabaseService, { strict: false });
      if (!supabaseService?.isEnabled?.()) return;

      const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || `lw-node-${os.hostname()}`;
      
      // Determine active session count if SessionManager is loaded
      let activeSessionsCount = 0;
      try {
        const { SessionManager } = require('../../engine/session.manager');
        const sessionManager = this.moduleRef.get(SessionManager, { strict: false });
        if (sessionManager) {
          const sessions = sessionManager.getAllSessions?.() || [];
          activeSessionsCount = Array.isArray(sessions) ? sessions.length : 0;
        }
      } catch {
        // Best effort active session resolution
      }

      await supabaseService.sendHeartbeat(instanceId, activeSessionsCount);
      this.logger.debug(`Instance heartbeat sent for ${instanceId} (Active sessions: ${activeSessionsCount})`);
    } catch (err) {
      this.logger.debug(`Failed to run instance heartbeat: ${(err as Error).message}`);
    }
  }
}
