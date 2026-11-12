/**
 * 所有统计口径集中在这里，纯函数、无 DOM。
 * 页面直接 import，Node 测试也 import 同一份 —— 保证「页面显示的数字」和「测试断言的口径」一致。
 */
import { addDays, todayISO, weekRange, monthKey, startOfWeek, inRange, sumBy, groupBy } from './utils.js';

export const PLATFORMS = {
  douyin: { label: '抖音', color: '#1c1b19' },
  kuaishou: { label: '快手', color: '#b04a3e' },
  xhs: { label: '小红书', color: '#c0392b' }
};

export const CONTENT_STATUS = {
  idea: { label: '选题', color: 'var(--text-3)' },
  producing: { label: '制作中', color: 'var(--warning)' },
  ready: { label: '待发布', color: 'var(--info)' },
  published: { label: '已发布', color: 'var(--success)' }
};

export const PARTS = [
  { key: 'chest', label: '胸', color: 'var(--part-chest)' },
  { key: 'back', label: '背', color: 'var(--part-back)' },
  { key: 'leg', label: '腿', color: 'var(--part-leg)' },
  { key: 'shoulder', label: '肩', color: 'var(--part-shoulder)' },
  { key: 'arm', label: '手臂', color: 'var(--part-arm)' },
  { key: 'core', label: '核心', color: 'var(--part-core)' },
  { key: 'cardio', label: '有氧', color: 'var(--part-cardio)' }
];

const PRIORITY_WEIGHT = { high: 0, mid: 1, low: 2 };

/* ---------------- 今日计划 ---------------- */

export function plansFor(state, iso) {
  return (state.plans || [])
    .filter((p) => p.date === iso)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const wa = PRIORITY_WEIGHT[a.priority] ?? 1;
      const wb = PRIORITY_WEIGHT[b.priority] ?? 1;
      if (wa !== wb) return wa - wb;
      const ta = a.time || '99:99';
      const tb = b.time || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });
}

export function planProgress(state, iso) {
  const list = plansFor(state, iso);
  const done = list.filter((p) => p.done).length;
  return { done, total: list.length, ratio: list.length ? done / list.length : 0 };
}

export function openPlansCount(state, iso) {
  return plansFor(state, iso).filter((p) => !p.done).length;
}

/* ---------------- 自媒体 ---------------- */

export function weekPublishCount(state, refISO, weekStart = 1) {
  const { start, end } = weekRange(refISO, weekStart);
  return (state.contents || []).filter(
    (c) => c.status === 'published' && c.publishDate && inRange(c.publishDate, start, end)
  ).length;
}

function latestMetric(state, contentId, onOrBefore = null) {
  const list = (state.contentMetrics || [])
    .filter((m) => m.contentId === contentId && (!onOrBefore || m.date <= onOrBefore))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return list[list.length - 1] || null;
}

/** 近 N 天的累计播放与粉丝趋势（快照按「当日及之前的最新一条」取值） */
export function contentTrend(state, days = 30, endISO = todayISO()) {
  const labels = [];
  const views = [];
  const fans = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDays(endISO, -i);
    labels.push(day);
    let v = 0;
    let f = 0;
    for (const c of state.contents || []) {
      const m = latestMetric(state, c.id, day);
      if (m) {
        v += Number(m.views) || 0;
        f += Number(m.fans) || 0;
      }
    }
    views.push(v);
    fans.push(f);
  }
  return { labels, views, fans };
}

export function platformStats(state) {
  const published = (state.contents || []).filter((c) => c.status === 'published');
  return Object.entries(PLATFORMS).map(([key, meta]) => {
    const items = published.filter((c) => (c.platforms || []).includes(key));
    const views = items.map((c) => {
      const m = latestMetric(state, c.id);
      return m ? Number(m.views) || 0 : 0;
    });
    const total = views.reduce((a, b) => a + b, 0);
    return {
      key,
      label: meta.label,
      count: items.length,
      totalViews: total,
      avgViews: views.length ? Math.round(total / views.length) : 0
    };
  });
}

export function contentTotals(state) {
  const items = state.contents || [];
  let views = 0;
  let fans = 0;
  let likes = 0;
  for (const c of items) {
    const m = latestMetric(state, c.id);
    if (!m) continue;
    views += Number(m.views) || 0;
    fans += Number(m.fans) || 0;
    likes += Number(m.likes) || 0;
  }
  return { views, fans, likes, published: items.filter((c) => c.status === 'published').length };
}

/* ---------------- 开发工作 ---------------- */

export function devStats(state, today) {
  const tasks = state.devTasks || [];
  const open = tasks.filter((t) => t.status !== 'done');
  return {
    open: open.length,
    dueToday: open.filter((t) => t.dueDate === today).length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < today).length
  };
}

/* ---------------- 咨询工作 ---------------- */

export function monthConsultIncome(state, iso) {
  const key = monthKey(iso);
  return sumBy(
    (state.sessions || []).filter((s) => monthKey(s.date) === key),
    (s) => s.fee
  );
}

export function incomeByMonth(state, months = 6, endISO) {
  const result = [];
  const end = new Date(endISO);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({
      key,
      label: `${d.getMonth() + 1} 月`,
      value: sumBy(
        (state.sessions || []).filter((s) => monthKey(s.date) === key),
        (s) => s.fee
      )
    });
  }
  return result;
}

export function incomeByClient(state) {
  const map = groupBy(state.sessions || [], (s) => s.clientId);
  return (state.clients || [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      value: sumBy(map.get(c.id) || [], (s) => s.fee),
      count: (map.get(c.id) || []).length
    }))
    .sort((a, b) => b.value - a.value);
}

export function followUpClients(state, today) {
  return (state.clients || [])
    .filter((c) => c.nextFollowUp && c.nextFollowUp <= today)
    .sort((a, b) => (a.nextFollowUp < b.nextFollowUp ? -1 : 1));
}

export function clientSummary(state, clientId) {
  const sessions = (state.sessions || []).filter((s) => s.clientId === clientId);
  return {
    count: sessions.length,
    fee: sumBy(sessions, (s) => s.fee),
    last: sessions.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null
  };
}

/* ---------------- 健身 ---------------- */

export function weekWorkoutDays(state, refISO, weekStart = 1) {
  const { start, end } = weekRange(refISO, weekStart);
  const days = new Set(
    (state.workouts || []).filter((w) => inRange(w.date, start, end)).map((w) => w.date)
  );
  return days.size;
}

export function workoutsOn(state, iso) {
  return (state.workouts || []).filter((w) => w.date === iso);
}

export function workoutVolume(workout) {
  return sumBy(workout.exercises || [], (e) => (Number(e.sets) || 0) * (Number(e.reps) || 0));
}

export function partFrequency(state, refISO, weekStart = 1) {
  const { start, end } = weekRange(refISO, weekStart);
  const counter = {};
  for (const w of state.workouts || []) {
    if (!inRange(w.date, start, end)) continue;
    for (const p of w.parts || []) counter[p] = (counter[p] || 0) + 1;
  }
  return PARTS.map((p) => ({ ...p, count: counter[p.key] || 0 }));
}

export function exerciseCandidates(state, limit = 50) {
  const seen = new Map();
  for (const w of state.workouts || []) {
    for (const e of w.exercises || []) {
      const name = (e.name || '').trim();
      if (!name) continue;
      seen.set(name, (seen.get(name) || 0) + 1);
    }
  }
  return Array.from(seen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

/* ---------------- 饮食 ---------------- */

export function mealOn(state, iso) {
  return (state.meals || []).find((m) => m.date === iso) || null;
}

export function mealSummary(meal) {
  if (!meal) return { recorded: 0, water: 0 };
  const slots = [meal.breakfast, meal.lunch, meal.dinner, meal.snack];
  const recorded = slots.filter((s) => Array.isArray(s) && s.filter(Boolean).length > 0).length;
  return { recorded, water: Number(meal.water) || 0 };
}

/* ---------------- 游戏 ---------------- */

export function gameStats(state, refISO) {
  const key = monthKey(refISO);
  const monthLogs = (state.playLogs || []).filter((l) => monthKey(l.date) === key);
  const monthMinutes = sumBy(monthLogs, (l) => l.minutes);
  const start28 = addDays(refISO, -27);
  const recent = sumBy(
    (state.playLogs || []).filter((l) => l.date >= start28 && l.date <= refISO),
    (l) => l.minutes
  );
  const byGame = groupBy(monthLogs, (l) => l.gameId);
  const top = (state.games || [])
    .map((g) => ({
      id: g.id,
      title: g.title,
      minutes: sumBy(byGame.get(g.id) || [], (l) => l.minutes)
    }))
    .filter((g) => g.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);
  return {
    monthMinutes,
    weekAvg: Math.round(recent / 4),
    top
  };
}

export function gameMinutes(state, gameId) {
  return sumBy(
    (state.playLogs || []).filter((l) => l.gameId === gameId),
    (l) => l.minutes
  );
}

/* ---------------- 概览 ---------------- */

export function moduleCounts(state) {
  return [
    { key: 'plans', label: '今日计划', count: (state.plans || []).length },
    { key: 'memos', label: '快速备忘', count: (state.memos || []).length },
    { key: 'contents', label: '自媒体内容', count: (state.contents || []).length },
    { key: 'contentMetrics', label: '自媒体数据', count: (state.contentMetrics || []).length },
    { key: 'projects', label: '开发项目', count: (state.projects || []).length },
    { key: 'devTasks', label: '开发工作项', count: (state.devTasks || []).length },
    { key: 'clients', label: '咨询客户', count: (state.clients || []).length },
    { key: 'sessions', label: '咨询记录', count: (state.sessions || []).length },
    { key: 'clientGoals', label: '客户目标', count: (state.clientGoals || []).length },
    { key: 'workouts', label: '训练记录', count: (state.workouts || []).length },
    { key: 'meals', label: '饮食记录', count: (state.meals || []).length },
    { key: 'games', label: '游戏', count: (state.games || []).length },
    { key: 'playLogs', label: '游玩记录', count: (state.playLogs || []).length }
  ];
}

export { startOfWeek, sumBy };
