import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, SAVE_CLEAN, SAVE_DIRTY, SAVE_SAVING, SAVE_ERROR } from '../public/js/store.js';
import { createDefaults } from '../server/defaults.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeState() {
  return createDefaults();
}

test('连续 5 次改动只触发一次写盘（防抖）', async () => {
  let calls = 0;
  const store = createStore(fakeState(), {
    debounceMs: 25,
    save: async () => {
      calls += 1;
      return { savedAt: new Date().toISOString() };
    }
  });

  for (let i = 0; i < 5; i += 1) {
    store.commit((s) => {
      s.memos.push({ id: 'm' + i, text: '第 ' + i + ' 条' });
    });
  }
  assert.equal(calls, 0, '还没到防抖时间不应该写盘');

  await wait(70);
  assert.equal(calls, 1);
  assert.equal(store.dirty, false);
});

test('flush 立即写盘，不等待防抖', async () => {
  let calls = 0;
  const store = createStore(fakeState(), {
    debounceMs: 5000,
    save: async () => {
      calls += 1;
      return { savedAt: new Date().toISOString() };
    }
  });
  store.commit((s) => s.memos.push({ id: 'm1', text: 'x' }));
  const res = await store.flush();
  assert.equal(res.ok, true);
  assert.equal(calls, 1);
  assert.equal(store.dirty, false);
});

test('保存状态按 dirty → saving → clean 流转', async () => {
  const seen = [];
  const store = createStore(fakeState(), {
    debounceMs: 10,
    save: async () => ({ savedAt: '2026-11-12T01:41:00.000Z' })
  });
  store.onStatus((s) => seen.push(s.kind));

  store.commit((s) => s.memos.push({ id: 'm1', text: 'x' }));
  await wait(40);

  assert.equal(seen[0], SAVE_CLEAN);
  assert.ok(seen.includes(SAVE_DIRTY));
  assert.ok(seen.includes(SAVE_SAVING));
  assert.equal(seen[seen.length - 1], SAVE_CLEAN);
  assert.equal(store.status.savedAt, '2026-11-12T01:41:00.000Z');
});

test('保存失败进入 error 状态，并保留脏标记以便重试', async () => {
  let shouldFail = true;
  let calls = 0;
  const seen = [];
  const store = createStore(fakeState(), {
    debounceMs: 10,
    save: async () => {
      calls += 1;
      if (shouldFail) throw new Error('磁盘已满');
      return { savedAt: '2026-11-12T02:00:00.000Z' };
    }
  });
  store.onStatus((s) => seen.push(s.kind));

  store.commit((s) => s.memos.push({ id: 'm1', text: 'x' }));
  await wait(40);

  assert.equal(store.dirty, true, '失败后必须保留未保存改动');
  assert.equal(store.status.kind, SAVE_ERROR);
  assert.match(store.status.error, /磁盘已满/);

  shouldFail = false;
  const res = await store.flush();
  assert.equal(res.ok, true);
  assert.equal(store.dirty, false);
  assert.equal(calls, 2);
});

test('写盘期间又有新改动，不会被误标为已保存', async () => {
  let resolveSave;
  const store = createStore(fakeState(), {
    debounceMs: 5,
    save: () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      })
  });

  store.commit((s) => s.memos.push({ id: 'm1', text: '第一次' }));
  await wait(20);

  store.commit((s) => s.memos.push({ id: 'm2', text: '第二次' }));
  resolveSave({ savedAt: '2026-11-12T03:00:00.000Z' });
  await wait(20);

  assert.equal(store.dirty, true, '期间有新改动，仍然算脏');
});

test('replaceAll 整体替换后立即写盘', async () => {
  let saved = null;
  const store = createStore(fakeState(), {
    debounceMs: 5000,
    save: async (state) => {
      saved = state;
      return { savedAt: '2026-11-12T04:00:00.000Z' };
    }
  });
  const next = createDefaults();
  next.clients.push({ id: 'c1', name: '张三' });
  await store.replaceAll(next);

  assert.equal(saved.clients.length, 1);
  assert.equal(store.dirty, false);
});

test('没有改动时 flush 直接返回 skipped', async () => {
  const store = createStore(fakeState(), { save: async () => ({ savedAt: null }) });
  const res = await store.flush();
  assert.equal(res.ok, true);
  assert.equal(res.skipped, true);
  assert.equal(store.saveCalls, 0);
});
