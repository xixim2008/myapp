import { icon } from '../components/icons.js';
import { field } from '../components/ui.js';
import { api } from '../api.js';
import { validateData, DATA_KEYS, MODULE_LABELS, SCHEMA_VERSION } from '../schema.js';
import { escapeHtml, fmtNum, fileNameStamp, todayISO } from '../utils.js';
import { moduleCounts } from '../stats.js';

let info = null;
let statusText = '';

async function refreshStatus(ctx) {
  try {
    info = await api.status();
  } catch {
    info = null;
  }
  ctx.rerender();
}

function exportBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `app-backup-${fileNameStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default {
  id: 'settings',
  title: '数据与设置',
  subtitle() {
    return '所有数据都存在本机 data/data.json';
  },
  mount(root, ctx) {
    refreshStatus(ctx);

    root.addEventListener('change', async (e) => {
      if (e.target.id === 'week-start') {
        const v = Number(e.target.value);
        ctx.commit((state) => {
          state.settings.weekStart = v;
        });
        ctx.toast('已切换');
        return;
      }
      if (e.target.id === 'theme') {
        const v = e.target.value;
        document.documentElement.dataset.theme = v;
        ctx.commit((state) => {
          state.settings.theme = v;
        });
        return;
      }
      if (e.target.id === 'import-file') {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        await handleImport(ctx, file);
      }
    });

    root.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;

      if (act === 'export') {
        await ctx.flush();
        exportBackup(ctx.state);
        ctx.toast('备份文件已下载');
        return;
      }
      if (act === 'pick-import') {
        root.querySelector('#import-file').click();
        return;
      }
      if (act === 'clear') {
        const key = root.querySelector('#clear-target').value;
        if (!key) return;
        const label = MODULE_LABELS[key];
        const count = (ctx.state[key] || []).length;
        const ok = await ctx.confirm({
          title: `清空「${label}」`,
          message: `将删除 ${count} 条${escapeHtml(label)}数据，其他模块不受影响。此操作不可撤销，建议先导出备份。`,
          confirmText: '确认清空',
          danger: true,
          requireText: label
        });
        if (!ok) return;
        ctx.commit((state) => {
          state[key] = [];
        });
        ctx.toast(`已清空${label}`);
        refreshStatus(ctx);
        return;
      }
      if (act === 'refresh-status') {
        refreshStatus(ctx);
      }
    });
  },
  render(root, ctx) {
    const state = ctx.state;
    const counts = moduleCounts(state);
    const total = counts.reduce((a, b) => a + b.count, 0);
    const size = info && info.size ? info.size : 0;
    const savedAt = (info && info.savedAt) || (state.settings && state.settings.lastSavedAt);

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">数据总条数</div>
          <div class="metric-value">${fmtNum(total)}</div>
          <div class="metric-foot">13 类数据合计</div>
        </div>
        <div class="metric">
          <div class="metric-label">数据文件</div>
          <div class="metric-value">${size ? (size / 1024).toFixed(1) : '0'}<small>KB</small></div>
          <div class="metric-foot">data/data.json</div>
        </div>
        <div class="metric">
          <div class="metric-label">最后保存</div>
          <div class="metric-value" style="font-size:15px">${
      savedAt ? new Date(savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'
    }</div>
          <div class="metric-foot">${savedAt ? new Date(savedAt).toLocaleDateString('zh-CN') : '还没有保存记录'}</div>
        </div>
        <div class="metric">
          <div class="metric-label">备份文件</div>
          <div class="metric-value" style="font-size:15px">${info && info.backupExists ? '存在' : '无'}</div>
          <div class="metric-foot">data.json.bak（上一版）</div>
        </div>
      </div>

      <div class="grid grid-2 section-gap">
        <section class="card">
          <div class="card-head">
            <div class="card-title">${icon('save', 15)} 备份与恢复</div>
            <button class="card-link" data-act="refresh-status">刷新状态</button>
          </div>
          <p class="small muted" style="line-height:1.7">
            导出的文件是一个完整 JSON，可以放到网盘或 U 盘。恢复时会覆盖当前全部数据，
            覆盖前的版本会自动保留成 <span class="mono">data.json.bak</span>。
          </p>
          <div class="row" style="gap:8px;margin-top:14px">
            <button class="btn" data-act="export">${icon('download', 14)} 导出备份</button>
            <button class="btn" data-act="pick-import">${icon('upload', 14)} 从备份恢复</button>
            <input type="file" id="import-file" accept=".json,application/json" style="display:none" />
          </div>
          <div class="divider"></div>
          <div class="row-between">
            <div>
              <div class="small strong">清空某个模块</div>
              <div class="tiny hint">只删这一块数据，其他不动；需要输入模块名确认</div>
            </div>
          </div>
          <div class="row" style="gap:8px;margin-top:10px">
            <select class="select" id="clear-target" style="flex:1">
              <option value="">选择要清空的模块…</option>
              ${DATA_KEYS.map(
                (key) =>
                  `<option value="${key}">${MODULE_LABELS[key]}（${(state[key] || []).length} 条）</option>`
              ).join('')}
            </select>
            <button class="btn btn-danger" data-act="clear">清空</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div class="card-title">${icon('settings', 15)} 偏好</div></div>
          <div class="form-grid">
            ${field(
              '一周从哪天开始',
              `<select class="select" id="week-start">
                <option value="1" ${state.settings.weekStart !== 0 ? 'selected' : ''}>周一</option>
                <option value="0" ${state.settings.weekStart === 0 ? 'selected' : ''}>周日</option>
              </select>`,
              '影响首页「本周」统计和日历排列'
            )}
            ${field(
              '主题',
              `<select class="select" id="theme">
                <option value="light" ${state.settings.theme !== 'dark' ? 'selected' : ''}>浅色</option>
                <option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>深色</option>
              </select>`
            )}
          </div>
          <div class="divider"></div>
          <div class="small muted" style="line-height:1.8">
            保存方式：改动后 1.5 秒自动写盘，也可以点右上角「保存」或按
            <span class="kbd">Ctrl</span> + <span class="kbd">S</span> 立即保存。<br />
            关掉浏览器、重启电脑都不会丢数据。
          </div>
        </section>
      </div>

      <section class="card section-gap">
        <div class="card-head">
          <div class="card-title">${icon('table', 15)} 各模块数据量</div>
          <span class="tiny hint">数据版本 v${SCHEMA_VERSION}</span>
        </div>
        <div class="table-wrap" style="border:none">
          <table class="table">
            <thead><tr><th>模块</th><th>字段</th><th class="num">条数</th></tr></thead>
            <tbody>
              ${counts
                .map(
                  (c) => `<tr>
                    <td>${c.label}</td>
                    <td class="mono tiny hint">${DATA_KEYS.includes(c.key) ? c.key : '—'}</td>
                    <td class="num">${c.count}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <p class="tiny hint" style="margin-top:12px;text-align:center">
        数据完全存在本机，不上传、不联网。今天的日期：${todayISO()}
      </p>
    `;
  }
};

async function handleImport(ctx, file) {
  let text;
  try {
    text = await file.text();
  } catch {
    ctx.toast('文件读取失败', 'error');
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    ctx.toast('这不是合法的 JSON 文件', 'error');
    return;
  }
  const check = validateData(data);
  if (!check.ok) {
    ctx.toast('备份文件结构不对：' + check.error, 'error');
    return;
  }
  const total = DATA_KEYS.reduce((acc, key) => acc + (data[key] || []).length, 0);
  const ok = await ctx.confirm({
    title: '从备份恢复',
    message: `将用这个文件覆盖当前全部数据（共 <b>${total}</b> 条）。当前数据会自动保留为 data.json.bak，但仍建议先导出一份。`,
    confirmText: '覆盖并恢复',
    danger: true
  });
  if (!ok) return;

  const res = await ctx.store.replaceAll(data);
  if (!res.ok) {
    ctx.toast('恢复失败：' + res.error, 'error');
    return;
  }
  document.documentElement.dataset.theme = (data.settings && data.settings.theme) || 'light';
  ctx.toast(`已恢复 ${total} 条数据`);
  statusText = '恢复完成';
  refreshStatus(ctx);
}
