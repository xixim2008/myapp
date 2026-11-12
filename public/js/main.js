import { api } from './api.js';
import { createStore } from './store.js';
import { icon } from './components/icons.js';
import { toast, confirmDialog, openDrawer } from './components/ui.js';
import { escapeHtml, greeting, todayISO, fmtCN, weekdayCN } from './utils.js';
import { openPlansCount, devStats, followUpClients } from './stats.js';

import home from './pages/home.js';
import plan from './pages/plan.js';
import content from './pages/content.js';
import dev from './pages/dev.js';
import consult from './pages/consult.js';
import fitness from './pages/fitness.js';
import diet from './pages/diet.js';
import game from './pages/game.js';
import settings from './pages/settings.js';

const NAV = [
  {
    group: '今日',
    items: [
      { id: 'home', hash: '#/', label: '首页总览', icon: 'home', page: home },
      { id: 'plan', hash: '#/plan', label: '今日计划', icon: 'plan', page: plan }
    ]
  },
  {
    group: '创作',
    items: [{ id: 'content', hash: '#/content', label: '自媒体', icon: 'content', page: content }]
  },
  {
    group: '工作',
    items: [
      { id: 'dev', hash: '#/dev', label: '开发工作', icon: 'dev', page: dev },
      { id: 'consult', hash: '#/consult', label: '咨询工作', icon: 'consult', page: consult }
    ]
  },
  {
    group: '生活',
    items: [
      { id: 'fitness', hash: '#/fitness', label: '健身计划', icon: 'fitness', page: fitness },
      { id: 'diet', hash: '#/diet', label: '饮食计划', icon: 'diet', page: diet },
      { id: 'game', hash: '#/game', label: '游戏娱乐', icon: 'game', page: game }
    ]
  },
  {
    group: '系统',
    items: [{ id: 'settings', hash: '#/settings', label: '数据与设置', icon: 'settings', page: settings }]
  }
];

const ALL = NAV.flatMap((g) => g.items);
const sidebarEl = document.getElementById('sidebar');
const topbarEl = document.getElementById('topbar');
const viewEl = document.getElementById('view');

let store = null;
let pageRoot = null;
let mountedId = null;

function currentRoute() {
  const hash = location.hash || '#/';
  const found = ALL.find((item) => item.hash === hash);
  if (found) return found;
  if (hash === '#' || hash === '') return ALL[0];
  return ALL[0];
}

function timeOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function countsFor(id, state) {
  if (!state) return 0;
  if (id === 'plan') return openPlansCount(state, todayISO());
  if (id === 'dev') return devStats(state, todayISO()).open;
  if (id === 'consult') return followUpClients(state, todayISO()).length;
  if (id === 'content') return (state.contents || []).filter((c) => c.status === 'ready').length;
  return 0;
}

function renderSidebar(route) {
  const state = store ? store.state : null;
  sidebarEl.innerHTML = `
    <div class="brand">
      <div class="brand-mark">W</div>
      <div class="brand-text">
        <div class="brand-name">我的工作台</div>
        <div class="brand-sub">本地 · 私有</div>
      </div>
    </div>
    <nav class="nav">
      ${NAV.map(
        (group) => `
        <div class="nav-group">${group.group}</div>
        ${group.items
          .map((item) => {
            const count = countsFor(item.id, state);
            return `<button class="nav-item ${route.id === item.id ? 'active' : ''}" data-hash="${
              item.hash
            }">${icon(item.icon, 16)}<span>${item.label}</span>${
              count ? `<span class="nav-count">${count}</span>` : ''
            }</button>`;
          })
          .join('')}`
      ).join('')}
    </nav>
    <div class="sidebar-foot">
      <div class="save-state" id="save-state" data-state="clean">
        <i class="dot"></i><span class="save-text">已保存</span>
      </div>
    </div>`;

  sidebarEl.querySelectorAll('[data-hash]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = btn.dataset.hash;
    });
  });
}

function renderTopbar(route) {
  const state = store ? store.state : null;
  topbarEl.innerHTML = `
    <div>
      <div class="topbar-title">${escapeHtml(route.page.title || route.label)}</div>
      <div class="topbar-sub">${
        route.page.subtitle && state ? escapeHtml(route.page.subtitle(state, todayISO())) : ''
      }</div>
    </div>
    <div class="topbar-actions">
      <span class="save-state" id="save-state" data-state="clean"><i class="dot"></i><span class="save-text">已保存</span></span>
      <button class="btn" id="save-btn">${icon('save', 14)}<span>保存</span></button>
    </div>`;

  topbarEl.querySelector('#save-btn').addEventListener('click', async () => {
    const res = await store.flush();
    if (res.ok) toast(res.skipped ? '当前没有需要保存的改动' : '已保存');
    else toast('保存失败：' + res.error, 'error');
  });

  paintStatus(store ? store.status : { kind: 'clean', savedAt: null });
}

function paintStatus(status) {
  document.querySelectorAll('#save-state').forEach((el) => {
    el.dataset.state = status.kind;
    const text = el.querySelector('.save-text');
    if (!text) return;
    if (status.kind === 'saving') text.textContent = '保存中…';
    else if (status.kind === 'dirty') text.textContent = '有未保存改动';
    else if (status.kind === 'error') text.textContent = '保存失败';
    else if (status.kind === 'conflict') text.textContent = '保存已暂停';
    else text.textContent = status.savedAt ? `已保存 ${timeOf(status.savedAt)}` : '已保存';
    el.title =
      status.kind === 'error'
        ? status.error || '保存失败，请点击保存重试'
        : status.kind === 'conflict'
        ? '这份数据已被其他页面更新，为避免覆盖已暂停保存'
        : status.savedAt
        ? `最后保存：${new Date(status.savedAt).toLocaleString('zh-CN')}`
        : '';
  });
  paintConflictBanner(status);
}

/** 撞版本时在内容区顶部挂一条醒目提示，两个出口：刷新（安全）/ 强行覆盖（明确意图） */
function paintConflictBanner(status) {
  const host = document.querySelector('#conflict-host');
  if (!host) return;
  const show = status.kind === 'conflict';
  host.dataset.show = show ? '1' : '0';
  if (!show) {
    host.innerHTML = '';
    return;
  }
  if (host.dataset.rendered === '1') return;
  host.dataset.rendered = '1';
  host.innerHTML = `
    <div class="conflict-bar" role="alert">
      <span class="conflict-icon">${icon('alert', 16)}</span>
      <div class="conflict-text">
        <strong>保存已暂停：这份数据在别处被更新过</strong>
        <span class="tiny">继续保存会覆盖另一个页面刚存的内容。建议先刷新看看最新数据。</span>
      </div>
      <button class="btn btn-sm" data-conflict="reload">刷新页面</button>
      <button class="btn btn-sm btn-ghost" data-conflict="force">用本页覆盖</button>
    </div>`;
  host.querySelector('[data-conflict="reload"]').addEventListener('click', () => location.reload());
  host.querySelector('[data-conflict="force"]').addEventListener('click', async () => {
    host.dataset.rendered = '0';
    const res = await store.flush({ force: true });
    if (res.ok) toast('已用本页数据覆盖保存');
    else toast('覆盖失败：' + res.error, 'error');
  });
}

function makeCtx() {
  return {
    get state() {
      return store.state;
    },
    store,
    commit: (fn) => store.commit(fn),
    rerender: () => store.refresh(),
    flush: () => store.flush(),
    navigate: (hash) => {
      location.hash = hash;
    },
    toast,
    confirm: confirmDialog,
    openDrawer
  };
}

function renderView() {
  const route = currentRoute();
  const ctx = makeCtx();

  if (mountedId !== route.id) {
    if (pageRoot) pageRoot.remove();
    pageRoot = document.createElement('div');
    pageRoot.className = 'page';
    viewEl.appendChild(pageRoot);
    viewEl.scrollTop = 0;
    route.page.mount && route.page.mount(pageRoot, ctx);
    mountedId = route.id;
  }
  pageRoot.classList.toggle('page-wide', Boolean(route.page.wide));
  route.page.render(pageRoot, ctx);
  renderTopbar(route);
  renderSidebar(route);
}

function renderFatal(message, detail = '') {
  viewEl.innerHTML = `<div class="page">
    <div class="card" style="max-width:640px;margin:40px auto">
      <div class="row" style="gap:10px;margin-bottom:10px">${icon('alert', 18)}<div class="strong">数据打不开</div></div>
      <p class="muted small" style="line-height:1.7">${escapeHtml(message)}</p>
      ${detail ? `<pre class="mono tiny" style="background:var(--surface-2);padding:10px;border-radius:8px;overflow:auto">${escapeHtml(
        detail
      )}</pre>` : ''}
      <div class="divider"></div>
      <p class="small muted" style="line-height:1.8">
        如果是数据文件损坏，程序不会覆盖你的原文件。可以这样做：<br />
        1. 打开项目里的 <span class="mono">data</span> 文件夹<br />
        2. 把 <span class="mono">data.json.bak</span> 复制一份改名为 <span class="mono">data.json</span><br />
        3. 回到这个页面按 F5 刷新
      </p>
      <button class="btn btn-primary" style="margin-top:14px" onclick="location.reload()">重新加载</button>
    </div>
  </div>`;
}

async function boot() {
  let data;
  try {
    data = await api.getData();
  } catch (err) {
    renderSidebar(ALL[0]);
    renderFatal(err.message || '无法连接本地服务', err.corrupted ? '文件可能不是合法的 JSON' : '');
    return;
  }

  document.documentElement.dataset.theme = (data.settings && data.settings.theme) || 'light';

  store = createStore(data, { save: (state, opts) => api.saveData(state, opts), debounceMs: 1500 });
  store.subscribe(() => renderView());
  store.onStatus(paintStatus);

  window.addEventListener('hashchange', renderView);

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      store.flush().then((res) => {
        if (res.ok) toast(res.skipped ? '当前没有需要保存的改动' : '已保存');
        else toast('保存失败：' + res.error, 'error');
      });
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (store.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 页面切到后台或即将卸载时抢存一次，避免「改完 1 秒内关页面」丢数据
  window.addEventListener('pagehide', () => {
    if (store.dirty) store.flush({ beacon: true }).catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && store.dirty) {
      store.flush().catch(() => {});
    }
  });

  renderView();
}

boot();
