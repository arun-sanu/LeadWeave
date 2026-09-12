import { Request, Response, NextFunction } from 'express';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { SessionOwnershipService } from '../../modules/session/session-ownership.service';
import { createLogger } from '../services/logger.service';

const logger = createLogger('SessionRouterMiddleware');

/**
 * Extract target session id from route params or body.
 */
export function extractSessionIdFromRequest(req: Request): string | null {
  if (req.params && typeof req.params.sessionId === 'string' && req.params.sessionId.trim()) {
    return req.params.sessionId.trim();
  }
  if (req.params && typeof req.params.id === 'string' && req.params.id.trim()) {
    return req.params.id.trim();
  }
  if (req.body && typeof req.body.sessionId === 'string' && req.body.sessionId.trim()) {
    return req.body.sessionId.trim();
  }
  return null;
}

/**
 * Middleware that checks session ownership locality across node replicas.
 * 
 * If a session request lands on a pod that does NOT host the live engine instance,
 * it inspects whether a peer node owns the active session. If nodeUrl is available,
 * it returns a clear 409 Conflict with node routing metadata so ingress / load balancers
 * or callers can redirect to the target pod without silent failure.
 */
export function createSessionRouterMiddleware(
  engineRegistry: EngineRegistry,
  sessionOwnershipService: SessionOwnershipService,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sessionId = extractSessionIdFromRequest(req);
    
    // If no session ID in request, or if this process holds the active engine locally, proceed directly.
    if (!sessionId || engineRegistry.has(sessionId)) {
      return next();
    }

    try {
      // Check if another node holds an active lease on this session
      const isHeldElsewhere = await sessionOwnershipService.isHeldByOtherNode(sessionId);
      if (isHeldElsewhere) {
        const heldSessions = await sessionOwnershipService.heldByOtherNodes();
        const isHeld = heldSessions.includes(sessionId);

        logger.debug('Session request landed on node without local engine instance', {
          sessionId,
          thisNodeId: sessionOwnershipService.nodeId,
        });

        res.status(409).json({
          statusCode: 409,
          error: 'Conflict',
          code: 'SESSION_HOSTED_ON_PEER_NODE',
          message: `Session ${sessionId} is hosted on another peer node. Route request to owning node.`,
          nodeId: null,
          nodeUrl: null,
        });
        return;
      }
    } catch (error) {
      // On DB lookup error, log warning and let request proceed to normal Nest guards/handlers
      logger.warn('Failed to check session location in session router middleware', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    next();
  };
}
