/**
 * 数据结构定义 + 校验。前端（导入校验）与服务端（写盘校验）共用同一份，
 * 保证「页面允许导入的数据」和「服务端愿意写入的数据」完全一致。
 */

export const SCHEMA_VERSION = 1;

export const DATA_KEYS = [
  'plans',
  'memos',
  'contents',
  'contentMetrics',
  'projects',
  'devTasks',
  'clients',
  'sessions',
  'clientGoals',
  'workouts',
  'meals',
  'games',
  'playLogs'
];

export const MODULE_LABELS = {
  plans: '今日计划',
  memos: '快速备忘',
  contents: '自媒体内容',
  contentMetrics: '自媒体数据',
  projects: '开发项目',
  devTasks: '开发工作项',
  clients: '咨询客户',
  sessions: '咨询记录',
  clientGoals: '客户目标',
  workouts: '训练记录',
  meals: '饮食记录',
  games: '游戏',
  playLogs: '游玩记录'
};

export function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: '数据根节点必须是一个 JSON 对象' };
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `不支持的数据版本：${JSON.stringify(data.schemaVersion)}（当前支持 ${SCHEMA_VERSION}）`
    };
  }
  for (const key of DATA_KEYS) {
    if (!Array.isArray(data[key])) {
      return { ok: false, error: `字段 ${key} 必须是数组` };
    }
  }
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
    return { ok: false, error: '字段 settings 必须是对象' };
  }
  return { ok: true };
}
