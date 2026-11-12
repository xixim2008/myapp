import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/server.js';
import { createStore } from '../server/store.js';
import { createDefaults } from '../server/defaults.js';

function setup() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myapp-api-data-'));
  const pubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myapp-api-pub-'));
  fs.writeFileSync(path.join(pubDir, 'index.html'), '<!doctype html><title>ok</title>', 'utf8');
  const store = createStore(dataDir);
  store.read();
  const app = createApp({ store, publicDir: pubDir });
  return { store, app, dataDir, pubDir };
}

async function withServer(fn) {
  const ctx = setup();
  await new Promise((resolve) => ctx.app.listen(0, '127.0.0.1', resolve));
  const { port } = ctx.app.address();
  ctx.base = `http://127.0.0.1:${port}`;
  try {
    await fn(ctx);
  } finally {
    await new Promise((resolve) => ctx.app.close(resolve));
  }
}

test('GET /api/health 返回 ok', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  });
});

test('GET /api/data 返回完整结构', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/data`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.schemaVersion, 1);
    assert.ok(Array.isArray(body.plans));
    assert.ok(Array.isArray(body.playLogs));
    assert.equal(typeof body.settings, 'object');
  });
});

test('PUT /api/data 写入成功并可读回', async () => {
  await withServer(async ({ base, dataDir }) => {
    const payload = createDefaults();
    payload.plans.push({ id: 'p1', title: '写盘验证' });

    const res = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.savedAt);

    const again = await (await fetch(`${base}/api/data`)).json();
    assert.equal(again.plans.length, 1);
    assert.equal(again.plans[0].title, '写盘验证');

    const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8'));
    assert.equal(onDisk.plans[0].title, '写盘验证');
  });
});

test('PUT 非法结构返回 400 且不写盘', async () => {
  await withServer(async ({ base, dataDir }) => {
    const before = fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8');

    const res = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, plans: 'not-an-array' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /数组/);

    const after = fs.readFileSync(path.join(dataDir, 'data.json'), 'utf8');
    assert.equal(after, before);
  });
});

test('PUT 非 JSON 请求体返回 400', async () => {
  await withServer(async ({ base }) => {
    const res = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    });
    assert.equal(res.status, 400);
  });
});

test('静态资源与首页可访问，未知路径回落 index.html', async () => {
  await withServer(async ({ base }) => {
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    assert.match(root.headers.get('content-type'), /text\/html/);

    const spa = await fetch(`${base}/some/unknown/path`);
    assert.equal(spa.status, 200);
    assert.match(await spa.text(), /<title>ok<\/title>/);
  });
});

test('GET /api/data/status 返回文件状态', async () => {
  await withServer(async ({ base }) => {
    const body = await (await fetch(`${base}/api/data/status`)).json();
    assert.equal(body.exists, true);
    assert.equal(body.corrupted, false);
    assert.ok(body.size > 0);
  });
});
