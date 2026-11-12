import { icon } from '../components/icons.js';
import { emptyHTML } from '../components/ui.js';
import { escapeHtml, greeting, fmtCN, weekdayCN, todayISO, fmtMoney, fmtNum, uid, relativeDay } from '../utils.js';
import {
  planProgress,
  plansFor,
  weekPublishCount,
  monthConsultIncome,
  weekWorkoutDays,
  contentTotals,
  devStats,
  followUpClients,
  workoutsOn,
  mealOn,
  mealSummary
} from '../stats.js';

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };

function planRow(ctx, p) {
  return `<div class="list-row">
    <button class="check ${p.done ? 'on' : ''}" data-act="toggle-plan" data-id="${escapeHtml(p.id)}" aria-label="切换完成">
      ${p.done ? icon('check', 10) : ''}
    </button>
    <span class="grow truncate ${p.done ? 'hint' : ''}" style="${p.done ? 'text-decoration:line-through' : ''}">
      ${escapeHtml(p.title)}
    </span>
    ${p.time ? `<span class="chip">${escapeHtml(p.time)}</span>` : ''}
    ${p.priority === 'high' ? '<span class="chip chip-warn">高</span>' : ''}
  </div>`;
}

function summaryCard({ title, iconName, main, sub, hash, accent }) {
  return `<button class="card card-tight" data-act="goto" data-hash="${hash}" style="text-align:left;display:block">
    <div class="row-between">
      <div class="row" style="gap:7px;color:${accent}">${icon(iconName, 15)}<span class="small strong" style="color:var(--text)">${escapeHtml(
    title
  )}</span></div>
      ${icon('right', 14)}
    </div>
    <div class="strong" style="font-size:15px;margin-top:8px">${escapeHtml(main)}</div>
    <div class="tiny hint" style="margin-top:2px">${escapeHtml(sub)}</div>
  </button>`;
}

export default {
  id: 'home',
  title: '首页总览',
  subtitle(state) {
    const p = planProgress(state, todayISO());
    if (!p.total) return '今天还没有安排，先加一件事';
    return `今天 ${p.total} 件事，已完成 ${p.done} 件`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      if (act === 'goto') {
        ctx.navigate(el.dataset.hash);
        return;
      }
      if (act === 'toggle-plan') {
        ctx.commit((state) => {
          const p = state.plans.find((x) => x.id === el.dataset.id);
          if (p) {
            p.done = !p.done;
            p.doneAt = p.done ? new Date().toISOString() : null;
          }
        });
        return;
      }
      if (act === 'toggle-memo') {
        ctx.commit((state) => {
          const m = state.memos.find((x) => x.id === el.dataset.id);
          if (m) m.done = !m.done;
        });
        return;
      }
      if (act === 'del-memo') {
        ctx.commit((state) => {
          state.memos = state.memos.filter((x) => x.id !== el.dataset.id);
        });
      }
    });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const input = e.target;
      if (input.id === 'quick-plan') {
        const title = input.value.trim();
        if (!title) return;
        ctx.commit((state) => {
          state.plans.push({
            id: uid('p_'),
            title,
            date: todayISO(),
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
        input.value = '';
      }
      if (input.id === 'quick-memo') {
        const text = input.value.trim();
        if (!text) return;
        ctx.commit((state) => {
          state.memos.push({
            id: uid('m_'),
            text,
            done: false,
            createdAt: new Date().toISOString()
          });
        });
        input.value = '';
      }
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const today = todayISO();
    const weekStart = (state.settings && state.settings.weekStart) ?? 1;

    const progress = planProgress(state, today);
    const plans = plansFor(state, today).slice(0, 6);
    const publishWeek = weekPublishCount(state, today, weekStart);
    const readyCount = state.contents.filter((c) => c.status === 'ready').length;
    const income = monthConsultIncome(state, today);
    const follows = followUpClients(state, today);
    const workoutDays = weekWorkoutDays(state, today, weekStart);
    const todayTrained = workoutsOn(state, today).length > 0;

    const totals = contentTotals(state);
    const dstat = devStats(state, today);
    const memos = state.memos
      .slice()
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.createdAt < b.createdAt ? 1 : -1));
    const openMemos = memos.filter((m) => !m.done);

    const meal = mealOn(state, today);
    const mealSum = mealSummary(meal);

    root.innerHTML = `
      <div class="row-between" style="margin-bottom:18px;align-items:flex-end">
        <div>
          <div style="font-size:21px;font-weight:500;letter-spacing:-0.02em">${greeting()}，${fmtCN(
      today
    )} ${weekdayCN(today)}</div>
          <div class="muted small" style="margin-top:3px">
            ${progress.total ? `还剩 ${progress.total - progress.done} 件事没做完` : '今天还是一张白纸'}
            ${follows.length ? ` · ${follows.length} 位客户该跟进` : ''}
            ${todayTrained ? ' · 今天已经练过了' : ''}
          </div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-sm" data-act="goto" data-hash="#/plan">${icon('plan', 13)} 今日计划</button>
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="metric-label">今日完成</div>
          <div class="metric-value">${progress.done}<small>/ ${progress.total}</small></div>
          <div class="bar" style="margin-top:8px"><i style="width:${Math.round(
            progress.ratio * 100
          )}%"></i></div>
        </div>
        <div class="metric">
          <div class="metric-label">本周发布</div>
          <div class="metric-value">${publishWeek}<small>条</small></div>
          <div class="metric-foot">${readyCount ? `${readyCount} 条等着发` : '没有积压'}</div>
        </div>
        <div class="metric">
          <div class="metric-label">本月咨询收入</div>
          <div class="metric-value">${fmtMoney(income)}</div>
          <div class="metric-foot">${follows.length ? `${follows.length} 位该跟进` : '暂无待跟进'}</div>
        </div>
        <div class="metric">
          <div class="metric-label">本周训练</div>
          <div class="metric-value">${workoutDays}<small>天</small></div>
          <div class="metric-foot">${todayTrained ? '今天已记录' : '今天还没记录'}</div>
        </div>
      </div>

      <div class="grid section-gap" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
        <section class="card">
          <div class="card-head">
            <div class="card-title">${icon('plan', 15)} 今日计划</div>
            <button class="card-link" data-act="goto" data-hash="#/plan">全部 〉</button>
          </div>
          <div class="list">
            ${
              plans.length
                ? plans.map((p) => planRow(ctx, p)).join('')
                : emptyHTML({
                    iconName: 'plan',
                    title: '今天还没安排',
                    desc: '在下面写一句，回车就加进今天的计划'
                  })
            }
          </div>
          <div style="margin-top:8px">
            <input class="input input-sm" id="quick-plan" placeholder="添加一件事，回车保存…" autocomplete="off" />
          </div>
        </section>

        <section class="card" style="background:var(--surface-2)">
          <div class="card-head">
            <div class="card-title">${icon('edit', 15)} 快速备忘</div>
            <span class="tiny hint">${openMemos.length} 条未处理</span>
          </div>
          <div class="list">
            ${
              memos.length
                ? memos
                    .slice(0, 6)
                    .map(
                      (m) => `<div class="list-row" style="min-height:34px;padding:5px 0">
                        <button class="check ${m.done ? 'on' : ''}" data-act="toggle-memo" data-id="${escapeHtml(
                        m.id
                      )}">${m.done ? icon('check', 10) : ''}</button>
                        <span class="grow small ${m.done ? 'hint' : ''}" style="${
                        m.done ? 'text-decoration:line-through' : ''
                      }">${escapeHtml(m.text)}</span>
                        <button class="icon-btn danger" data-act="del-memo" data-id="${escapeHtml(
                          m.id
                        )}" aria-label="删除">${icon('trash', 12)}</button>
                      </div>`
                    )
                    .join('')
                : `<div class="list-empty">随手记点什么，别让它跑了</div>`
            }
          </div>
          <input class="input input-sm" id="quick-memo" placeholder="写一条备忘，回车保存…" style="margin-top:8px" autocomplete="off" />
        </section>
      </div>

      <div class="grid grid-3 section-gap">
        ${summaryCard({
          title: '自媒体',
          iconName: 'content',
          main: totals.views ? `累计 ${fmtNum(totals.views)} 播放` : '还没有发布数据',
          sub: `已发布 ${totals.published} 条 · 涨粉 ${fmtNum(totals.fans)}`,
          hash: '#/content',
          accent: 'var(--m-content)'
        })}
        ${summaryCard({
          title: '开发工作',
          iconName: 'dev',
          main: `${dstat.open} 个工作项没做`,
          sub: dstat.overdue ? `${dstat.overdue} 个已逾期` : dstat.dueToday ? `${dstat.dueToday} 个今天到期` : '没有逾期',
          hash: '#/dev',
          accent: 'var(--m-dev)'
        })}
        ${summaryCard({
          title: '咨询工作',
          iconName: 'consult',
          main: `${state.clients.length} 位客户`,
          sub: follows.length ? `${follows[0].name} 等 ${follows.length} 位该联系` : '跟进都在这周之后',
          hash: '#/consult',
          accent: 'var(--m-consult)'
        })}
      </div>

      <div class="grid grid-3 section-gap">
        <section class="card card-tight">
          <div class="row-between">
            <div class="row" style="gap:7px">${icon('fitness', 15)}<span class="small strong">健身</span></div>
            <button class="card-link" data-act="goto" data-hash="#/fitness">记录 〉</button>
          </div>
          <div class="tiny hint" style="margin-top:7px">${
            todayTrained ? '今天已记录训练' : '今天还没有训练记录'
          } · 本周 ${workoutDays} 天</div>
        </section>
        <section class="card card-tight">
          <div class="row-between">
            <div class="row" style="gap:7px">${icon('diet', 15)}<span class="small strong">饮食</span></div>
            <button class="card-link" data-act="goto" data-hash="#/diet">记录 〉</button>
          </div>
          <div class="tiny hint" style="margin-top:7px">${
            mealSum.recorded ? `已记 ${mealSum.recorded} 餐 · 水 ${mealSum.water} 杯` : '今天还没有饮食记录'
          }</div>
        </section>
        <section class="card card-tight">
          <div class="row-between">
            <div class="row" style="gap:7px">${icon('consult', 15)}<span class="small strong">待跟进</span></div>
            <button class="card-link" data-act="goto" data-hash="#/consult">查看 〉</button>
          </div>
          <div class="tiny hint" style="margin-top:7px">${
            follows.length
              ? follows
                  .slice(0, 2)
                  .map((c) => `${c.name}（${relativeDay(c.nextFollowUp, today)}）`)
                  .join('、')
              : '没有需要今天联系的客户'
          }</div>
        </section>
      </div>
    `;
  }
};
