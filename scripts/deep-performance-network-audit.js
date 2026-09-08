const http = require('http');
const { performance, monitorEventLoopDelay } = require('perf_hooks');
const zlib = require('zlib');

const BASE_URL = 'http://localhost:2785';

// Helper for HTTP requests
function makeRequest(urlPath, options = {}) {
  const url = new URL(urlPath, BASE_URL);
  const reqOptions = {
    method: options.method || 'GET',
    headers: {
      'Accept': options.accept || 'application/json',
      'Connection': options.keepAlive ? 'keep-alive' : 'close',
      ...(options.headers || {})
    },
    agent: options.agent
  };

  return new Promise((resolve) => {
    const t0 = performance.now();
    const req = http.request(url, reqOptions, (res) => {
      const chunks = [];
      let totalBytes = 0;
      res.on('data', (chunk) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
      });
      res.on('end', () => {
        const latency = performance.now() - t0;
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          latencyMs: latency,
          bytes: totalBytes,
          bodyBuffer
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        error: err.message,
        latencyMs: performance.now() - t0,
        bytes: 0
      });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Benchmark runner with concurrency control
async function runLoadBenchmark(name, urlPath, totalRequests = 100, concurrency = 10, keepAlive = true) {
  const agent = new http.Agent({ keepAlive, maxSockets: concurrency });
  const latencies = [];
  let successCount = 0;
  let errorCount = 0;
  let totalBytes = 0;

  const tStart = performance.now();
  let scheduled = 0;

  async function worker() {
    while (scheduled < totalRequests) {
      scheduled++;
      const res = await makeRequest(urlPath, { keepAlive, agent });
      if (res.statusCode >= 200 && res.statusCode < 400) {
        successCount++;
        latencies.push(res.latencyMs);
        totalBytes += res.bytes;
      } else {
        errorCount++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const totalDurationMs = performance.now() - tStart;
  agent.destroy();

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p90 = latencies[Math.floor(latencies.length * 0.90)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const rps = totalDurationMs > 0 ? ((successCount / (totalDurationMs / 1000))).toFixed(1) : 0;

  return {
    name,
    urlPath,
    totalRequests,
    concurrency,
    keepAlive,
    successCount,
    errorCount,
    totalDurationMs: totalDurationMs.toFixed(2),
    rps,
    latencies: {
      min: min.toFixed(2),
      avg: avg.toFixed(2),
      p50: p50.toFixed(2),
      p90: p90.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
      max: max.toFixed(2)
    },
    avgBytesPerReq: successCount ? (totalBytes / successCount).toFixed(0) : 0
  };
}

// Compression & Payload Audit
async function auditPayloadCompression(urlPath, accept = 'application/json') {
  const res = await makeRequest(urlPath, { accept });
  const rawSize = res.bytes;
  let gzipSize = 0;
  let brotliSize = 0;

  if (res.bodyBuffer && res.bodyBuffer.length > 0) {
    gzipSize = zlib.gzipSync(res.bodyBuffer).length;
    brotliSize = zlib.brotliCompressSync(res.bodyBuffer).length;
  }

  const isServerCompressed = !!(res.headers['content-encoding']);
  const savingsPctGzip = rawSize > 0 ? (((rawSize - gzipSize) / rawSize) * 100).toFixed(1) : 0;
  const savingsPctBrotli = rawSize > 0 ? (((rawSize - brotliSize) / rawSize) * 100).toFixed(1) : 0;

  return {
    urlPath,
    statusCode: res.statusCode,
    contentType: res.headers['content-type'] || 'unknown',
    contentEncoding: res.headers['content-encoding'] || 'none (raw wire transfer)',
    rawSizeBytes: rawSize,
    gzipSizeBytes: gzipSize,
    brotliSizeBytes: brotliSize,
    potentialGzipSavings: `${savingsPctGzip}%`,
    potentialBrotliSavings: `${savingsPctBrotli}%`,
    headerSizeApprox: JSON.stringify(res.headers).length
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔬 DEEP INTERNAL PERFORMANCE & NETWORK AUDIT SUITE');
  console.log('='.repeat(80));

  // 1. Monitor Event Loop Delay
  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();

  const memInitial = process.memoryUsage();
  console.log('\n[1/5] Initial System Memory & Runtime Profile:');
  console.log(`- Node.js Version: ${process.version}`);
  console.log(`- RSS: ${(memInitial.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Heap Total: ${(memInitial.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Heap Used: ${(memInitial.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- External: ${(memInitial.external / 1024 / 1024).toFixed(2)} MB`);

  // 2. Run Concurrency & Keep-Alive Benchmarks
  console.log('\n[2/5] Running Multi-Tier Network Concurrency Benchmarks...');
  
  const benchmarks = [
    // Health endpoint
    await runLoadBenchmark('API Health (Keep-Alive, c=10)', '/api/health', 150, 10, true),
    await runLoadBenchmark('API Health (No Keep-Alive / Fresh TCP, c=10)', '/api/health', 150, 10, false),
    await runLoadBenchmark('API Health (High Concurrency, c=30)', '/api/health', 300, 30, true),
    // SPA Root Document
    await runLoadBenchmark('SPA Document / (Keep-Alive, c=10)', '/', 100, 10, true),
  ];

  console.table(benchmarks.map(b => ({
    Benchmark: b.name,
    Reqs: b.totalRequests,
    Concurrency: b.concurrency,
    'RPS': b.rps,
    'P50 (ms)': b.latencies.p50,
    'P95 (ms)': b.latencies.p95,
    'P99 (ms)': b.latencies.p99,
    'Avg (ms)': b.latencies.avg,
    'Avg Bytes': b.avgBytesPerReq
  })));

  // 3. Payload Compression & Transfer Efficiency Audit
  console.log('\n[3/5] Auditing Network Transfer & Compression Efficiency...');
  const compressionAudits = [
    await auditPayloadCompression('/api/health'),
    await auditPayloadCompression('/'),
  ];
  console.table(compressionAudits);

  // 4. Measure Event Loop Under Load
  eld.disable();
  const memPost = process.memoryUsage();
  console.log('\n[4/5] Event Loop & Process Metrics Post-Load:');
  console.log(`- Event Loop Min Delay: ${(eld.min / 1e6).toFixed(3)} ms`);
  console.log(`- Event Loop Mean Delay: ${(eld.mean / 1e6).toFixed(3)} ms`);
  console.log(`- Event Loop P50 Delay: ${(eld.percentile(50) / 1e6).toFixed(3)} ms`);
  console.log(`- Event Loop P95 Delay: ${(eld.percentile(95) / 1e6).toFixed(3)} ms`);
  console.log(`- Event Loop P99 Delay: ${(eld.percentile(99) / 1e6).toFixed(3)} ms`);
  console.log(`- Event Loop Max Delay: ${(eld.max / 1e6).toFixed(3)} ms`);
  console.log(`- RSS Delta: ${((memPost.rss - memInitial.rss) / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n[5/5] Audit Run Completed.');
  console.log('='.repeat(80));
}

main().catch(console.error);
