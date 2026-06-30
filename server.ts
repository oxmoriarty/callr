/**
 * Custom Next.js server that integrates Socket.IO.
 *
 * Run with: node server.js (after build) or tsx server.ts (dev)
 * Set in package.json: "dev": "tsx server.ts"
 */

import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { initSocketServer } from './server/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = parseInt(process.env.PORT ?? '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl).catch((err) => {
      console.error('Request handler error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  });

  // Initialize Socket.IO
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
