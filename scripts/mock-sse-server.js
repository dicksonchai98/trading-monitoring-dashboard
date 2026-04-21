const http = require('http');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const server = http.createServer((req, res) => {
  if (req.url !== '/v1/stream/sse') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('\n');

  let ts = Date.now();
  const interval = setInterval(() => {
    ts += 1000;
    sendEvent(res, 'heartbeat', { ts });
    sendEvent(res, 'kbar_current', { code: 'TXFD6', minute_ts: ts, index_value: 100 + Math.floor(Math.random() * 5), ts: ts });
    sendEvent(res, 'metric_latest', { ts, code: 'TXFD6', value: Math.random() * 100, event_ts: ts });
    // spot market distribution example
    sendEvent(res, 'spot_market_distribution_latest', { ts, up_count: Math.floor(Math.random() * 10), down_count: Math.floor(Math.random() * 10), flat_count: Math.floor(Math.random() * 5), total_count: 10, trend_index: Math.random() * 100 });
    res.flush && res.flush();
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock SSE server listening on http://localhost:${PORT}/v1/stream/sse`);
});
