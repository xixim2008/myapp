import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthMatrix,
  addDays,
  startOfWeek,
  weekRange,
  addDays as add,
  monthKey,
  fmtMinutes,
  weekdayOrder,
  daysBetween
} from '../public/js/utils.js';

test('月历矩阵：2026 年 11 月，周一起始，首行从 10 月 26 日开始', () => {
  const weeks = monthMatrix(2026, 10, 1);
  assert.equal(weeks[0][0], '2026-10-26');
  assert.equal(weeks[0].length, 7);
  assert.ok(weeks.every((w) => w.length === 7));
  const novDays = weeks.flat().filter((iso) => iso.startsWith('2026-11'));
  assert.equal(novDays.length, 30);
});

test('月历矩阵：周日起始时首行从 11 月 1 日开始', () => {
  const weeks = monthMatrix(2026, 10, 0);
  assert.equal(weeks[0][0], '2026-11-01');
});

test('月历矩阵：闰年 2 月有 29 天', () => {
  const weeks = monthMatrix(2028, 1, 1);
  const feb = weeks.flat().filter((iso) => iso.startsWith('2028-02'));
  assert.equal(feb.length, 29);
  assert.equal(feb[feb.length - 1], '2028-02-29');
});

test('月历矩阵：平年 2 月 28 天', () => {
  const weeks = monthMatrix(2026, 1, 1);
  const feb = weeks.flat().filter((iso) => iso.startsWith('2026-02'));
  assert.equal(feb.length, 28);
});

test('日期加减跨月跨年', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(add('2026-11-12', 7), '2026-11-19');
});

test('一周起始日随设置变化', () => {
  assert.equal(startOfWeek('2026-11-12', 1), '2026-11-09');
  assert.equal(startOfWeek('2026-11-12', 0), '2026-11-08');
  const range = weekRange('2026-11-12', 1);
  assert.equal(range.start, '2026-11-09');
  assert.equal(range.end, '2026-11-15');
});

test('月份键与天数差', () => {
  assert.equal(monthKey('2026-11-12'), '2026-11');
  assert.equal(daysBetween('2026-11-09', '2026-11-12'), 3);
  assert.equal(daysBetween('2026-11-12', '2026-11-09'), -3);
});

test('时长格式化', () => {
  assert.equal(fmtMinutes(45), '45 分钟');
  assert.equal(fmtMinutes(90), '1 小时 30 分');
  assert.equal(fmtMinutes(120), '2 小时');
  assert.equal(fmtMinutes(0), '0 分钟');
});

test('周标题顺序随起始日变化', () => {
  assert.deepEqual(weekdayOrder(1), ['一', '二', '三', '四', '五', '六', '日']);
  assert.deepEqual(weekdayOrder(0), ['日', '一', '二', '三', '四', '五', '六']);
});
