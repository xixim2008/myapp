import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planProgress,
  plansFor,
  weekPublishCount,
  monthConsultIncome,
  weekWorkoutDays,
  contentTrend,
  platformStats,
  incomeByMonth,
  partFrequency,
  mealSummary,
  gameStats,
  followUpClients,
  devStats
} from '../public/js/stats.js';
import { createDefaults } from '../server/defaults.js';

function base() {
  const d = createDefaults();
  return d;
}

const REF = '2026-11-12'; // 周四

test('今日完成率：没有任务时返回 0/0 且不报错', () => {
  const p = planProgress(base(), REF);
  assert.equal(p.total, 0);
  assert.equal(p.done, 0);
  assert.equal(p.ratio, 0);
});

test('今日完成率：3 条完成 1 条 = 1/3', () => {
  const s = base();
  s.plans = [
    { id: 'a', title: 'A', date: REF, done: true, priority: 'mid' },
    { id: 'b', title: 'B', date: REF, done: false, priority: 'high' },
    { id: 'c', title: 'C', date: REF, done: false, priority: 'low' }
  ];
  const p = planProgress(s, REF);
  assert.equal(p.done, 1);
  assert.equal(p.total, 3);
  assert.ok(Math.abs(p.ratio - 1 / 3) < 1e-9);
});

test('今日计划排序：未完成在前，高优先级在前', () => {
  const s = base();
  s.plans = [
    { id: 'a', title: '低', date: REF, done: false, priority: 'low' },
    { id: 'b', title: '高', date: REF, done: false, priority: 'high' },
    { id: 'c', title: '完成', date: REF, done: true, priority: 'high' }
  ];
  assert.deepEqual(
    plansFor(s, REF).map((p) => p.title),
    ['高', '低', '完成']
  );
});

test('本周发布只统计周区间内的已发布内容', () => {
  const s = base();
  s.contents = [
    { id: '1', status: 'published', publishDate: '2026-11-08' }, // 上周日
    { id: '2', status: 'published', publishDate: '2026-11-09' }, // 本周一
    { id: '3', status: 'published', publishDate: '2026-11-15' }, // 本周日
    { id: '4', status: 'published', publishDate: '2026-11-16' }, // 下周一
    { id: '5', status: 'ready', publishDate: null }
  ];
  assert.equal(weekPublishCount(s, REF, 1), 2);
});

test('本月咨询收入只累加当月记录', () => {
  const s = base();
  s.sessions = [
    { id: '1', date: '2026-11-02', fee: 300 },
    { id: '2', date: '2026-11-30', fee: 500 },
    { id: '3', date: '2026-10-31', fee: 900 },
    { id: '4', date: '2026-11-15', fee: 0 }
  ];
  assert.equal(monthConsultIncome(s, REF), 800);
});

test('本周训练天数：同一天多条记录只算 1 天', () => {
  const s = base();
  s.workouts = [
    { id: '1', date: '2026-11-09', parts: ['chest'] },
    { id: '2', date: '2026-11-09', parts: ['arm'] },
    { id: '3', date: '2026-11-11', parts: ['leg'] },
    { id: '4', date: '2026-11-02', parts: ['back'] }
  ];
  assert.equal(weekWorkoutDays(s, REF, 1), 2);
});

test('趋势：按每日累计快照取值，缺失日期补 0', () => {
  const s = base();
  s.contents = [{ id: 'c1', status: 'published', publishDate: '2026-11-10' }];
  s.contentMetrics = [
    { id: 'm1', contentId: 'c1', date: '2026-11-10', views: 1000, fans: 10 },
    { id: 'm2', contentId: 'c1', date: '2026-11-12', views: 3000, fans: 40 }
  ];
  const trend = contentTrend(s, 3, REF);
  assert.deepEqual(trend.labels, ['2026-11-10', '2026-11-11', '2026-11-12']);
  assert.deepEqual(trend.views, [1000, 1000, 3000]);
  assert.deepEqual(trend.fans, [10, 10, 40]);
});

test('平台统计：一条内容挂两个平台，两边各计 1 条', () => {
  const s = base();
  s.contents = [
    { id: 'c1', status: 'published', platforms: ['douyin', 'xhs'] },
    { id: 'c2', status: 'published', platforms: ['douyin'] },
    { id: 'c3', status: 'idea', platforms: ['xhs'] }
  ];
  s.contentMetrics = [
    { id: 'm1', contentId: 'c1', date: '2026-11-01', views: 100 },
    { id: 'm2', contentId: 'c2', date: '2026-11-01', views: 300 }
  ];
  const stats = platformStats(s);
  const douyin = stats.find((x) => x.key === 'douyin');
  const xhs = stats.find((x) => x.key === 'xhs');
  assert.equal(douyin.count, 2);
  assert.equal(douyin.avgViews, 200);
  assert.equal(xhs.count, 1);
  assert.equal(xhs.avgViews, 100);
});

test('收入按月聚合，跨年不串月', () => {
  const s = base();
  s.sessions = [
    { id: '1', date: '2025-12-20', fee: 100 },
    { id: '2', date: '2026-01-05', fee: 200 },
    { id: '3', date: '2026-01-20', fee: 300 }
  ];
  const rows = incomeByMonth(s, 3, '2026-01-15');
  assert.deepEqual(
    rows.map((r) => r.key),
    ['2025-11', '2025-12', '2026-01']
  );
  assert.equal(rows[1].value, 100);
  assert.equal(rows[2].value, 500); // 1-20 在参考日之后，但仍属于本月，按整月统计
});

test('部位频次统计本周训练', () => {
  const s = base();
  s.workouts = [
    { id: '1', date: '2026-11-09', parts: ['chest', 'arm'] },
    { id: '2', date: '2026-11-11', parts: ['chest'] }
  ];
  const freq = partFrequency(s, REF, 1);
  assert.equal(freq.find((f) => f.key === 'chest').count, 2);
  assert.equal(freq.find((f) => f.key === 'leg').count, 0);
});

test('饮食：任一条非空即算三餐已记录', () => {
  assert.deepEqual(mealSummary(null), { recorded: 0, water: 0 });
  assert.deepEqual(
    mealSummary({ breakfast: ['鸡蛋'], lunch: [], dinner: ['饭'], snack: [''], water: 3 }),
    { recorded: 2, water: 3 }
  );
});

test('游戏：本月总时长与四周年均', () => {
  const s = base();
  s.games = [
    { id: 'g1', title: '游戏一' },
    { id: 'g2', title: '游戏二' }
  ];
  s.playLogs = [
    { id: '1', gameId: 'g1', date: '2026-11-01', minutes: 60 },
    { id: '2', gameId: 'g1', date: '2026-11-11', minutes: 60 },
    { id: '3', gameId: 'g2', date: '2026-10-01', minutes: 500 }
  ];
  const st = gameStats(s, REF);
  assert.equal(st.monthMinutes, 120);
  assert.equal(st.weekAvg, 30); // 近 28 天共 120 分钟 / 4 周
  assert.equal(st.top[0].id, 'g1');
});

test('待跟进客户：到期日 <= 今天', () => {
  const s = base();
  s.clients = [
    { id: '1', name: 'A', nextFollowUp: '2026-11-10' },
    { id: '2', name: 'B', nextFollowUp: '2026-11-14' },
    { id: '3', name: 'C', nextFollowUp: null }
  ];
  assert.deepEqual(
    followUpClients(s, REF).map((c) => c.name),
    ['A']
  );
});

test('开发工作：逾期与今天到期分开统计', () => {
  const s = base();
  s.devTasks = [
    { id: '1', status: 'todo', dueDate: '2026-11-11' },
    { id: '2', status: 'doing', dueDate: '2026-11-12' },
    { id: '3', status: 'done', dueDate: '2026-11-01' },
    { id: '4', status: 'todo', dueDate: null }
  ];
  const st = devStats(s, REF);
  assert.equal(st.open, 3);
  assert.equal(st.overdue, 1);
  assert.equal(st.dueToday, 1);
});
