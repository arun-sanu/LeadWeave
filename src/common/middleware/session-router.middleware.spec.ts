import { Request, Response } from 'express';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { SessionOwnershipService } from '../../modules/session/session-ownership.service';
import { extractSessionIdFromRequest, createSessionRouterMiddleware } from './session-router.middleware';

describe('SessionRouterMiddleware', () => {
  let mockEngineRegistry: { has: jest.Mock };
  let mockSessionOwnershipService: {
    isHeldByOtherNode: jest.Mock;
    heldByOtherNodes: jest.Mock;
    nodeId: string;
  };
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    mockEngineRegistry = {
      has: jest.fn(),
    };

    mockSessionOwnershipService = {
      isHeldByOtherNode: jest.fn(),
      heldByOtherNodes: jest.fn(),
      nodeId: 'node-a',
    };

    req = {
      params: {},
      body: {},
    };

    res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it('extracts session id correctly from params or body', () => {
    expect(extractSessionIdFromRequest({ params: { sessionId: '  sess-1  ' } } as any)).toBe('sess-1');
    expect(extractSessionIdFromRequest({ params: { id: 'sess-2' } } as any)).toBe('sess-2');
    expect(extractSessionIdFromRequest({ body: { sessionId: 'sess-3' } } as any)).toBe('sess-3');
    expect(extractSessionIdFromRequest({ params: {}, body: {} } as any)).toBeNull();
  });

  it('calls next() immediately when no sessionId is present in request', async () => {
    const middleware = createSessionRouterMiddleware(
      mockEngineRegistry as unknown as EngineRegistry,
      mockSessionOwnershipService as unknown as SessionOwnershipService,
    );
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockSessionOwnershipService.isHeldByOtherNode).not.toHaveBeenCalled();
  });

  it('calls next() immediately when engine is hosted locally', async () => {
    req.params = { sessionId: 'sess-1' };
    mockEngineRegistry.has.mockReturnValue(true);

    const middleware = createSessionRouterMiddleware(
      mockEngineRegistry as unknown as EngineRegistry,
      mockSessionOwnershipService as unknown as SessionOwnershipService,
    );
    await middleware(req as Request, res as Response, next);

    expect(mockEngineRegistry.has).toHaveBeenCalledWith('sess-1');
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockSessionOwnershipService.isHeldByOtherNode).not.toHaveBeenCalled();
  });

  it('returns 409 Conflict with node routing headers when session is hosted on peer node', async () => {
    req.params = { sessionId: 'sess-peer' };
    mockEngineRegistry.has.mockReturnValue(false);
    mockSessionOwnershipService.isHeldByOtherNode.mockResolvedValue(true);

    mockSessionOwnershipService.heldByOtherNodes.mockResolvedValue(['sess-peer']);

    const middleware = createSessionRouterMiddleware(
      mockEngineRegistry as unknown as EngineRegistry,
      mockSessionOwnershipService as unknown as SessionOwnershipService,
    );
    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SESSION_HOSTED_ON_PEER_NODE',
        nodeId: null,
        nodeUrl: null,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() if session is not held anywhere (idle/unstarted session)', async () => {
    req.params = { sessionId: 'sess-idle' };
    mockEngineRegistry.has.mockReturnValue(false);
    mockSessionOwnershipService.isHeldByOtherNode.mockResolvedValue(false);

    const middleware = createSessionRouterMiddleware(
      mockEngineRegistry as unknown as EngineRegistry,
      mockSessionOwnershipService as unknown as SessionOwnershipService,
    );
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
