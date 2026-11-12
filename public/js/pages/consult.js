import { icon } from '../components/icons.js';
import { emptyHTML, field } from '../components/ui.js';
import { barChartHTML } from '../charts.js';
import { addToPlan } from '../actions.js';
import { escapeHtml, todayISO, fmtCN, fmtMoney, fmtNum, fmtMinutes, uid, relativeDay } from '../utils.js';
import {
  monthConsultIncome,
  incomeByMonth,
  incomeByClient,
  followUpClients,
  clientSummary,
  sumBy
} from '../stats.js';

let tab = 'clients';

const TYPE_LABEL = { single: '单次', longterm: '长期陪跑' };
const MODE_LABEL = { online: '线上', offline: '线下' };

function sessionDrawer(ctx, clientId, sessionId = null) {
  const client = ctx.state.clients.find((c) => c.id === clientId);
  if (!client) return;
  const s =
    (sessionId && ctx.state.sessions.find((x) => x.id === sessionId)) || {
      date: todayISO(),
      duration: 60,
      fee: 0,
      mode: 'online',
      summary: '',
      nextFollowUp: null
    };
  let bodyEl = null;

  ctx.openDrawer({
    title: sessionId ? '编辑咨询记录' : '记一次咨询',
    subtitle: client.name,
    content: `
      <div class="form-grid">
        ${field('日期', `<input class="input" id="s-date" type="date" value="${escapeHtml(s.date)}" />`)}
        ${field('时长（分钟）', `<input class="input" id="s-duration" type="number" min="0" step="15" value="${s.duration}" />`)}
        ${field('费用（元）', `<input class="input" id="s-fee" type="number" min="0" step="50" value="${s.fee}" />`)}
        ${field(
          '形式',
          `<select class="select" id="s-mode">
            <option value="online" ${s.mode === 'online' ? 'selected' : ''}>线上</option>
            <option value="offline" ${s.mode === 'offline' ? 'selected' : ''}>线下</option>
          </select>`
        )}
      </div>
      ${field('这次聊了什么 / 结论', `<textarea class="textarea" id="s-summary">${escapeHtml(s.summary || '')}</textarea>`)}
      ${field(
        '下次跟进日',
        `<input class="input" id="s-follow" type="date" value="${escapeHtml(s.nextFollowUp || '')}" />`,
        '留空表示暂不安排'
      )}
    `,
    onMount: (el) => {
      bodyEl = el;
    },
    footer: sessionId
      ? [
          {
            label: '删除记录',
            danger: true,
            align: 'left',
            onClick: async () => {
              const ok = await ctx.confirm({
                title: '删除咨询记录',
                message: `${fmtCN(s.date)} 这条记录将被删除。`,
                confirmText: '删除',
                danger: true
              });
              if (!ok) return false;
              ctx.commit((state) => {
                state.sessions = state.sessions.filter((x) => x.id !== sessionId);
              });
              return true;
            }
          },
          { label: '保存', primary: true, onClick: () => save() }
        ]
      : [{ label: '记录', primary: true, onClick: () => save() }]
  });

  function save() {
    const date = bodyEl.querySelector('#s-date').value || todayISO();
    const payload = {
      date,
      duration: Number(bodyEl.querySelector('#s-duration').value) || 0,
      fee: Number(bodyEl.querySelector('#s-fee').value) || 0,
      mode: bodyEl.querySelector('#s-mode').value,
      summary: bodyEl.querySelector('#s-summary').value.trim(),
      nextFollowUp: bodyEl.querySelector('#s-follow').value || null
    };
    ctx.commit((state) => {
      if (sessionId) {
        const target = state.sessions.find((x) => x.id === sessionId);
        if (target) Object.assign(target, payload);
      } else {
        state.sessions.push({ id: uid('s_'), clientId, ...payload });
      }
      const c = state.clients.find((x) => x.id === clientId);
      if (c && payload.nextFollowUp) c.nextFollowUp = payload.nextFollowUp;
    });
    ctx.toast('已记录');
    return true;
  }
}

function clientForm(ctx, clientId = null) {
  const client = clientId
    ? ctx.state.clients.find((c) => c.id === clientId)
    : { name: '', type: 'single', contact: '', stage: '', startedAt: null, nextFollowUp: null, note: '' };
  let bodyEl = null;
  const summary = clientId ? clientSummary(ctx.state, clientId) : { count: 0, fee: 0 };
  const goals = clientId ? ctx.state.clientGoals.filter((g) => g.clientId === clientId) : [];

  ctx.openDrawer({
    title: clientId ? '客户档案' : '新增客户',
    subtitle: clientId ? `咨询 ${summary.count} 次 · 累计 ${fmtMoney(summary.fee)}` : '先记个名字，其他可以慢慢补',
    content: `
      ${field('称呼', `<input class="input" id="cl-name" placeholder="怎么称呼这位客户" value="${escapeHtml(client.name)}" />`)}
      <div class="form-grid">
        ${field(
          '合作类型',
          `<select class="select" id="cl-type">
            <option value="single" ${client.type === 'single' ? 'selected' : ''}>单次咨询</option>
            <option value="longterm" ${client.type === 'longterm' ? 'selected' : ''}>长期陪跑</option>
          </select>`
        )}
        ${field('联系方式', `<input class="input" id="cl-contact" placeholder="微信 / 电话" value="${escapeHtml(client.contact || '')}" />`)}
        ${field('下次跟进', `<input class="input" id="cl-follow" type="date" value="${escapeHtml(client.nextFollowUp || '')}" />`)}
        ${field(
          '当前阶段',
          `<input class="input" id="cl-stage" placeholder="如：第 2 月 · 执行期" value="${escapeHtml(client.stage || '')}" />`
        )}
      </div>
      ${field('备注', `<textarea class="textarea" id="cl-note">${escapeHtml(client.note || '')}</textarea>`)}

      ${
        clientId
          ? `<div class="divider"></div>
            <div class="row-between" style="margin-bottom:8px">
              <div class="small strong">阶段目标</div>
              <span class="tiny hint">${goals.filter((g) => g.done).length}/${goals.length}</span>
            </div>
            <div class="list" id="goal-list">
              ${
                goals.length
                  ? goals
                      .map(
                        (g) => `<div class="list-row" style="min-height:34px;padding:5px 0">
                        <button class="check ${g.done ? 'on' : ''}" data-goal="${escapeHtml(g.id)}">${
                          g.done ? icon('check', 10) : ''
                        }</button>
                        <span class="grow small ${g.done ? 'hint' : ''}" style="${
                          g.done ? 'text-decoration:line-through' : ''
                        }">${escapeHtml(g.title)}</span>
                        ${g.targetDate ? `<span class="tiny hint">${fmtCN(g.targetDate)}</span>` : ''}
                        <button class="icon-btn danger" data-goal-del="${escapeHtml(g.id)}">${icon('trash', 12)}</button>
                      </div>`
                      )
                      .join('')
                  : '<div class="list-empty">还没有目标</div>'
              }
            </div>
            <div class="row" style="gap:6px;margin-top:8px">
              <input class="input input-sm" id="goal-input" placeholder="加一个阶段目标，回车保存" />
            </div>
            <div class="divider"></div>
            <div class="row-between" style="margin-bottom:8px"><div class="small strong">咨询记录</div>
              <button class="btn btn-sm" data-session-new>${icon('plus', 12)} 记一次</button>
            </div>
            <div class="list">
              ${
                ctx.state.sessions.filter((s) => s.clientId === clientId).length
                  ? ctx.state.sessions
                      .filter((s) => s.clientId === clientId)
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map(
                        (s) => `<div class="list-row" style="min-height:40px">
                        <span class="tiny mono hint" style="width:62px">${escapeHtml(s.date.slice(5))}</span>
                        <span class="grow small truncate">${escapeHtml(s.summary || '（无备注）')}</span>
                        <span class="chip">${fmtMinutes(s.duration)}</span>
                        <span class="small num">${fmtMoney(s.fee)}</span>
                        <button class="icon-btn" data-session-edit="${escapeHtml(s.id)}">${icon('edit', 12)}</button>
                      </div>`
                      )
                      .join('')
                  : '<div class="list-empty">还没有咨询记录</div>'
              }
            </div>
            <button class="btn btn-sm" data-toplan style="margin-top:14px">${icon('plus', 13)} 加入今日计划</button>`
          : ''
      }
    `,
    onMount: (el) => {
      bodyEl = el;
      setTimeout(() => el.querySelector('#cl-name').focus(), 40);

      el.addEventListener('click', (e) => {
        const goalBtn = e.target.closest('[data-goal]');
        if (goalBtn) {
          const gid = goalBtn.dataset.goal;
          ctx.commit((state) => {
            const g = state.clientGoals.find((x) => x.id === gid);
            if (g) g.done = !g.done;
          });
          return;
        }
        const delBtn = e.target.closest('[data-goal-del]');
        if (delBtn) {
          const gid = delBtn.dataset.goalDel;
          ctx.commit((state) => {
            state.clientGoals = state.clientGoals.filter((x) => x.id !== gid);
          });
          return;
        }
        if (e.target.closest('[data-session-new]')) {
          sessionDrawer(ctx, clientId);
          return;
        }
        const editBtn = e.target.closest('[data-session-edit]');
        if (editBtn) {
          sessionDrawer(ctx, clientId, editBtn.dataset.sessionEdit);
          return;
        }
        if (e.target.closest('[data-toplan]')) {
          addToPlan(ctx, `跟进客户：${client.name}`, 'consult');
        }
      });

      el.querySelector('#goal-input').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        const title = e.target.value.trim();
        if (!title) return;
        ctx.commit((state) => {
          state.clientGoals.push({ id: uid('g_'), clientId, title, targetDate: null, done: false });
        });
        e.target.value = '';
      });
    },
    footer: clientId
      ? [
          {
            label: '删除客户',
            danger: true,
            align: 'left',
            onClick: async () => {
              const sessions = ctx.state.sessions.filter((s) => s.clientId === clientId);
              const goalCount = ctx.state.clientGoals.filter((g) => g.clientId === clientId).length;
              const ok = await ctx.confirm({
                title: '删除客户',
                message: `将删除客户「${escapeHtml(client.name)}」，同时删除 <b>${sessions.length}</b> 条咨询记录${
                  goalCount ? `和 <b>${goalCount}</b> 个阶段目标` : ''
                }。此操作无法撤销。`,
                confirmText: '确认删除',
                danger: true
              });
              if (!ok) return false;
              ctx.commit((state) => {
                state.clients = state.clients.filter((c) => c.id !== clientId);
                state.sessions = state.sessions.filter((s) => s.clientId !== clientId);
                state.clientGoals = state.clientGoals.filter((g) => g.clientId !== clientId);
              });
              ctx.toast('客户已删除');
              return true;
            }
          },
          { label: '保存', primary: true, onClick: () => save() }
        ]
      : [{ label: '添加客户', primary: true, onClick: () => save() }]
  });

  function save() {
    const name = bodyEl.querySelector('#cl-name').value.trim();
    if (!name) {
      ctx.toast('客户称呼不能为空', 'error');
      return false;
    }
    const payload = {
      name,
      type: bodyEl.querySelector('#cl-type').value,
      contact: bodyEl.querySelector('#cl-contact').value.trim(),
      nextFollowUp: bodyEl.querySelector('#cl-follow').value || null,
      stage: bodyEl.querySelector('#cl-stage').value.trim(),
      note: bodyEl.querySelector('#cl-note').value.trim()
    };
    ctx.commit((state) => {
      if (clientId) {
        const c = state.clients.find((x) => x.id === clientId);
        if (c) Object.assign(c, payload);
      } else {
        state.clients.push({
          id: uid('cl_'),
          ...payload,
          startedAt: todayISO(),
          createdAt: new Date().toISOString()
        });
      }
    });
    ctx.toast(clientId ? '已保存' : '客户已添加');
    return true;
  }
}

export default {
  id: 'consult',
  title: '咨询工作',
  subtitle(state) {
    const follows = followUpClients(state, todayISO());
    return `${state.clients.length} 位客户 · ${fmtMoney(monthConsultIncome(state, todayISO()))} 本月收入${
      follows.length ? ` · ${follows.length} 位待跟进` : ''
    }`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      const id = el.dataset.id;
      if (act === 'tab') {
        tab = el.dataset.tab;
        return ctx.rerender();
      }
      if (act === 'new-client') return clientForm(ctx, null);
      if (act === 'open-client') return clientForm(ctx, id);
      if (act === 'new-session') return sessionDrawer(ctx, id);
      if (act === 'edit-session') return sessionDrawer(ctx, el.dataset.client, id);
      if (act === 'del-session') {
        const s = ctx.state.sessions.find((x) => x.id === id);
        ctx
          .confirm({
            title: '删除咨询记录',
            message: `${s ? fmtCN(s.date) : ''} 的记录将被删除。`,
            confirmText: '删除',
            danger: true
          })
          .then((ok) => {
            if (!ok) return;
            ctx.commit((state) => {
              state.sessions = state.sessions.filter((x) => x.id !== id);
            });
          });
      }
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const today = todayISO();
    const follows = followUpClients(state, today);
    const income = monthConsultIncome(state, today);
    const year = fmtNum(
      sumBy(
        state.sessions.filter((s) => s.date.slice(0, 4) === today.slice(0, 4)),
        (s) => s.fee
      )
    );

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">客户</div>
          <div class="metric-value">${state.clients.length}<small>位</small></div>
          <div class="metric-foot">长期 ${state.clients.filter((c) => c.type === 'longterm').length} 位</div>
        </div>
        <div class="metric">
          <div class="metric-label">本月收入</div>
          <div class="metric-value">${fmtMoney(income)}</div>
          <div class="metric-foot">本年累计 ¥${year}</div>
        </div>
        <div class="metric">
          <div class="metric-label">本月咨询</div>
          <div class="metric-value">${
            state.sessions.filter((s) => s.date.slice(0, 7) === today.slice(0, 7)).length
          }<small>次</small></div>
          <div class="metric-foot">平均每次 ${fmtMoney(
            Math.round(
              income /
                Math.max(1, state.sessions.filter((s) => s.date.slice(0, 7) === today.slice(0, 7)).length)
            )
          )}</div>
        </div>
        <div class="metric">
          <div class="metric-label">待跟进</div>
          <div class="metric-value" style="${follows.length ? 'color:var(--warning)' : ''}">${follows.length}</div>
          <div class="metric-foot">${follows.length ? '今天或之前该联系' : '没有欠着的跟进'}</div>
        </div>
      </div>

      <div class="row-between section-gap" style="margin-bottom:12px">
        <div class="tabs" style="margin:0;border:none">
          ${[
            { key: 'clients', label: '客户' },
            { key: 'records', label: '咨询记录' },
            { key: 'income', label: '收入' }
          ]
            .map(
              (t) =>
                `<button class="tab ${tab === t.key ? 'active' : ''}" data-act="tab" data-tab="${t.key}">${t.label}</button>`
            )
            .join('')}
        </div>
        <button class="btn btn-primary btn-sm" data-act="new-client">${icon('plus', 13)} 新增客户</button>
      </div>

      ${tab === 'clients' ? renderClients(ctx, state, follows) : ''}
      ${tab === 'records' ? renderRecords(state) : ''}
      ${tab === 'income' ? renderIncome(state, today) : ''}
    `;
  }
};

function renderClients(ctx, state, follows) {
  if (!state.clients.length) {
    return `<section class="card">${emptyHTML({
      iconName: 'consult',
      title: '还没有客户',
      desc: '把客户建起来，每聊一次记一条，收入和跟进就不会漏',
      actionLabel: '新增客户',
      action: 'new-client'
    })}</section>`;
  }

  return `<div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th style="width:22%">客户</th><th>类型</th><th>阶段</th>
          <th class="num">咨询次数</th><th class="num">累计收入</th><th>下次跟进</th><th style="width:150px"></th>
        </tr>
      </thead>
      <tbody>
        ${state.clients
          .map((c) => {
            const sum = clientSummary(state, c.id);
            const due = c.nextFollowUp && c.nextFollowUp <= todayISO();
            return `<tr>
              <td>
                <button class="row" style="gap:8px;text-align:left" data-act="open-client" data-id="${escapeHtml(c.id)}">
                  <span class="avatar">${escapeHtml(c.name.slice(0, 1))}</span>
                  <span>
                    <span class="strong" style="display:block">${escapeHtml(c.name)}</span>
                    ${c.contact ? `<span class="tiny hint">${escapeHtml(c.contact)}</span>` : ''}
                  </span>
                </button>
              </td>
              <td><span class="chip">${TYPE_LABEL[c.type] || '单次'}</span></td>
              <td class="muted small">${escapeHtml(c.stage || '—')}</td>
              <td class="num">${sum.count}</td>
              <td class="num">${fmtMoney(sum.fee)}</td>
              <td>${
                c.nextFollowUp
                  ? `<span class="chip ${due ? 'chip-warn' : 'chip-soft'}">${
                      due ? '该联系 · ' : ''
                    }${relativeDay(c.nextFollowUp, todayISO())}</span>`
                  : '<span class="hint small">—</span>'
              }</td>
              <td>
                <div class="row" style="gap:4px;justify-content:flex-end">
                  <button class="btn btn-sm" data-act="new-session" data-id="${escapeHtml(c.id)}">记一次</button>
                  <button class="icon-btn" data-act="open-client" data-id="${escapeHtml(c.id)}" title="编辑">${icon(
                    'edit',
                    14
                  )}</button>
                </div>
              </td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  </div>
  ${
    follows.length
      ? `<p class="tiny hint" style="margin-top:10px">${follows
          .map((c) => `${escapeHtml(c.name)}（${relativeDay(c.nextFollowUp, todayISO())}）`)
          .join('、')} 该联系了。</p>`
      : ''
  }`;
}

function renderRecords(state) {
  const rows = state.sessions.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) {
    return `<section class="card">${emptyHTML({
      iconName: 'clock',
      title: '还没有咨询记录',
      desc: '每次聊完花 30 秒记一下，月底复盘和报价都有底'
    })}</section>`;
  }
  const nameOf = (id) => {
    const c = state.clients.find((x) => x.id === id);
    return c ? c.name : '（已删除客户）';
  };
  return `<div class="table-wrap">
    <table class="table">
      <thead><tr><th>日期</th><th>客户</th><th class="num">时长</th><th>形式</th><th class="num">费用</th><th>要点</th><th style="width:80px"></th></tr></thead>
      <tbody>
        ${rows
          .map(
            (s) => `<tr>
              <td class="mono small">${escapeHtml(s.date)}</td>
              <td>${escapeHtml(nameOf(s.clientId))}</td>
              <td class="num">${fmtMinutes(s.duration)}</td>
              <td class="muted">${MODE_LABEL[s.mode] || '线上'}</td>
              <td class="num">${fmtMoney(s.fee)}</td>
              <td class="muted small truncate" style="max-width:260px">${escapeHtml(s.summary || '—')}</td>
              <td>
                <div class="row" style="gap:2px;justify-content:flex-end">
                  <button class="icon-btn" data-act="edit-session" data-client="${escapeHtml(
                    s.clientId
                  )}" data-id="${escapeHtml(s.id)}" title="编辑">${icon('edit', 14)}</button>
                  <button class="icon-btn danger" data-act="del-session" data-id="${escapeHtml(
                    s.id
                  )}" title="删除">${icon('trash', 14)}</button>
                </div>
              </td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>`;
}

function renderIncome(state, today) {
  const months = incomeByMonth(state, 6, today);
  const byClient = incomeByClient(state).filter((c) => c.value > 0);
  return `<div class="grid grid-2">
    <section class="card">
      <div class="card-head"><div class="card-title">${icon('bar', 15)} 近 6 个月收入</div></div>
      ${barChartHTML({
        items: months.map((m) => ({ label: m.label, value: m.value, color: 'var(--m-consult)' })),
        height: 220,
        format: (v) => '¥' + fmtNum(v)
      })}
    </section>
    <section class="card">
      <div class="card-head"><div class="card-title">${icon('target', 15)} 客户贡献排行</div></div>
      ${
        byClient.length
          ? `<div class="list">
              ${byClient
                .slice(0, 8)
                .map(
                  (c) => `<div class="list-row">
                  <span class="avatar">${escapeHtml(c.name.slice(0, 1))}</span>
                  <span class="grow small">${escapeHtml(c.name)}<span class="tiny hint"> · ${c.count} 次</span></span>
                  <span class="small num strong">${fmtMoney(c.value)}</span>
                </div>`
                )
                .join('')}
            </div>`
          : `<div class="list-empty">还没有收入记录</div>`
      }
    </section>
  </div>`;
}
