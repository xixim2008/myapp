import test from 'node:test';
import assert from 'node:assert/strict';
import { lineChartHTML, barChartHTML, legendHTML } from '../public/js/charts.js';

test('折线图：有数据时输出坐标、网格和数据点', () => {
  const html = lineChartHTML({
    labels: ['2026-11-10', '2026-11-11', '2026-11-12'],
    series: [{ name: '播放', color: '#000', values: [100, 200, 300] }],
    height: 200
  });
  assert.ok(html.includes('<svg'), '应输出 svg');
  assert.ok(html.includes('<polyline'), '应输出折线');
  assert.ok((html.match(/<circle/g) || []).length === 3, '每个点一个圆');
  assert.ok(html.includes('11/12'), '应包含末尾日期标签');
});

test('折线图：无数据或全 0 时给出空提示而不是空白图', () => {
  const html = lineChartHTML({ labels: ['a', 'b'], series: [{ name: 'x', color: '#000', values: [0, 0] }] });
  assert.match(html, /还没有数据/);
});

test('柱状图：数值、标签与顶部数值都出现', () => {
  const html = barChartHTML({
    items: [
      { label: '抖音', value: 12000 },
      { label: '小红书', value: 3000 }
    ],
    height: 180
  });
  assert.ok(html.includes('<rect'), '应输出柱子');
  assert.ok(html.includes('抖音') && html.includes('小红书'));
  assert.ok(html.includes('1.2万'), '顶部数值应缩写为万');
});

test('柱状图：无数据时空提示', () => {
  assert.match(barChartHTML({ items: [] }), /还没有数据/);
});

test('图例输出颜色与名称', () => {
  const html = legendHTML([{ name: '播放量', color: '#111' }]);
  assert.ok(html.includes('播放量') && html.includes('#111'));
});
