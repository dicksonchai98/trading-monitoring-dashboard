const http = require('http');
const NUM = parseInt(process.argv[2] || '20', 10);
const DURATION_MS = parseInt(process.argv[3] || '30', 10) * 1000;

console.log(`Starting ${NUM} SSE clients for ${DURATION_MS/1000}s`);

const clients = [];
for (let i = 0; i < NUM; ++i) {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/v1/stream/sse',
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
  };
  try {
    const req = http.request(options, (res) => {
      res.setEncoding('utf8');
      res.on('data', () => {});
      res.on('end', () => {});
    });
    req.on('error', () => {});
    req.end();
    clients.push(req);
  } catch (e) {
    // ignore
  }
}

setTimeout(() => {
  console.log('Exiting load script');
  process.exit(0);
}, DURATION_MS);
