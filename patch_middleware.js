const fs = require('fs');
const file = 'src/common/middleware/session-router.middleware.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const heldSessions = await sessionOwnershipService.heldByOtherNodes\(\);\n\s*const isHeld = heldSessions.includes\(sessionId\);\n/,
  `const heldMap = await sessionOwnershipService.heldByOthers();\n        const nodeData = heldMap.get(sessionId);\n`
);
code = code.replace(
  /nodeId: null,\n\s*nodeUrl: null,/,
  `nodeId: nodeData ? nodeData.nodeId : null,\n          nodeUrl: nodeData ? nodeData.nodeUrl : null,`
);
code = code.replace(
  /res\.status\(409\)\.json\(\{/,
  `if (nodeData && nodeData.nodeId) res.setHeader('X-Location-Node-Id', nodeData.nodeId);\n        if (nodeData && nodeData.nodeUrl) res.setHeader('X-Location-Node-Url', nodeData.nodeUrl);\n\n        res.status(409).json({`
);
code = code.replace(/isHeldByOtherNode/g, 'isHeldElsewhere');

fs.writeFileSync(file, code);
