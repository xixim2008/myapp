import { icon } from '../components/icons.js';
import { emptyHTML, field } from '../components/ui.js';
import { escapeHtml, todayISO, fmtCN, fmtMinutes, uid, fmtNum } from '../utils.js';
import { gameStats, gameMinutes } from '../stats.js';

const STATUS = {
  playing: { label: '在玩', chip: 'chip-ok' },
  wishlist: { label: '想玩', chip: 'chip-soft' },
  cleared: { label: '已通关', chip: 'chip' },
  paused: { label: '搁置', chip: 'chip-warn' }
};
const COLORS = ['#8a3e63', '#2f5d9e', '#49773c', '#a2632b', '#5b4b9e', '#b04a3e'];

let filter = 'all';

function playDrawer(ctx, gameId) {
  const game = ctx.state.games.find((g) => g.id === gameId);
  if (!game) return;
  let bodyEl = null;

  ctx.openDrawer({
    title: '记一次游玩',
    subtitle: game.title,
    content: `
      ${field('日期', `<input class="input" id="pl-date" type="date" value="${todayISO()}" />`)}
      ${field('玩了多久（分钟）', `<input class="input" id="pl-minutes" type="number" min="0" step="15" value="60" />`)}
      ${field('感受 / 进度', `<input class="input" id="pl-mood" placeholder="打到哪了、爽不爽" />`)}
    `,
    onMount: (el) => {
      bodyEl = el;
      setTimeout(() => el.querySelector('#pl-minutes').select(), 60);
    },
    footer: [
      {
        label: '记录',
        primary: true,
        onClick: () => {
          const minutes = Number(bodyEl.querySelector('#pl-minutes').value) || 0;
          if (minutes <= 0) {
            ctx.toast('时长要大于 0', 'error');
            return false;
          }
          ctx.commit((state) => {
            state.playLogs.push({
              id: uid('pl_'),
              gameId,
              date: bodyEl.querySelector('#pl-date').value || todayISO(),
              minutes,
              mood: bodyEl.querySelector('#pl-mood').value.trim(),
              note: ''
            });
          });
          ctx.toast(`已记录 ${fmtMinutes(minutes)}`);
          return true;
        }
      }
    ]
  });
}

function gameDrawer(ctx, id) {
  const existing = id ? ctx.state.games.find((g) => g.id === id) : null;
  const g = existing || { title: '', status: 'playing', platform: 'PC', color: COLORS[0], note: '' };
  let bodyEl = null;

  ctx.openDrawer({
    title: existing ? '编辑游戏' : '新增游戏',
    content: `
      ${field('游戏名称', `<input class="input" id="g-title" placeholder="在玩什么" value="${escapeHtml(g.title)}" />`)}
      <div class="form-grid">
        ${field(
          '状态',
          `<select class="select" id="g-status">${Object.entries(STATUS)
            .map(([k, v]) => `<option value="${k}" ${g.status === k ? 'selected' : ''}>${v.label}</option>`)
            .join('')}</select>`
        )}
        ${field('平台', `<input class="input" id="g-platform" placeholder="PC / PS5 / Switch" value="${escapeHtml(g.platform || '')}" />`)}
      </div>
      <div class="field">
        <span class="label">颜色</span>
        <div class="row" style="gap:8px">
          ${COLORS.map(
            (c) =>
              `<button class="g-color" data-color="${c}" style="width:22px;height:22px;border-radius:50%;background:${c};border:${
                g.color === c ? '2px solid var(--text)' : '2px solid transparent'
              }"></button>`
          ).join('')}
        </div>
      </div>
      ${field('备注', `<textarea class="textarea" id="g-note">${escapeHtml(g.note || '')}</textarea>`)}
    `,
    onMount: (el) => {
      bodyEl = el;
      el.dataset.color = g.color;
      setTimeout(() => el.querySelector('#g-title').focus(), 40);
      el.querySelectorAll('.g-color').forEach((btn) => {
        btn.addEventListener('click', () => {
          el.dataset.color = btn.dataset.color;
          el.querySelectorAll('.g-color').forEach((b) => (b.style.borderColor = 'transparent'));
          btn.style.borderColor = 'var(--text)';
        });
      });
    },
    footer: existing
      ? [
          {
            label: '删除',
            danger: true,
            align: 'left',
            onClick: async () => {
              const logs = ctx.state.playLogs.filter((l) => l.gameId === id).length;
              const ok = await ctx.confirm({
                title: '删除游戏',
                message: `「${escapeHtml(existing.title)}」及其 ${logs} 条游玩记录会被删除。`,
                confirmText: '删除',
                danger: true
              });
              if (!ok) return false;
              ctx.commit((state) => {
                state.games = state.games.filter((x) => x.id !== id);
                state.playLogs = state.playLogs.filter((l) => l.gameId !== id);
              });
              return true;
            }
          },
          { label: '保存', primary: true, onClick: () => save() }
        ]
      : [{ label: '添加', primary: true, onClick: () => save() }]
  });

  function save() {
    const title = bodyEl.querySelector('#g-title').value.trim();
    if (!title) {
      ctx.toast('游戏名称不能为空', 'error');
      return false;
    }
    const payload = {
      title,
      status: bodyEl.querySelector('#g-status').value,
      platform: bodyEl.querySelector('#g-platform').value.trim(),
      color: bodyEl.dataset.color || COLORS[0],
      note: bodyEl.querySelector('#g-note').value.trim()
    };
    ctx.commit((state) => {
      if (id) {
        const target = state.games.find((x) => x.id === id);
        if (target) Object.assign(target, payload);
      } else {
        state.games.push({ id: uid('g_'), ...payload, createdAt: new Date().toISOString() });
      }
    });
    return true;
  }
}

export default {
  id: 'game',
  title: '游戏娱乐',
  subtitle(state) {
    const stats = gameStats(state, todayISO());
    return `本月玩了 ${fmtMinutes(stats.monthMinutes)} · ${state.games.filter((g) => g.status === 'playing').length} 个在玩`;
  },
  mount(root, ctx) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      const id = el.dataset.id;
      if (act === 'filter') {
        filter = el.dataset.filter;
        return ctx.rerender();
      }
      if (act === 'new-game') return gameDrawer(ctx, null);
      if (act === 'edit-game') return gameDrawer(ctx, id);
      if (act === 'play') return playDrawer(ctx, id);
      if (act === 'del-play') {
        ctx.commit((state) => {
          state.playLogs = state.playLogs.filter((l) => l.id !== id);
        });
      }
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const stats = gameStats(state, todayISO());
    const games = state.games.filter((g) => (filter === 'all' ? true : g.status === filter));
    const recent = state.playLogs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">本月时长</div>
          <div class="metric-value">${(stats.monthMinutes / 60).toFixed(1)}<small>小时</small></div>
          <div class="metric-foot">${fmtMinutes(stats.monthMinutes)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">近四周平均</div>
          <div class="metric-value">${(stats.weekAvg / 60).toFixed(1)}<small>小时/周</small></div>
          <div class="metric-foot">按 28 天折算</div>
        </div>
        <div class="metric">
          <div class="metric-label">在玩</div>
          <div class="metric-value">${state.games.filter((g) => g.status === 'playing').length}<small>个</small></div>
          <div class="metric-foot">想玩 ${state.games.filter((g) => g.status === 'wishlist').length} 个</div>
        </div>
        <div class="metric">
          <div class="metric-label">最常玩</div>
          <div class="metric-value" style="font-size:16px">${stats.top[0] ? escapeHtml(stats.top[0].title) : '—'}</div>
          <div class="metric-foot">${stats.top[0] ? fmtMinutes(stats.top[0].minutes) : '本月还没记录'}</div>
        </div>
      </div>

      <div class="row-between section-gap" style="margin-bottom:12px">
        <div class="tabs" style="margin:0;border:none">
          ${[{ key: 'all', label: '全部' }, ...Object.entries(STATUS).map(([k, v]) => ({ key: k, label: v.label }))]
            .map(
              (t) =>
                `<button class="tab ${filter === t.key ? 'active' : ''}" data-act="filter" data-filter="${t.key}">${t.label}</button>`
            )
            .join('')}
        </div>
        <button class="btn btn-primary btn-sm" data-act="new-game">${icon('plus', 13)} 添加游戏</button>
      </div>

      ${
        !games.length
          ? `<section class="card">${emptyHTML({
              iconName: 'game',
              title: filter === 'all' ? '还没有游戏' : '这个分类是空的',
              desc: '把在玩的、想玩的都记下来，顺手记时长',
              actionLabel: '添加游戏',
              action: 'new-game'
            })}</section>`
          : `<div class="grid grid-3">
              ${games
                .map((g) => {
                  const mins = gameMinutes(state, g.id);
                  return `<section class="card card-tight">
                    <div class="row" style="gap:10px;align-items:flex-start">
                      <div style="width:38px;height:38px;border-radius:9px;background:${g.color};color:#fff;display:grid;place-items:center;font-size:15px;flex-shrink:0">${escapeHtml(
                    g.title.slice(0, 1)
                  )}</div>
                      <div class="grow" style="min-width:0">
                        <div class="truncate strong" style="font-size:13.5px">${escapeHtml(g.title)}</div>
                        <div class="tiny hint">${escapeHtml(g.platform || '—')} · 累计 ${fmtMinutes(mins)}</div>
                      </div>
                      <button class="icon-btn" data-act="edit-game" data-id="${escapeHtml(g.id)}">${icon('edit', 13)}</button>
                    </div>
                    <div class="row-between" style="margin-top:10px">
                      <span class="chip ${STATUS[g.status].chip}">${STATUS[g.status].label}</span>
                      <button class="btn btn-sm" data-act="play" data-id="${escapeHtml(g.id)}">${icon('play', 12)} 记一次</button>
                    </div>
                  </section>`;
                })
                .join('')}
            </div>`
      }

      ${
        recent.length
          ? `<section class="card section-gap">
              <div class="card-head"><div class="card-title">${icon('clock', 15)} 最近游玩</div></div>
              <div class="list">
                ${recent
                  .map((l) => {
                    const g = state.games.find((x) => x.id === l.gameId);
                    return `<div class="list-row" style="border-top:none">
                      <span class="tiny mono hint" style="width:58px">${escapeHtml(l.date.slice(5))}</span>
                      <span class="grow small">${escapeHtml(g ? g.title : '（已删除）')}</span>
                      <span class="tiny hint truncate" style="max-width:200px">${escapeHtml(l.mood || '')}</span>
                      <span class="chip">${fmtMinutes(l.minutes)}</span>
                      <button class="icon-btn danger" data-act="del-play" data-id="${escapeHtml(l.id)}">${icon('trash', 12)}</button>
                    </div>`;
                  })
                  .join('')}
              </div>
            </section>`
          : ''
      }
    `;
  }
};
