import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
};

/**
 * 只服务渲染台需要的静态文件：render/ 和 node_modules/three。
 * 用最小的服务器而不是项目的 Next/Cloudflare 工具链，是为了让逐帧录制
 * 完全可控——没有 HMR、没有 SSR、没有随机的启动时序。
 */
export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/render/index.html';

    // 浏览器会自动要 favicon，返回 403 会污染录制时的错误检查
    if (pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }

    const allowed = pathname.startsWith('/render/') || pathname.startsWith('/node_modules/three/');
    if (!allowed) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
}

export function listen(port = 4321) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 4321);
  listen(port).then(() => {
    console.log(`渲染台: http://127.0.0.1:${port}/render/index.html?scene=drag`);
  });
}
