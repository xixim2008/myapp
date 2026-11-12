import { icon } from '../components/icons.js';
import { emptyHTML, field } from '../components/ui.js';
import { lineChartHTML, barChartHTML, legendHTML } from '../charts.js';
import { addToPlan } from '../actions.js';
import { escapeHtml, todayISO, fmtCN, fmtNum, uid } from '../utils.js';
import {
  PLATFORMS,
  CONTENT_STATUS,
  contentTotals,
  contentTrend,
  platformStats,
  weekPublishCount
} from '../stats.js';

const STATUS_ORDER = ['idea', 'producing', 'ready', 'published'];
const TYPE_LABEL = { video: '视频', note: '图文' };

let view = 'board';

function platformChips(item) {
  return (item.platforms || [])
    .map((p) => `<span class="chip chip-soft">${escapeHtml((PLATFORMS[p] || {}).label || p)}</span>`)
    .join('');
}

function latestViews(state, id) {
  const list = state.contentMetrics
    .filter((m) => m.contentId === id)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = list[list.length - 1];
  return last ? Number(last.views) || 0 : 0;
}

function cardHTML(ctx, item) {
  const idx = STATUS_ORDER.indexOf(item.status);
  const views = latestViews(ctx.state, item.id);
  return `<div class="kcard" draggable="false">
    <div class="row" style="align-items:flex-start;gap:6px">
      <button class="grow" data-act="edit" data-id="${escapeHtml(item.id)}" style="text-align:left">
        <div class="kcard-title">${escapeHtml(item.title)}</div>
      </button>
      <button class="icon-btn" data-act="move" data-dir="-1" data-id="${escapeHtml(item.id)}" ${
    idx <= 0 ? 'disabled style="opacity:.25"' : ''
  } title="上一状态">${icon('left', 13)}</button>
      <button class="icon-btn" data-act="move" data-dir="1" data-id="${escapeHtml(item.id)}" ${
    idx >= 3 ? 'disabled style="opacity:.25"' : ''
  } title="下一状态">${icon('right', 13)}</button>
    </div>
    <div class="kcard-meta">
      ${platformChips(item)}
      <span class="chip">${TYPE_LABEL[item.type] || '视频'}</span>
    </div>
    ${
      views
        ? `<div class="tiny hint" style="margin-top:6px">播放 ${fmtNum(views)}</div>`
        : item.planDate
        ? `<div class="tiny hint" style="margin-top:6px">计划 ${fmtCN(item.planDate)}</div>`
        : ''
    }
  </div>`;
}

function openMetricsDrawer(ctx, contentId) {
  const item = ctx.state.contents.find((c) => c.id === contentId);
  if (!item) return;
  const existing = ctx.state.contentMetrics
    .filter((m) => m.contentId === contentId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  let bodyEl = null;

  ctx.openDrawer({
    title: '录入数据',
    subtitle: `${item.title} · 同一天重复录入会覆盖`,
    content: `
      ${field('数据日期', `<input class="input" id="m-date" type="date" value="${escapeHtml(
        existing ? existing.date : item.publishDate || todayISO()
      )}" />`)}
      <div class="form-grid">
        ${field('播放量', `<input class="input" id="m-views" type="number" min="0" value="${existing ? existing.views : 0}" />`)}
        ${field('点赞', `<input class="input" id="m-likes" type="number" min="0" value="${existing ? existing.likes : 0}" />`)}
        ${field('评论', `<input class="input" id="m-comments" type="number" min="0" value="${existing ? existing.comments : 0}" />`)}
        ${field('新增粉丝', `<input class="input" id="m-fans" type="number" min="0" value="${existing ? existing.fans : 0}" />`)}
      </div>
      <p class="tiny hint">这些数字是「截至那一天的累计值」，图表按日期取最新一条画趋势。</p>
    `,
    onMount: (el) => {
      bodyEl = el;
    },
    footer: [
      {
        label: '保存数据',
        primary: true,
        onClick: () => {
          const body = bodyEl;
          const date = body.querySelector('#m-date').value || todayISO();
          const payload = {
            views: Number(body.querySelector('#m-views').value) || 0,
            likes: Number(body.querySelector('#m-likes').value) || 0,
            comments: Number(body.querySelector('#m-comments').value) || 0,
            fans: Number(body.querySelector('#m-fans').value) || 0
          };
          ctx.commit((state) => {
            const found = state.contentMetrics.find((m) => m.contentId === contentId && m.date === date);
            if (found) Object.assign(found, payload);
            else
              state.contentMetrics.push({
                id: uid('cm_'),
                contentId,
                date,
                ...payload
              });
          });
          ctx.toast('数据已记录');
          return true;
        }
      }
    ]
  });
}

function openContentDrawer(ctx, id) {
  const item = ctx.state.contents.find((c) => c.id === id);
  if (!item) return;
  let bodyEl = null;

  ctx.openDrawer({
    title: '编辑内容',
    subtitle: item.publishDate ? `发布于 ${fmtCN(item.publishDate)}` : '还没发布',
    content: `
      ${field('标题 / 选题', `<input class="input" id="c-title" value="${escapeHtml(item.title)}" />`)}
      <div class="field">
        <span class="label">发布平台</span>
        <div class="row" style="gap:14px;flex-wrap:wrap">
          ${Object.entries(PLATFORMS)
            .map(
              ([key, meta]) => `<label class="row" style="gap:6px;cursor:pointer">
                <input type="checkbox" class="c-platform" value="${key}" ${
                (item.platforms || []).includes(key) ? 'checked' : ''
              } />
                <span class="small">${meta.label}</span>
              </label>`
            )
            .join('')}
        </div>
      </div>
      <div class="form-grid">
        ${field(
          '类型',
          `<select class="select" id="c-type">
            <option value="video" ${item.type === 'video' ? 'selected' : ''}>视频</option>
            <option value="note" ${item.type === 'note' ? 'selected' : ''}>图文</option>
          </select>`
        )}
        ${field(
          '状态',
          `<select class="select" id="c-status">
            ${STATUS_ORDER.map(
              (s) =>
                `<option value="${s}" ${item.status === s ? 'selected' : ''}>${CONTENT_STATUS[s].label}</option>`
            ).join('')}
          </select>`
        )}
        ${field('计划发布日', `<input class="input" id="c-plan" type="date" value="${escapeHtml(item.planDate || '')}" />`)}
        ${field('实际发布日', `<input class="input" id="c-publish" type="date" value="${escapeHtml(item.publishDate || '')}" />`)}
      </div>
      ${field('链接', `<input class="input" id="c-link" placeholder="https://…" value="${escapeHtml(item.link || '')}" />`)}
      ${field('脚本要点 / 复盘', `<textarea class="textarea" id="c-note">${escapeHtml(item.note || '')}</textarea>`)}
      <button class="btn btn-sm" data-act="toplan">${icon('plus', 13)} 加入今日计划</button>
    `,
    onMount: (el) => {
      bodyEl = el;
      el.querySelector('[data-act="toplan"]').addEventListener('click', () => {
        addToPlan(ctx, `推进内容：${item.title}`, 'content');
      });
    },
    footer: [
      {
        label: '录数据',
        onClick: () => {
          openMetricsDrawer(ctx, id);
          return true;
        }
      },
      {
        label: '删除',
        danger: true,
        onClick: async () => {
          const ok = await ctx.confirm({
            title: '删除这条内容',
            message: `「${escapeHtml(item.title)}」及其 ${ctx.state.contentMetrics.filter(
              (m) => m.contentId === id
            ).length} 条数据记录都会被删除。`,
            confirmText: '删除',
            danger: true
          });
          if (!ok) return false;
          ctx.commit((state) => {
            state.contents = state.contents.filter((c) => c.id !== id);
            state.contentMetrics = state.contentMetrics.filter((m) => m.contentId !== id);
          });
          return true;
        }
      },
      {
        label: '保存',
        primary: true,
        onClick: () => {
          const title = bodyEl.querySelector('#c-title').value.trim();
          if (!title) {
            ctx.toast('标题不能为空', 'error');
            return false;
          }
          const platforms = Array.from(bodyEl.querySelectorAll('.c-platform:checked')).map((el) => el.value);
          if (!platforms.length) {
            ctx.toast('至少选一个发布平台', 'error');
            return false;
          }
          ctx.commit((state) => {
            const target = state.contents.find((c) => c.id === id);
            if (!target) return;
            target.title = title;
            target.platforms = platforms;
            target.type = bodyEl.querySelector('#c-type').value;
            target.status = bodyEl.querySelector('#c-status').value;
            target.planDate = bodyEl.querySelector('#c-plan').value || null;
            target.publishDate = bodyEl.querySelector('#c-publish').value || null;
            target.link = bodyEl.querySelector('#c-link').value.trim();
            target.note = bodyEl.querySelector('#c-note').value.trim();
          });
          return true;
        }
      }
    ]
  });
}

function openNewDrawer(ctx) {
  let bodyEl = null;
  ctx.openDrawer({
    title: '新建内容',
    subtitle: '先记选题，后面再一步步推进',
    content: `
      ${field('标题 / 选题', '<input class="input" id="c-title" placeholder="这条想讲什么？" />')}
      <div class="field">
        <span class="label">发布平台</span>
        <div class="row" style="gap:14px">
          ${Object.entries(PLATFORMS)
            .map(
              ([key, meta]) => `<label class="row" style="gap:6px;cursor:pointer">
                <input type="checkbox" class="c-platform" value="${key}" ${
                key === 'douyin' ? 'checked' : ''
              } /><span class="small">${meta.label}</span></label>`
            )
            .join('')}
        </div>
      </div>
      <div class="form-grid">
        ${field('类型', `<select class="select" id="c-type"><option value="video">视频</option><option value="note">图文</option></select>`)}
        ${field('计划发布日', `<input class="input" id="c-plan" type="date" value="${todayISO()}" />`)}
      </div>
      ${field('脚本要点 / 备注', '<textarea class="textarea" id="c-note" placeholder="可留空"></textarea>')}
    `,
    onMount: (el) => {
      bodyEl = el;
      setTimeout(() => el.querySelector('#c-title').focus(), 40);
    },
    footer: [
      {
        label: '创建',
        primary: true,
        onClick: () => {
          const title = bodyEl.querySelector('#c-title').value.trim();
          if (!title) {
            ctx.toast('标题不能为空', 'error');
            return false;
          }
          const platforms = Array.from(bodyEl.querySelectorAll('.c-platform:checked')).map((el) => el.value);
          if (!platforms.length) {
            ctx.toast('至少选一个发布平台', 'error');
            return false;
          }
          ctx.commit((state) => {
            state.contents.push({
              id: uid('c_'),
              title,
              platforms,
              type: bodyEl.querySelector('#c-type').value,
              status: 'idea',
              planDate: bodyEl.querySelector('#c-plan').value || null,
              publishDate: null,
              link: '',
              note: bodyEl.querySelector('#c-note').value.trim(),
              createdAt: new Date().toISOString()
            });
          });
          ctx.toast('已添加选题');
          return true;
        }
      }
    ]
  });
}

export default {
  id: 'content',
  title: '自媒体',
  subtitle(state) {
    const week = weekPublishCount(state, todayISO(), (state.settings && state.settings.weekStart) ?? 1);
    const ready = state.contents.filter((c) => c.status === 'ready').length;
    return `本周发布 ${week} 条 · ${ready} 条待发布`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      const id = el.dataset.id;

      if (act === 'new') return openNewDrawer(ctx);
      if (act === 'view') {
        view = el.dataset.view;
        return ctx.rerender();
      }
      if (act === 'edit') return openContentDrawer(ctx, id);
      if (act === 'metrics') return openMetricsDrawer(ctx, id);
      if (act === 'move') {
        const dir = Number(el.dataset.dir);
        ctx.commit((state) => {
          const item = state.contents.find((c) => c.id === id);
          if (!item) return;
          const idx = STATUS_ORDER.indexOf(item.status);
          const next = STATUS_ORDER[Math.min(3, Math.max(0, idx + dir))];
          item.status = next;
          if (next === 'published' && !item.publishDate) item.publishDate = todayISO();
        });
        return;
      }
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const totals = contentTotals(state);
    const week = weekPublishCount(state, todayISO(), (state.settings && state.settings.weekStart) ?? 1);
    const trend = contentTrend(state, 30);
    const platforms = platformStats(state);

    const tabs = [
      { key: 'board', label: '看板', icon: 'grid' },
      { key: 'chart', label: '数据图表', icon: 'chart' },
      { key: 'table', label: '全部表格', icon: 'table' }
    ];

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">已发布</div>
          <div class="metric-value">${totals.published}<small>条</small></div>
          <div class="metric-foot">本周 ${week} 条</div>
        </div>
        <div class="metric">
          <div class="metric-label">累计播放</div>
          <div class="metric-value">${fmtNum(totals.views)}</div>
          <div class="metric-foot">按每条最新一次记录</div>
        </div>
        <div class="metric">
          <div class="metric-label">累计新增粉丝</div>
          <div class="metric-value">${fmtNum(totals.fans)}</div>
          <div class="metric-foot">抖音 / 快手 / 小红书</div>
        </div>
        <div class="metric">
          <div class="metric-label">待发布</div>
          <div class="metric-value">${state.contents.filter((c) => c.status === 'ready').length}<small>条</small></div>
          <div class="metric-foot">制作中 ${state.contents.filter((c) => c.status === 'producing').length} 条</div>
        </div>
      </div>

      <div class="row-between section-gap" style="margin-bottom:14px">
        <div class="tabs" style="margin:0;border:none">
          ${tabs
            .map(
              (t) => `<button class="tab ${view === t.key ? 'active' : ''}" data-act="view" data-view="${t.key}">
              <span class="row" style="gap:6px">${icon(t.icon, 14)}${t.label}</span></button>`
            )
            .join('')}
        </div>
        <button class="btn btn-primary btn-sm" data-act="new">${icon('plus', 13)} 新建内容</button>
      </div>

      ${
        !state.contents.length
          ? `<section class="card">${emptyHTML({
              iconName: 'content',
              title: '还没有内容',
              desc: '先把脑子里的选题记下来，再一条条推到发布',
              actionLabel: '新建第一条',
              action: 'new'
            })}</section>`
          : view === 'board'
          ? renderBoard(ctx, state)
          : view === 'chart'
          ? renderCharts(trend, platforms)
          : renderTable(ctx, state)
      }
    `;
  }
};

function renderBoard(ctx, state) {
  return `<div class="kanban-scroll"><div class="kanban">
    ${STATUS_ORDER.map((status) => {
      const items = state.contents.filter((c) => c.status === status);
      return `<div class="col-panel">
        <div class="col-head">
          <i class="dot" style="background:${CONTENT_STATUS[status].color}"></i>
          <span>${CONTENT_STATUS[status].label}</span>
          <span class="count">${items.length}</span>
        </div>
        ${items.map((item) => cardHTML(ctx, item)).join('')}
        ${
          items.length
            ? ''
            : `<div class="tiny hint" style="padding:10px 4px;text-align:center">空</div>`
        }
      </div>`;
    })}
  </div>
  <p class="tiny hint" style="margin-top:10px">卡片右上角箭头把内容推进到下一个状态；点标题编辑详情、录数据。</p>`;
}

function renderCharts(trend, platforms) {
  const series = [
    { name: '播放量', color: 'var(--m-content)', values: trend.views },
    { name: '新增粉丝', color: 'var(--info)', values: trend.fans }
  ];
  return `<div class="grid grid-2">
    <section class="card">
      <div class="card-head">
        <div class="card-title">${icon('chart', 15)} 近 30 天趋势</div>
        ${legendHTML(series)}
      </div>
      ${lineChartHTML({ labels: trend.labels, series, height: 220 })}
    </section>
    <section class="card">
      <div class="card-head">
        <div class="card-title">${icon('bar', 15)} 各平台平均播放</div>
      </div>
      ${barChartHTML({
        items: platforms.map((p) => ({
          label: p.label,
          value: p.avgViews,
          color: p.key === 'douyin' ? '#1c1b19' : p.key === 'kuaishou' ? '#b04a3e' : '#c0392b'
        })),
        height: 220
      })}
    </section>
  </div>
  <section class="card section-gap">
    <div class="card-head"><div class="card-title">平台明细</div></div>
    <div class="table-wrap" style="border:none">
      <table class="table">
        <thead><tr><th>平台</th><th class="num">发布条数</th><th class="num">总播放</th><th class="num">平均播放</th></tr></thead>
        <tbody>
          ${platforms
            .map(
              (p) => `<tr><td>${p.label}</td><td class="num">${p.count}</td><td class="num">${fmtNum(
                p.totalViews
              )}</td><td class="num">${fmtNum(p.avgViews)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderTable(ctx, state) {
  const rows = state.contents
    .slice()
    .sort((a, b) => ((a.publishDate || a.planDate || '') < (b.publishDate || b.planDate || '') ? 1 : -1));

  return `<div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th style="width:34%">标题</th><th>平台</th><th>类型</th><th>状态</th>
          <th>日期</th><th class="num">播放</th><th class="num">点赞</th><th style="width:90px"></th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((item) => {
            const m = state.contentMetrics
              .filter((x) => x.contentId === item.id)
              .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
            return `<tr>
              <td><button data-act="edit" data-id="${escapeHtml(item.id)}" style="text-align:left">${escapeHtml(
              item.title
            )}</button></td>
              <td><div class="row" style="gap:4px">${platformChips(item)}</div></td>
              <td class="muted">${TYPE_LABEL[item.type] || '视频'}</td>
              <td><span class="chip" style="color:${CONTENT_STATUS[item.status].color}">${
              CONTENT_STATUS[item.status].label
            }</span></td>
              <td class="muted">${item.publishDate ? fmtCN(item.publishDate) : item.planDate ? '计划 ' + fmtCN(item.planDate) : '—'}</td>
              <td class="num">${m ? fmtNum(m.views) : '—'}</td>
              <td class="num">${m ? fmtNum(m.likes) : '—'}</td>
              <td><button class="btn btn-sm" data-act="metrics" data-id="${escapeHtml(item.id)}">录数据</button></td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  </div>`;
}
