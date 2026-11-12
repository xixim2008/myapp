/**
 * 前端状态容器：单一 state，所有改动走 commit()，1.5 秒防抖写盘。
 * 不依赖 DOM，可直接被测试引用。
 */

export const SAVE_CLEAN = 'clean';
export const SAVE_DIRTY = 'dirty';
export const SAVE_SAVING = 'saving';
export const SAVE_ERROR = 'error';
export const SAVE_CONFLICT = 'conflict';

export function createStore(initial, options = {}) {
  const save = options.save || (async () => ({ savedAt: new Date().toISOString() }));
  const debounceMs = options.debounceMs ?? 1500;

  let state = initial;
  let rev = 0; // 本页数据的改动次数，用来判断写盘期间是否又有新改动
  let dirty = false;
  let timer = null;
  let inflight = null;
  let saveCalls = 0;
  // 撞版本后暂停自动保存：宁可停下问人，也不悄悄覆盖别处的新数据
  let blocked = false;

  let status = {
    kind: SAVE_CLEAN,
    savedAt: (initial.settings && initial.settings.lastSavedAt) || null,
    error: null
  };

  const renderSubs = new Set();
  const statusSubs = new Set();

  function setStatus(patch) {
    status = { ...status, ...patch };
    for (const fn of statusSubs) fn(status);
  }

  function notify() {
    for (const fn of renderSubs) fn(state);
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush().catch(() => {});
    }, debounceMs);
  }

  /** 修改状态：mutator 直接改传入的 state 对象 */
  function commit(mutator) {
    const result = mutator(state);
    rev += 1;
    dirty = true;
    setStatus({ kind: blocked ? SAVE_CONFLICT : SAVE_DIRTY, error: null });
    notify();
    if (!blocked) schedule();
    return result;
  }

  /** 立即写盘（手动保存 / 关闭前）；opts.beacon 用于页面销毁前抢存，opts.force 跳过版本检查 */
  async function flush(opts = {}) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (blocked && !opts.force) {
      return { ok: false, blocked: true, error: '数据已被其他页面更新，请先刷新再保存' };
    }
    if (!dirty) {
      return { ok: true, savedAt: status.savedAt, skipped: true };
    }
    if (inflight) {
      await inflight.catch(() => {});
      if (!dirty) return { ok: true, savedAt: status.savedAt, skipped: true };
    }

    const snapshotRev = rev;
    setStatus({ kind: SAVE_SAVING, error: null });

    inflight = (async () => save(state, opts))();
    try {
      const res = await inflight;
      saveCalls += 1;
      const savedAt = (res && res.savedAt) || new Date().toISOString();
      state.settings = { ...state.settings, lastSavedAt: savedAt };
      if (res && typeof res.rev === 'number') state.rev = res.rev;
      if (snapshotRev === rev) dirty = false;
      blocked = false;
      setStatus({
        kind: dirty ? SAVE_DIRTY : SAVE_CLEAN,
        savedAt,
        error: null
      });
      return { ok: true, savedAt };
    } catch (err) {
      // 版本撞车：停下自动保存，等用户决定刷新还是强行覆盖
      if (err && err.conflict) {
        blocked = true;
        setStatus({ kind: SAVE_CONFLICT, error: err.message, rev: err.rev });
        return { ok: false, conflict: true, error: err.message };
      }
      // 其他失败不清 dirty，保证还能再存一次
      setStatus({ kind: SAVE_ERROR, error: err.message });
      return { ok: false, error: err.message };
    } finally {
      inflight = null;
    }
  }

  /** 整体替换（导入备份时用）：这是明确的覆盖意图，跳过版本检查并立即写盘 */
  async function replaceAll(next) {
    state = next;
    rev += 1;
    dirty = true;
    blocked = false;
    notify();
    return flush({ force: true });
  }

  return {
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    get dirty() {
      return dirty;
    },
    get saveCalls() {
      return saveCalls;
    },
    get blocked() {
      return blocked;
    },
    commit,
    flush,
    refresh() {
      notify();
    },
    replaceAll,
    subscribe(fn) {
      renderSubs.add(fn);
      return () => renderSubs.delete(fn);
    },
    onStatus(fn) {
      statusSubs.add(fn);
      fn(status);
      return () => statusSubs.delete(fn);
    }
  };
}
