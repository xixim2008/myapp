import { icon } from '../components/icons.js';
import { emptyHTML, field } from '../components/ui.js';
import { addToPlan } from '../actions.js';
import { escapeHtml, todayISO, fmtCN, uid, relativeDay } from '../utils.js';
import { devStats } from '../stats.js';

const COLUMNS = [
  { key: 'todo', label: '待办' },
  { key: 'doing', label: '进行中' },
  { key: 'done', label: '已完成' }
];

const COLORS = ['#b04a3e', '#2f5d9e', '#5b4b9e', '#a2632b', '#49773c', '#8a3e63'];
const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };

let selectedProject = null;

function currentProject(state) {
  if (selectedProject && state.projects.some((p) => p.id === selectedProject)) return selectedProject;
  return state.projects[0] ? state.projects[0].id : null;
}

function taskCard(t) {
  const overdue = t.dueDate && t.dueDate < todayISO() && t.status !== 'done';
  return `<div class="kcard" draggable="true" data-task="${escapeHtml(t.id)}">
    <button data-act="edit-task" data-id="${escapeHtml(t.id)}" style="text-align:left;width:100%">
      <div class="kcard-title">${escapeHtml(t.title)}</div>
    </button>
    <div class="kcard-meta">
      ${t.priority === 'high' ? '<span class="chip chip-warn">高</span>' : ''}
      ${(t.tags || []).map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}
      ${
        t.dueDate
          ? `<span class="chip ${overdue ? 'chip-danger' : ''}">${
              overdue ? '逾期 ' : ''
            }${fmtCN(t.dueDate)}</span>`
          : ''
      }
    </div>
  </div>`;
}

function openTaskDrawer(ctx, id, projectId, presetStatus = 'todo') {
  const existing = id ? ctx.state.devTasks.find((t) => t.id === id) : null;
  const t = existing || {
    title: '',
    status: presetStatus,
    priority: 'mid',
    dueDate: null,
    tags: [],
    note: ''
  };
  let bodyEl = null;

  ctx.openDrawer({
    title: existing ? '编辑工作项' : '新增工作项',
    subtitle: existing ? '' : '先写清楚要做什么，再排优先级',
    content: `
      ${field('工作项', `<input class="input" id="t-title" placeholder="例如：把登录页接上真实接口" value="${escapeHtml(
        t.title
      )}" />`)}
      <div class="form-grid">
        ${field(
          '状态',
          `<select class="select" id="t-status">${COLUMNS.map(
            (c) => `<option value="${c.key}" ${t.status === c.key ? 'selected' : ''}>${c.label}</option>`
          ).join('')}</select>`
        )}
        ${field(
          '优先级',
          `<select class="select" id="t-priority">${['high', 'mid', 'low']
            .map((p) => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${PRIORITY_LABEL[p]}</option>`)
            .join('')}</select>`
        )}
        ${field('截止日', `<input class="input" id="t-due" type="date" value="${escapeHtml(t.dueDate || '')}" />`)}
        ${field('标签', `<input class="input" id="t-tags" placeholder="用逗号分隔" value="${escapeHtml(
          (t.tags || []).join(', ')
        )}" />`)}
      </div>
      ${field('备注', `<textarea class="textarea" id="t-note" placeholder="可留空">${escapeHtml(t.note || '')}</textarea>`)}
      <button class="btn btn-sm" data-act="toplan">${icon('plus', 13)} 加入今日计划</button>
    `,
    onMount: (el) => {
      bodyEl = el;
      setTimeout(() => el.querySelector('#t-title').focus(), 40);
      el.querySelector('[data-act="toplan"]').addEventListener('click', () => {
        const title = bodyEl.querySelector('#t-title').value.trim() || '开发工作项';
        addToPlan(ctx, title, 'dev');
      });
    },
    footer: existing
      ? [
          {
            label: '删除',
            danger: true,
            align: 'left',
            onClick: async () => {
              const ok = await ctx.confirm({
                title: '删除工作项',
                message: `「${escapeHtml(existing.title)}」将被删除。`,
                confirmText: '删除',
                danger: true
              });
              if (!ok) return false;
              ctx.commit((state) => {
                state.devTasks = state.devTasks.filter((x) => x.id !== id);
              });
              return true;
            }
          },
          { label: '保存', primary: true, onClick: () => saveTask(ctx, bodyEl, id, projectId) }
        ]
      : [{ label: '添加', primary: true, onClick: () => saveTask(ctx, bodyEl, null, projectId) }]
  });
}

function saveTask(ctx, bodyEl, id, projectId) {
  const title = bodyEl.querySelector('#t-title').value.trim();
  if (!title) {
    ctx.toast('工作项名称不能为空', 'error');
    return false;
  }
  const data = {
    title,
    status: bodyEl.querySelector('#t-status').value,
    priority: bodyEl.querySelector('#t-priority').value,
    dueDate: bodyEl.querySelector('#t-due').value || null,
    tags: bodyEl
      .querySelector('#t-tags')
      .value.split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
    note: bodyEl.querySelector('#t-note').value.trim()
  };
  ctx.commit((state) => {
    if (id) {
      const t = state.devTasks.find((x) => x.id === id);
      if (!t) return;
      const wasDone = t.status === 'done';
      Object.assign(t, data);
      if (data.status === 'done' && !wasDone) t.doneAt = new Date().toISOString();
      if (data.status !== 'done') t.doneAt = null;
    } else {
      state.devTasks.push({
        id: uid('t_'),
        projectId,
        ...data,
        doneAt: data.status === 'done' ? new Date().toISOString() : null,
        createdAt: new Date().toISOString()
      });
    }
  });
  return true;
}

function openProjectDrawer(ctx, id) {
  const existing = id ? ctx.state.projects.find((p) => p.id === id) : null;
  const p = existing || { name: '', color: COLORS[0], status: 'active', note: '' };
  let bodyEl = null;

  ctx.openDrawer({
    title: existing ? '编辑项目' : '新建项目',
    content: `
      ${field('项目名称', `<input class="input" id="p-name" placeholder="例如：个人工作台" value="${escapeHtml(p.name)}" />`)}
      <div class="form-grid">
        ${field(
          '状态',
          `<select class="select" id="p-status">
            <option value="active" ${p.status === 'active' ? 'selected' : ''}>进行中</option>
            <option value="paused" ${p.status === 'paused' ? 'selected' : ''}>暂停</option>
            <option value="done" ${p.status === 'done' ? 'selected' : ''}>已完成</option>
          </select>`
        )}
        <div class="field">
          <span class="label">颜色</span>
          <div class="row" style="gap:8px">
            ${COLORS.map(
              (c) =>
                `<button class="p-color" data-color="${c}" style="width:22px;height:22px;border-radius:50%;background:${c};border:${
                  p.color === c ? '2px solid var(--text)' : '2px solid transparent'
                }"></button>`
            ).join('')}
          </div>
        </div>
      </div>
      ${field('备注', `<textarea class="textarea" id="p-note">${escapeHtml(p.note || '')}</textarea>`)}
    `,
    onMount: (el) => {
      bodyEl = el;
      setTimeout(() => el.querySelector('#p-name').focus(), 40);
      el.querySelectorAll('.p-color').forEach((btn) => {
        btn.addEventListener('click', () => {
          el.dataset.color = btn.dataset.color;
          el.querySelectorAll('.p-color').forEach((b) => (b.style.borderColor = 'transparent'));
          btn.style.borderColor = 'var(--text)';
        });
      });
    },
    footer: existing
      ? [
          {
            label: '删除项目',
            danger: true,
            align: 'left',
            onClick: async () => {
              const count = ctx.state.devTasks.filter((t) => t.projectId === id).length;
              const ok = await ctx.confirm({
                title: '删除项目',
                message: `「${escapeHtml(existing.name)}」及其 ${count} 个工作项都会被删除，无法撤销。`,
                confirmText: '删除',
                danger: true
              });
              if (!ok) return false;
              ctx.commit((state) => {
                state.projects = state.projects.filter((x) => x.id !== id);
                state.devTasks = state.devTasks.filter((t) => t.projectId !== id);
              });
              selectedProject = null;
              return true;
            }
          },
          { label: '保存', primary: true, onClick: () => saveProject(ctx, bodyEl, id) }
        ]
      : [{ label: '创建', primary: true, onClick: () => saveProject(ctx, bodyEl, null) }]
  });
}

function saveProject(ctx, bodyEl, id) {
  const name = bodyEl.querySelector('#p-name').value.trim();
  if (!name) {
    ctx.toast('项目名称不能为空', 'error');
    return false;
  }
  const color = bodyEl.dataset.color || COLORS[0];
  const status = bodyEl.querySelector('#p-status').value;
  const note = bodyEl.querySelector('#p-note').value.trim();
  let newId = null;
  ctx.commit((state) => {
    if (id) {
      const p = state.projects.find((x) => x.id === id);
      if (p) Object.assign(p, { name, color, status, note });
    } else {
      newId = uid('pr_');
      state.projects.push({
        id: newId,
        name,
        color,
        status,
        note,
        createdAt: new Date().toISOString()
      });
    }
  });
  if (newId) selectedProject = newId;
  return true;
}

export default {
  id: 'dev',
  title: '开发工作',
  subtitle(state) {
    const s = devStats(state, todayISO());
    return `${state.projects.length} 个项目 · ${s.open} 个工作项没做${
      s.overdue ? ` · ${s.overdue} 个逾期` : ''
    }`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      const id = el.dataset.id;

      if (act === 'new-project') return openProjectDrawer(ctx, null);
      if (act === 'edit-project') return openProjectDrawer(ctx, id);
      if (act === 'select-project') {
        selectedProject = id;
        return ctx.rerender();
      }
      if (act === 'new-task') {
        const pid = el.dataset.project || currentProject(ctx.state);
        if (!pid) return ctx.toast('先创建一个项目', 'error');
        return openTaskDrawer(ctx, null, pid, el.dataset.status || 'todo');
      }
      if (act === 'edit-task') return openTaskDrawer(ctx, id);
      if (act === 'move-task') {
        const dir = Number(el.dataset.dir);
        ctx.commit((state) => {
          const t = state.devTasks.find((x) => x.id === id);
          if (!t) return;
          const idx = COLUMNS.findIndex((c) => c.key === t.status);
          const next = COLUMNS[Math.min(2, Math.max(0, idx + dir))].key;
          t.status = next;
          t.doneAt = next === 'done' ? new Date().toISOString() : null;
        });
      }
    });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const input = e.target.closest('.col-add');
      if (!input) return;
      const title = input.value.trim();
      if (!title) return;
      const projectId = input.dataset.project;
      const status = input.dataset.status;
      ctx.commit((state) => {
        state.devTasks.push({
          id: uid('t_'),
          projectId,
          title,
          status,
          priority: 'mid',
          dueDate: null,
          tags: [],
          note: '',
          doneAt: null,
          createdAt: new Date().toISOString()
        });
      });
      input.value = '';
    });

    // 拖拽改状态
    let draggingId = null;
    root.addEventListener('dragstart', (e) => {
      const card = e.target.closest('[data-task]');
      if (!card) return;
      draggingId = card.dataset.task;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', draggingId);
      } catch {}
    });
    root.addEventListener('dragend', (e) => {
      const card = e.target.closest('[data-task]');
      if (card) card.classList.remove('dragging');
      draggingId = null;
      root.querySelectorAll('.col-panel').forEach((c) => c.classList.remove('drag-over'));
    });
    root.addEventListener('dragover', (e) => {
      const col = e.target.closest('[data-drop]');
      if (!col || !draggingId) return;
      e.preventDefault();
      col.classList.add('drag-over');
    });
    root.addEventListener('dragleave', (e) => {
      const col = e.target.closest('[data-drop]');
      if (col) col.classList.remove('drag-over');
    });
    root.addEventListener('drop', (e) => {
      const col = e.target.closest('[data-drop]');
      const id = draggingId || e.dataTransfer.getData('text/plain');
      if (!col || !id) return;
      e.preventDefault();
      col.classList.remove('drag-over');
      const status = col.dataset.drop;
      ctx.commit((state) => {
        const t = state.devTasks.find((x) => x.id === id);
        if (!t || t.status === status) return;
        t.status = status;
        t.doneAt = status === 'done' ? new Date().toISOString() : null;
      });
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const today = todayISO();
    const stats = devStats(state, today);
    const pid = currentProject(state);
    const project = state.projects.find((p) => p.id === pid) || null;
    const tasks = project ? state.devTasks.filter((t) => t.projectId === project.id) : [];

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">项目</div>
          <div class="metric-value">${state.projects.length}</div>
          <div class="metric-foot">进行中 ${state.projects.filter((p) => p.status === 'active').length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">未完成工作项</div>
          <div class="metric-value">${stats.open}</div>
          <div class="metric-foot">全部项目合计</div>
        </div>
        <div class="metric">
          <div class="metric-label">今天到期</div>
          <div class="metric-value">${stats.dueToday}</div>
          <div class="metric-foot">需要今天处理</div>
        </div>
        <div class="metric">
          <div class="metric-label">已逾期</div>
          <div class="metric-value" style="${stats.overdue ? 'color:var(--danger)' : ''}">${stats.overdue}</div>
          <div class="metric-foot">${stats.overdue ? '尽快清掉' : '很干净'}</div>
        </div>
      </div>

      ${
        !state.projects.length
          ? `<section class="card section-gap">${emptyHTML({
              iconName: 'folder',
              title: '还没有项目',
              desc: '建一个项目，把要做的事拆成一条条工作项',
              actionLabel: '新建项目',
              action: 'new-project'
            })}</section>`
          : `<div class="section-gap" style="display:grid;grid-template-columns:minmax(200px,240px) minmax(0,1fr);gap:16px;align-items:start">
            <section class="card card-tight">
              <div class="row-between" style="margin-bottom:8px">
                <div class="small strong">项目</div>
                <button class="icon-btn" data-act="new-project" title="新建项目">${icon('plus', 15)}</button>
              </div>
              <div class="list">
                ${state.projects
                  .map((p) => {
                    const open = state.devTasks.filter((t) => t.projectId === p.id && t.status !== 'done').length;
                    return `<button class="list-row" data-act="select-project" data-id="${escapeHtml(p.id)}"
                      style="text-align:left;min-height:38px;padding:7px 6px;border-radius:8px;${
                        p.id === pid ? 'background:var(--surface-3)' : ''
                      }">
                      <i class="dot" style="background:${p.color};width:7px;height:7px"></i>
                      <span class="grow truncate small ${p.id === pid ? 'strong' : ''}">${escapeHtml(p.name)}</span>
                      <span class="tiny hint num">${open}</span>
                    </button>`;
                  })
                  .join('')}
              </div>
            </section>

            <section>
              ${
                project
                  ? `<div class="row-between" style="margin-bottom:12px">
                      <div>
                        <div class="row" style="gap:8px">
                          <i class="dot" style="background:${project.color};width:8px;height:8px"></i>
                          <div class="strong" style="font-size:15px">${escapeHtml(project.name)}</div>
                          <span class="chip">${tasks.filter((t) => t.status === 'done').length}/${tasks.length} 完成</span>
                        </div>
                        ${project.note ? `<div class="tiny hint" style="margin-top:3px">${escapeHtml(project.note)}</div>` : ''}
                      </div>
                      <div class="row" style="gap:6px">
                        <button class="btn btn-sm" data-act="edit-project" data-id="${escapeHtml(project.id)}">${icon(
                            'edit',
                            13
                          )} 项目设置</button>
                        <button class="btn btn-sm btn-primary" data-act="new-task" data-project="${escapeHtml(
                          project.id
                        )}">${icon('plus', 13)} 添加工作项</button>
                      </div>
                    </div>
                    <div class="kanban-scroll"><div class="kanban kanban-3">
                      ${COLUMNS.map((col) => {
                        const list = tasks.filter((t) => t.status === col.key);
                        return `<div class="col-panel" data-drop="${col.key}">
                          <div class="col-head"><span>${col.label}</span><span class="count">${list.length}</span></div>
                          ${list.map(taskCard).join('')}
                          <input class="input input-sm col-add" data-project="${escapeHtml(
                            project.id
                          )}" data-status="${col.key}" placeholder="+ 添加工作项，回车保存" autocomplete="off" />
                        </div>`;
                      }).join('')}
                    </div></div>
                    <p class="tiny hint" style="margin-top:10px">拖动卡片可以换列，也可以用卡片里的按钮移动。</p>`
                  : ''
              }
            </section>
          </div>`
      }
    `;
  }
};
