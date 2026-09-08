const http = require('http');

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 2785,
      path: `/api${path}`,
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.end();
  });
}

(async () => {
  console.log('================================================================');
  console.log('🔍 FULL BACKEND NESTJS ROUTE PATH DISCOVERY & SECURITY AUDIT');
  console.log('================================================================\n');

  const routes = [
    '/health',
    '/sessions',
    '/sessions/default/messages',
    '/sessions/default/contacts',
    '/sessions/default/chats',
    '/sessions/default/webhooks',
    '/sessions/default/labels',
    '/sessions/default/groups',
    '/sessions/default/media',
    '/sessions/default/status',
    '/webhooks',
    '/plugins',
    '/audit',
    '/auth/api-keys',
    '/settings',
    '/stats',
    '/metrics',
    '/infra',
    '/search',
    '/lead-sheets',
  ];

  let unauthBlockedCount = 0;
  let publicCount = 0;
  let broken404Count = 0;

  for (const route of routes) {
    const res = await testEndpoint(route);
    let statusLabel = '';
    if (res.status === 401 || res.status === 403) {
      statusLabel = '🔒 AUTH PROTECTED (401/403)';
      unauthBlockedCount++;
    } else if (res.status === 200) {
      statusLabel = '🌐 PUBLICLY ACCESSIBLE (200)';
      publicCount++;
    } else if (res.status === 404) {
      statusLabel = '❌ NOT FOUND / SHADOWED (404)';
      broken404Count++;
    } else {
      statusLabel = `⚠️  STATUS ${res.status}`;
    }

    console.log(`Path: ${('/api' + route).padEnd(35)} | ${statusLabel}`);
  }

  console.log('\n================================================================');
  console.log('📊 BACKEND SECURITY & ROUTING SUMMARY:');
  console.log(` - Secure Auth-Guarded Routes (401/403): ${unauthBlockedCount}`);
  console.log(` - Public Routes (200 OK): ${publicCount}`);
  console.log(` - Missing / Unmapped Routes (404): ${broken404Count}`);
  console.log('================================================================\n');
})();
