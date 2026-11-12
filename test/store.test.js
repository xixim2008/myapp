import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore, validateData } from '../server/store.js';
import { createDefaults } from '../server/defaults.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'myapp-store-'));
}

test('文件不存在时自动生成默认数据并落盘', () => {
  const dir = tmpDir();
  const store = createStore(dir);
  const data = store.read();

  assert.equal(data.schemaVersion, 1);
  assert.deepEqual(data.plans, []);
  assert.deepEqual(data.settings.weekStart, 1);
  assert.ok(fs.existsSync(path.join(dir, 'data.json')), 'data.json 应该被创建');

  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
  assert.equal(onDisk.schemaVersion, 1);
});

test('第二次写入后 data.json.bak 保存的是上一版内容', () => {
  const dir = tmpDir();
  const store = createStore(dir);

  const first = createDefaults();
  first.plans.push({ id: 'p1', title: '第一版任务' });
  store.write(first);

  const second = createDefaults();
  second.plans.push({ id: 'p2', title: '第二版任务' });
  store.write(second);

  const bak = JSON.parse(fs.readFileSync(path.join(dir, 'data.json.bak'), 'utf8'));
  assert.equal(bak.plans.length, 1);
  assert.equal(bak.plans[0].title, '第一版任务');

  const current = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
  assert.equal(current.plans[0].title, '第二版任务');
});

test('写盘过程中替换失败时，原文件不被破坏', () => {
  const dir = tmpDir();
  const store = createStore(dir);

  const first = createDefaults();
  first.memos.push({ id: 'm1', text: '原有内容' });
  store.write(first);
  const before = fs.readFileSync(path.join(dir, 'data.json'), 'utf8');

  const brokenFs = Object.create(fs);
  brokenFs.renameSync = () => {
    throw new Error('模拟磁盘写入失败');
  };
  const brokenStore = createStore(dir, { fs: brokenFs });

  const second = createDefaults();
  second.memos.push({ id: 'm2', text: '新内容' });
  assert.throws(() => brokenStore.write(second), /模拟磁盘写入失败/);

  const after = fs.readFileSync(path.join(dir, 'data.json'), 'utf8');
  assert.equal(after, before, '原文件内容必须保持不变');
});

test('data.json 是坏 JSON 时读取报错且不覆盖原文件', () => {
  const dir = tmpDir();
  const broken = '{"schemaVersion": 1, "plans": [';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), broken, 'utf8');

  const store = createStore(dir);
  assert.throws(() => store.read(), /数据文件已损坏/);
  assert.equal(store.isCorrupted(), true);
  assert.equal(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'), broken);
  assert.equal(store.status().corrupted, true);
});

test('结构不合法的数据不允许写盘', () => {
  const dir = tmpDir();
  const store = createStore(dir);

  assert.throws(() => store.write({ schemaVersion: 1 }), /必须是数组/);

  const badVersion = createDefaults();
  badVersion.schemaVersion = 99;
  assert.throws(() => store.write(badVersion), /数据版本/);

  assert.equal(fs.existsSync(path.join(dir, 'data.json')), false, '校验失败不应产生文件');
});

test('覆盖损坏文件前会留存现场副本', () => {
  const dir = tmpDir();
  fs.mkdirSync(dir, { recursive: true });
  const broken = 'not-json-at-all';
  fs.writeFileSync(path.join(dir, 'data.json'), broken, 'utf8');

  const store = createStore(dir);
  store.write(createDefaults());

  const files = fs.readdirSync(dir).filter((f) => f.startsWith('data.corrupted-'));
  assert.equal(files.length, 1, '应留下一个损坏现场副本');
  assert.equal(fs.readFileSync(path.join(dir, files[0]), 'utf8'), broken);
});

test('validateData 对合法数据返回 ok', () => {
  assert.equal(validateData(createDefaults()).ok, true);
  assert.equal(validateData(null).ok, false);
  assert.equal(validateData([]).ok, false);
  const noSettings = createDefaults();
  delete noSettings.settings;
  assert.equal(validateData(noSettings).ok, false);
});
