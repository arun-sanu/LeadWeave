import { Request, Response, NextFunction } from 'express';
import { EngineRegistry } from '../../engine/engine-registry.service';
import { SessionOwnershipService } from '../../modules/session/session-ownership.service';
import { extractSessionIdFromRequest, createSessionRouterMiddleware } from './session-router.middleware';

describe('SessionRouterMiddleware', () => {
  let mockEngineRegistry: jest.Mocked<EngineRegistry>;
  let mockSessionOwnershipService: jest.Mocked<SessionOwnershipService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    mockEngineRegistry = {
      has: jest.fn(),
    } as any;

    mockSessionOwnershipService = {
      isHeldElsewhere: jest.fn(),
      heldByOthers: jest.fn(),
      nodeId: 'node-a',
    } as any;

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
    const middleware = createSessionRouterMiddleware(mockEngineRegistry, mockSessionOwnershipService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockSessionOwnershipService.isHeldElsewhere).not.toHaveBeenCalled();
  });

  it('calls next() immediately when engine is hosted locally', async () => {
    req.params = { sessionId: 'sess-1' };
    mockEngineRegistry.has.mockReturnValue(true);

    const middleware = createSessionRouterMiddleware(mockEngineRegistry, mockSessionOwnershipService);
    await middleware(req as Request, res as Response, next);

    expect(mockEngineRegistry.has).toHaveBeenCalledWith('sess-1');
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockSessionOwnershipService.isHeldElsewhere).not.toHaveBeenCalled();
  });

  it('returns 409 Conflict with node routing headers when session is hosted on peer node', async () => {
    req.params = { sessionId: 'sess-peer' };
    mockEngineRegistry.has.mockReturnValue(false);
    mockSessionOwnershipService.isHeldElsewhere.mockResolvedValue(true);

    const heldMap = new Map();
    heldMap.set('sess-peer', { nodeId: 'node-b', nodeUrl: 'http://pod-b.internal:3000' });
    mockSessionOwnershipService.heldByOthers.mockResolvedValue(heldMap);

    const middleware = createSessionRouterMiddleware(mockEngineRegistry, mockSessionOwnershipService);
    await middleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Location-Node-Id', 'node-b');
    expect(res.setHeader).toHaveBeenCalledWith('X-Location-Node-Url', 'http://pod-b.internal:3000');
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SESSION_HOSTED_ON_PEER_NODE',
        nodeId: 'node-b',
        nodeUrl: 'http://pod-b.internal:3000',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() if session is not held anywhere (idle/unstarted session)', async () => {
    req.params = { sessionId: 'sess-idle' };
    mockEngineRegistry.has.mockReturnValue(false);
    mockSessionOwnershipService.isHeldElsewhere.mockResolvedValue(false);

    const middleware = createSessionRouterMiddleware(mockEngineRegistry, mockSessionOwnershipService);
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
