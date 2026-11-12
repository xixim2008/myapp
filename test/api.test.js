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
    // 带上当前版本号再写（服务端会拒绝过期版本，这是有意的并发保护）
    const current = await (await fetch(`${base}/api/data`)).json();
    const payload = createDefaults();
    payload.rev = current.rev;
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

test('PUT 带旧版本号时被拒绝（409），文件不被覆盖', async () => {
  await withServer(async ({ base, store }) => {
    const first = await (await fetch(`${base}/api/data`)).json();
    const rev = first.rev;

    // 另一个页面先保存了一次，版本号被推高
    const a = { ...first, memos: [{ id: 'm1', text: '来自页面 A' }] };
    const resA = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(a)
    });
    assert.equal(resA.status, 200);
    const bodyA = await resA.json();
    assert.equal(bodyA.rev, rev + 1, '每次保存版本号 +1');

    // 拿着旧版本号的页面 B 再来写，必须被挡下
    const b = { ...first, memos: [{ id: 'm2', text: '来自页面 B（过期）' }] };
    const resB = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b)
    });
    assert.equal(resB.status, 409);
    const bodyB = await resB.json();
    assert.equal(bodyB.conflict, true);
    assert.equal(bodyB.rev, rev + 1);

    const onDisk = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(onDisk.memos.length, 1);
    assert.equal(onDisk.memos[0].text, '来自页面 A', '磁盘上应保留先写的那份');
  });
});

test('带 x-force 头可以强行覆盖（导入备份用）', async () => {
  await withServer(async ({ base, store }) => {
    const first = await (await fetch(`${base}/api/data`)).json();
    await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...first, memos: [{ id: 'm1', text: 'A' }] })
    });

    const forced = { ...first, memos: [{ id: 'm2', text: '备份恢复' }] };
    const res = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-force': '1' },
      body: JSON.stringify(forced)
    });
    assert.equal(res.status, 200);

    const onDisk = JSON.parse(fs.readFileSync(store.file, 'utf8'));
    assert.equal(onDisk.memos[0].text, '备份恢复');
  });
});

test('损坏的 rev 不被接受（必须是整数）', async () => {
  await withServer(async ({ base }) => {
    const data = await (await fetch(`${base}/api/data`)).json();
    const res = await fetch(`${base}/api/data`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, rev: 'abc' })
    });
    assert.equal(res.status, 400);
  });
});
