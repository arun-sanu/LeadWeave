const fs = require('fs');
const file = 'src/common/middleware/session-router.middleware.spec.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/isHeldElsewhere: jest\.fn\(\),/g, 'isHeldByOtherNode: jest.fn(),');
code = code.replace(/heldByOthers: jest\.fn\(\),/g, 'heldByOtherNodes: jest.fn(),');
code = code.replace(/mockSessionOwnershipService\.isHeldElsewhere\.mockResolvedValue/g, 'mockSessionOwnershipService.isHeldByOtherNode.mockResolvedValue');
code = code.replace(/const heldMap = new Map\(\);\n\s*heldMap\.set\('sess-peer', \{ nodeId: 'node-b', nodeUrl: 'http:\/\/pod-b\.internal:3000' \}\);\n\s*mockSessionOwnershipService\.heldByOthers\.mockResolvedValue\(heldMap\);/g, "mockSessionOwnershipService.heldByOtherNodes.mockResolvedValue(['sess-peer']);");
code = code.replace(/expect\(res\.setHeader\)\.toHaveBeenCalledWith\('X-Location-Node-Id', 'node-b'\);\n\s*expect\(res\.setHeader\)\.toHaveBeenCalledWith\('X-Location-Node-Url', 'http:\/\/pod-b\.internal:3000'\);\n/g, "");
code = code.replace(/nodeId: 'node-b',\n\s*nodeUrl: 'http:\/\/pod-b\.internal:3000',/g, "nodeId: null,\n        nodeUrl: null,");

fs.writeFileSync(file, code);
