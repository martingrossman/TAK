import http from 'node:http';
import { readFile } from 'node:fs/promises';
const file = new URL('../dist/index.html', import.meta.url);
const port = Number(process.env.PORT || 4180);
const server = http.createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (!['/', '/index.html'].includes(req.url.split('?')[0])) { res.writeHead(404); res.end('Not found'); return; }
  try { const html = await readFile(file); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); }
  catch { res.writeHead(500); res.end('Run npm run build first.'); }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.log(`TAK preview is already running at http://127.0.0.1:${port}; reuse that server.`);
    process.exitCode = 0;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => console.log(`TAK preview: http://127.0.0.1:${port}`));
