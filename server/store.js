import fsDefault from 'node:fs';
import path from 'node:path';
import { createDefaults, validateData, DATA_KEYS, SCHEMA_VERSION } from './defaults.js';

export { validateData };

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 数据仓库：负责读写 data.json，保证不会写出半个文件、不会悄悄覆盖坏文件。
 * 通过 options.fs 可注入文件系统（测试用）。
 */
export function createStore(dir, options = {}) {
  const fs = options.fs || fsDefault;
  const file = path.join(dir, 'data.json');
  const bakFile = path.join(dir, 'data.json.bak');
  const tmpFile = path.join(dir, 'data.json.tmp');
  let corrupted = false;

  function ensureDir() {
    fs.mkdirSync(dir, { recursive: true });
  }

  function readRaw() {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** 写盘：校验 → 旧文件备份 → 写临时文件 → 原子替换 */
  function write(data) {
    const check = validateData(data);
    if (!check.ok) {
      const err = new Error(check.error);
      err.invalid = true;
      throw err;
    }
    ensureDir();

    const raw = readRaw();
    if (raw !== null) {
      let prevValid = false;
      try {
        prevValid = validateData(JSON.parse(raw)).ok;
      } catch {
        prevValid = false;
      }
      if (prevValid) {
        fs.writeFileSync(bakFile, raw, 'utf8');
      } else {
        // 原文件是坏的：先留一份现场，再写新数据，绝不静默丢弃
        fs.writeFileSync(path.join(dir, `data.corrupted-${stamp()}.json`), raw, 'utf8');
      }
    }

    const savedAt = new Date().toISOString();
    const payload = { ...data, settings: { ...data.settings, lastSavedAt: savedAt } };
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpFile, file);
    corrupted = false;
    return savedAt;
  }

  /** 读取：文件不存在则生成默认数据；解析失败则标记损坏并抛错（不覆盖） */
  function read() {
    ensureDir();
    const raw = readRaw();
    if (raw === null) {
      const fresh = createDefaults();
      const savedAt = write(fresh);
      return { ...fresh, settings: { ...fresh.settings, lastSavedAt: savedAt } };
    }
    try {
      const parsed = JSON.parse(raw);
      const check = validateData(parsed);
      if (!check.ok) throw new Error(check.error);
      corrupted = false;
      return parsed;
    } catch (err) {
      corrupted = true;
      const e = new Error(`数据文件已损坏：${err.message}`);
      e.corrupted = true;
      throw e;
    }
  }

  function status() {
    const exists = fs.existsSync(file);
    let size = 0;
    let savedAt = null;
    if (exists) {
      try {
        size = fs.statSync(file).size;
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        savedAt = parsed && parsed.settings ? parsed.settings.lastSavedAt ?? null : null;
      } catch {
        corrupted = true;
      }
    }
    return {
      exists,
      corrupted,
      size,
      savedAt,
      backupExists: fs.existsSync(bakFile),
      file,
      backupFile: bakFile
    };
  }

  return {
    dir,
    file,
    bakFile,
    read,
    write,
    status,
    isCorrupted: () => corrupted
  };
}
