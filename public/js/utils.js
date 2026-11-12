/* 通用工具：日期、格式化、ID。纯函数，可被测试直接引用。 */

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const pad2 = (n) => String(n).padStart(2, '0');

export function toISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function monthKey(iso) {
  return String(iso).slice(0, 7);
}

export function yearOf(iso) {
  return Number(String(iso).slice(0, 4));
}

export function monthOf(iso) {
  return Number(String(iso).slice(5, 7)) - 1;
}

/** 一周的开始（weekStart: 1=周一, 0=周日） */
export function startOfWeek(iso, weekStart = 1) {
  const d = parseISO(iso);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}

export function weekRange(iso, weekStart = 1) {
  const start = startOfWeek(iso, weekStart);
  return { start, end: addDays(start, 6) };
}

export function inRange(iso, start, end) {
  return iso >= start && iso <= end;
}

/** 6 行的月历矩阵，返回 ISO 数组的二维数组 */
export function monthMatrix(year, month, weekStart = 1) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const cursor = new Date(year, month, 1 - offset);
  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(toISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  // 最后一行整行都属于下个月时去掉，避免下方多出一条空白
  const last = weeks[weeks.length - 1];
  if (last.every((iso) => monthOf(iso) !== month || yearOf(iso) !== year)) {
    weeks.pop();
  }
  return weeks;
}

export function weekdayOrder(weekStart = 1) {
  return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStart) % 7]);
}

export function weekdayCN(iso) {
  return WEEKDAYS[parseISO(iso).getDay()];
}

export function fmtCN(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function fmtFull(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function fmtMonth(year, month) {
  return `${year} 年 ${month + 1} 月`;
}

export function fmtNum(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('zh-CN');
}

export function fmtMoney(n) {
  return '¥' + fmtNum(Math.round(Number(n) || 0));
}

export function fmtMinutes(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
}

export function fmtHours(min) {
  const m = Math.max(0, Number(min) || 0);
  return (m / 60).toFixed(m % 60 === 0 ? 0 : 1) + ' 小时';
}

export function fileNameStamp(date = new Date()) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(
    date.getHours()
  )}${pad2(date.getMinutes())}`;
}

export function uid(prefix = '') {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7)
  );
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function sumBy(list, pick) {
  return (list || []).reduce((acc, item) => acc + (Number(pick(item)) || 0), 0);
}

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** 模板标签：默认转义插值，避免手写 escape */
export function html(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    const v = values[i];
    if (v === undefined || v === null || v === false) return acc + str;
    if (Array.isArray(v)) return acc + str + v.join('');
    return acc + str + (v && v.__raw ? v.value : escapeHtml(v));
  }, '');
}

export function raw(value) {
  return { __raw: true, value };
}

export function debounce(fn, wait = 200) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function initialOf(name) {
  const s = String(name || '').trim();
  return s ? s.slice(0, 1) : '·';
}

export function daysBetween(a, b) {
  const ms = parseISO(b) - parseISO(a);
  return Math.round(ms / 86400000);
}

export function relativeDay(iso, base = todayISO()) {
  const diff = daysBetween(iso, base);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff > 1 && diff <= 6) return `${diff} 天后`;
  if (diff < -1 && diff >= -6) return `${-diff} 天前`;
  return fmtCN(iso);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
