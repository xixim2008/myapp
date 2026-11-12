import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 5178);
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const err = new Error('请求体过大');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'content-length': body.length
  });
  res.end(body);
}

export function createApp({ store, publicDir = PUBLIC_DIR }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendJSON(res, 400, { ok: false, error: '路径编码不合法' });
    }

    try {
      if (pathname === '/api/health') {
        return sendJSON(res, 200, { ok: true, version: 1 });
      }

      if (pathname === '/api/data/status') {
        return sendJSON(res, 200, store.status());
      }

      if (pathname === '/api/data') {
        if (req.method === 'GET') {
          try {
            return sendJSON(res, 200, store.read());
          } catch (err) {
            if (err.corrupted) {
              return sendJSON(res, 500, { ok: false, corrupted: true, error: err.message });
            }
            throw err;
          }
        }
        if (req.method === 'PUT') {
          const raw = await readBody(req);
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            return sendJSON(res, 400, { ok: false, error: '请求体不是合法 JSON' });
          }
          try {
            const savedAt = store.write(data, {
              // 没带版本号一律按 0 处理：老页面/老缓存也不能悄悄覆盖新数据
              expectRev: typeof data.rev === 'number' ? data.rev : 0,
              force: req.headers['x-force'] === '1'
            });
            return sendJSON(res, 200, { ok: true, savedAt, rev: data.rev });
          } catch (err) {
            if (err.invalid) return sendJSON(res, 400, { ok: false, error: err.message });
            if (err.conflict) {
              // 409：这个页面拿的是旧数据，拒绝写入，让前端提示刷新，绝不覆盖
              return sendJSON(res, 409, {
                ok: false,
                error: err.message,
                conflict: true,
                rev: err.conflict.rev,
                savedAt: err.conflict.savedAt
              });
            }
            throw err;
          }
        }
        return sendJSON(res, 405, { ok: false, error: '方法不支持' });
      }

      if (pathname.startsWith('/api/')) {
        return sendJSON(res, 404, { ok: false, error: '接口不存在' });
      }

      const rel = pathname === '/' ? '/index.html' : pathname;
      const normalized = path.normalize(path.join(publicDir, rel));
      if (!normalized.startsWith(path.normalize(publicDir))) {
        return sendJSON(res, 403, { ok: false, error: '禁止访问' });
      }
      if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
        return serveFile(res, normalized);
      }
      // 单页应用：未知路径回落到 index.html
      return serveFile(res, path.join(publicDir, 'index.html'));
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      sendJSON(res, status, { ok: false, error: err.message });
    }
  });
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* 打不开浏览器不影响服务 */
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const store = createStore(DATA_DIR);

  try {
    store.read();
  } catch (err) {
    console.error('');
    console.error('[注意] ' + err.message);
    console.error('       原文件已保留，未做任何覆盖。可把 data/data.json.bak 复制为 data/data.json 后重试。');
    console.error('');
  }

  const server = createApp({ store });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`端口 ${PORT} 已被占用。请关闭占用程序，或用 PORT=5179 npm start 换端口。`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log('');
    console.log('  我的工作台已启动');
    console.log('  地址：' + url);
    console.log('  数据：' + store.file);
    console.log('  停止：按 Ctrl + C');
    console.log('');
    if (process.env.NO_OPEN !== '1') openBrowser(url);
  });
}
