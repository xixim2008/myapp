/**
 * 服务端默认数据。结构定义与校验来自 public/js/schema.js（前后端共用一份）。
 */
import { SCHEMA_VERSION, DATA_KEYS, validateData } from '../public/js/schema.js';

export { SCHEMA_VERSION, DATA_KEYS, validateData };

export function createDefaults() {
  const data = {
    schemaVersion: SCHEMA_VERSION,
    rev: 0, // 写入版本号：每次保存 +1，用于挡住旧页面用陈旧数据覆盖新数据
    settings: {
      weekStart: 1, // 1 = 周一，0 = 周日
      theme: 'light',
      lastSavedAt: null
    }
  };
  for (const key of DATA_KEYS) data[key] = [];
  return data;
}
