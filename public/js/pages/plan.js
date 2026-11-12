import { icon } from '../components/icons.js';
import { emptyHTML, field } from '../components/ui.js';
import { escapeHtml, todayISO, fmtCN, weekdayCN, addDays, uid, relativeDay } from '../utils.js';
import { plansFor, planProgress } from '../stats.js';

const PRIORITIES = [
  { value: 'high', label: '高' },
  { value: 'mid', label: '中' },
  { value: 'low', label: '低' }
];

const MODULES = [
  { value: '', label: '无' },
  { value: 'content', label: '自媒体' },
  { value: 'dev', label: '开发' },
  { value: 'consult', label: '咨询' },
  { value: 'fitness', label: '健身' },
  { value: 'diet', label: '饮食' },
  { value: 'game', label: '游戏' }
];

const MODULE_LABEL = Object.fromEntries(MODULES.map((m) => [m.value, m.label]));

let selected = todayISO();
let filter = 'open';

function rowHTML(p) {
  return `<div class="list-row" data-id="${escapeHtml(p.id)}">
    <button class="check ${p.done ? 'on' : ''}" data-act="toggle" data-id="${escapeHtml(p.id)}" aria-label="完成">${
    p.done ? icon('check', 10) : ''
  }</button>
    <button class="grow" data-act="edit" data-id="${escapeHtml(p.id)}" style="text-align:left;min-width:0">
      <div class="truncate ${p.done ? 'hint' : ''}" style="${
    p.done ? 'text-decoration:line-through;font-size:13px' : 'font-size:13.5px'
  }">${escapeHtml(p.title)}</div>
      ${p.note ? `<div class="tiny hint truncate" style="margin-top:1px">${escapeHtml(p.note)}</div>` : ''}
    </button>
    ${p.time ? `<span class="chip">${escapeHtml(p.time)}</span>` : ''}
    ${
      p.module
        ? `<span class="chip chip-${escapeHtml(p.module)}">${escapeHtml(MODULE_LABEL[p.module] || p.module)}</span>`
        : ''
    }
    ${p.priority === 'high' ? '<span class="chip chip-warn">高</span>' : ''}
    <div class="row-actions">
      ${p.done ? '' : `<button class="icon-btn" data-act="postpone" data-id="${escapeHtml(p.id)}" title="顺延到明天">${icon('right', 14)}</button>`}
      <button class="icon-btn danger" data-act="del" data-id="${escapeHtml(p.id)}" title="删除">${icon('trash', 14)}</button>
    </div>
  </div>`;
}

function openEditor(ctx, id) {
  const p = ctx.state.plans.find((x) => x.id === id);
  if (!p) return;
  let bodyEl = null;

  ctx.openDrawer({
    title: '编辑任务',
    subtitle: `${fmtCN(p.date)} ${weekdayCN(p.date)}`,
    content: `
      ${field('任务', `<input class="input" id="f-title" value="${escapeHtml(p.title)}" />`)}
      <div class="form-grid">
        ${field(
          '优先级',
          `<select class="select" id="f-priority">${PRIORITIES.map(
            (x) => `<option value="${x.value}" ${p.priority === x.value ? 'selected' : ''}>${x.label}</option>`
          ).join('')}</select>`
        )}
        ${field('时间（可选）', `<input class="input" id="f-time" type="time" value="${escapeHtml(p.time || '')}" />`)}
        ${field(
          '归属模块',
          `<select class="select" id="f-module">${MODULES.map(
            (m) => `<option value="${m.value}" ${(p.module || '') === m.value ? 'selected' : ''}>${m.label}</option>`
          ).join('')}</select>`
        )}
        ${field('日期', `<input class="input" id="f-date" type="date" value="${escapeHtml(p.date)}" />`)}
      </div>
      ${field('备注', `<textarea class="textarea" id="f-note" placeholder="补充说明，可留空">${escapeHtml(p.note || '')}</textarea>`)}
    `,
    onMount: (el) => {
      bodyEl = el;
    },
    footer: [
      {
        label: '删除',
        danger: true,
        align: 'left',
        onClick: async () => {
          const ok = await ctx.confirm({
            title: '删除这条任务',
            message: `「${escapeHtml(p.title)}」将被删除，无法撤销。`,
            confirmText: '删除',
            danger: true
          });
          if (!ok) return false;
          ctx.commit((state) => {
            state.plans = state.plans.filter((x) => x.id !== id);
          });
          return true;
        }
      },
      {
        label: '保存',
        primary: true,
        onClick: () => {
          const body = bodyEl;
          const title = body.querySelector('#f-title').value.trim();
          if (!title) {
            ctx.toast('任务名不能为空', 'error');
            return false;
          }
          ctx.commit((state) => {
            const target = state.plans.find((x) => x.id === id);
            if (!target) return;
            target.title = title;
            target.priority = body.querySelector('#f-priority').value;
            target.time = body.querySelector('#f-time').value || null;
            target.module = body.querySelector('#f-module').value || null;
            target.date = body.querySelector('#f-date').value || target.date;
            target.note = body.querySelector('#f-note').value.trim();
          });
          return true;
        }
      }
    ]
  });
}

export default {
  id: 'plan',
  title: '今日计划',
  subtitle(state) {
    const p = planProgress(state, todayISO());
    return `今天 ${p.total} 件事，已完成 ${p.done} 件`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      const id = el.dataset.id;

      if (act === 'prev') {
        selected = addDays(selected, -1);
        ctx.rerender();
        return;
      }
      if (act === 'next') {
        selected = addDays(selected, 1);
        ctx.rerender();
        return;
      }
      if (act === 'today') {
        selected = todayISO();
        ctx.rerender();
        return;
      }
      if (act === 'filter') {
        filter = el.dataset.filter;
        ctx.rerender();
        return;
      }
      if (act === 'toggle') {
        ctx.commit((state) => {
          const p = state.plans.find((x) => x.id === id);
          if (p) {
            p.done = !p.done;
            p.doneAt = p.done ? new Date().toISOString() : null;
          }
        });
        return;
      }
      if (act === 'postpone') {
        ctx.commit((state) => {
          const p = state.plans.find((x) => x.id === id);
          if (p) p.date = addDays(p.date, 1);
        });
        ctx.toast('已顺延到明天');
        return;
      }
      if (act === 'del') {
        const p = ctx.state.plans.find((x) => x.id === id);
        ctx.confirm({
          title: '删除任务',
          message: `「${escapeHtml(p ? p.title : '')}」将被删除。`,
          confirmText: '删除',
          danger: true
        }).then((ok) => {
          if (!ok) return;
          ctx.commit((state) => {
            state.plans = state.plans.filter((x) => x.id !== id);
          });
        });
        return;
      }
      if (act === 'edit') openEditor(ctx, id);
      if (act === 'add-focus') {
        const input = root.querySelector('#plan-add');
        if (input) input.focus();
      }
    });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.target.id !== 'plan-add') return;
      const title = e.target.value.trim();
      if (!title) return;
      ctx.commit((state) => {
        state.plans.push({
          id: uid('p_'),
          title,
          date: selected,
          done: false,
          doneAt: null,
          priority: 'mid',
          time: null,
          module: null,
          note: '',
          sort: 0,
          createdAt: new Date().toISOString()
        });
      });
      e.target.value = '';
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const all = plansFor(state, selected);
    const open = all.filter((p) => !p.done);
    const done = all.filter((p) => p.done);
    const progress = planProgress(state, selected);
    const isToday = selected === todayISO();

    const shown = filter === 'done' ? done : filter === 'open' ? open : all;

    root.innerHTML = `
      <div class="row-between" style="margin-bottom:16px">
        <div class="row" style="gap:6px">
          <button class="icon-btn" data-act="prev" aria-label="前一天">${icon('left', 16)}</button>
          <div style="min-width:150px;text-align:center">
            <div class="strong" style="font-size:15px">${fmtCN(selected)} ${weekdayCN(selected)}</div>
            <div class="tiny hint">${isToday ? '今天' : relativeDay(selected)} · 完成 ${progress.done}/${
      progress.total
    }</div>
          </div>
          <button class="icon-btn" data-act="next" aria-label="后一天">${icon('right', 16)}</button>
          ${isToday ? '' : `<button class="btn btn-sm" data-act="today" style="margin-left:6px">回到今天</button>`}
        </div>
        <div class="row" style="gap:6px">
          <button class="btn btn-sm ${filter === 'open' ? 'btn-primary' : ''}" data-act="filter" data-filter="open">未完成 ${
      open.length
    }</button>
          <button class="btn btn-sm ${filter === 'done' ? 'btn-primary' : ''}" data-act="filter" data-filter="done">已完成 ${
      done.length
    }</button>
          <button class="btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}" data-act="filter" data-filter="all">全部</button>
        </div>
      </div>

      <section class="card">
        <div class="row" style="gap:8px;margin-bottom:12px">
          <input class="input" id="plan-add" placeholder="今天要做什么？写下来回车就加进去" autocomplete="off" />
          <button class="btn btn-primary" data-act="add-focus">添加</button>
        </div>

        <div class="list">
          ${
            shown.length
              ? shown.map(rowHTML).join('')
              : filter === 'done'
              ? `<div class="list-empty">这一天还没有完成的任务</div>`
              : emptyHTML({
                  iconName: 'plan',
                  title: isToday ? '今天还没安排' : '这一天没有任务',
                  desc: '把脑子里的事写下来，一件一件划掉'
                })
          }
        </div>

        ${
          filter === 'open' && done.length
            ? `<div class="completed-block">
                <div class="tiny hint" style="padding:4px 0">已完成 ${done.length} 件</div>
                ${done.map(rowHTML).join('')}
              </div>`
            : ''
        }
      </section>

      <div class="tiny hint" style="margin-top:10px;text-align:center">
        点任务可以编辑优先级、时间和所属模块 · 箭头按钮把它顺延到明天
      </div>
    `;
  }
};
