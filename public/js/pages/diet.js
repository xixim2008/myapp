import { icon } from '../components/icons.js';
import { calendarHTML } from '../components/calendar.js';
import { escapeHtml, todayISO, fmtCN, weekdayCN, addDays, uid, parseISO } from '../utils.js';
import { mealOn, mealSummary } from '../stats.js';

const SLOTS = [
  { key: 'breakfast', label: '早餐', icon: 'sun' },
  { key: 'lunch', label: '午餐', icon: 'diet' },
  { key: 'dinner', label: '晚餐', icon: 'moon' },
  { key: 'snack', label: '加餐 / 零食', icon: 'spark' }
];

let cursor = null;
let selected = todayISO();

function initCursor() {
  if (cursor) return;
  const d = new Date();
  cursor = { y: d.getFullYear(), m: d.getMonth() };
}

function ensureMeal(state, iso) {
  let m = state.meals.find((x) => x.date === iso);
  if (!m) {
    m = { id: uid('meal_'), date: iso, breakfast: [], lunch: [], dinner: [], snack: [], water: 0, note: '' };
    state.meals.push(m);
  }
  return m;
}

function dayRecorded(state, iso) {
  const m = state.meals.find((x) => x.date === iso);
  return m ? mealSummary(m) : { recorded: 0, water: 0 };
}

function weekWaterAvg(state) {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const iso = addDays(todayISO(), -i);
    days.push(dayRecorded(state, iso).water);
  }
  const recorded = days.filter((d) => d > 0);
  return recorded.length ? Math.round((recorded.reduce((a, b) => a + b, 0) / recorded.length) * 10) / 10 : 0;
}

export default {
  id: 'diet',
  title: '饮食计划',
  subtitle(state) {
    const today = dayRecorded(state, todayISO());
    return today.recorded
      ? `今天已记 ${today.recorded} 餐 · 水 ${today.water} 杯`
      : '今天还没有饮食记录';
  },
  mount(root, ctx) {
    initCursor();

    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      const cell = e.target.closest('[data-date]');

      if (el && el.dataset.act === 'cal-prev') {
        const m = cursor.m - 1;
        cursor = m < 0 ? { y: cursor.y - 1, m: 11 } : { y: cursor.y, m };
        return ctx.rerender();
      }
      if (el && el.dataset.act === 'cal-next') {
        const m = cursor.m + 1;
        cursor = m > 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m };
        return ctx.rerender();
      }
      if (el && el.dataset.act === 'cal-today') {
        const d = new Date();
        cursor = { y: d.getFullYear(), m: d.getMonth() };
        selected = todayISO();
        return ctx.rerender();
      }
      if (el && el.dataset.act === 'add-item') {
        const slot = el.dataset.slot;
        const input = root.querySelector(`#meal-${slot}`);
        const text = input.value.trim();
        if (!text) return;
        ctx.commit((state) => {
          const m = ensureMeal(state, selected);
          m[slot] = m[slot] || [];
          m[slot].push(text);
        });
        input.value = '';
        return;
      }
      if (el && el.dataset.act === 'del-item') {
        const slot = el.dataset.slot;
        const idx = Number(el.dataset.idx);
        ctx.commit((state) => {
          const m = state.meals.find((x) => x.date === selected);
          if (!m || !m[slot]) return;
          m[slot].splice(idx, 1);
        });
        return;
      }
      if (el && el.dataset.act === 'water') {
        const delta = Number(el.dataset.delta);
        ctx.commit((state) => {
          const m = ensureMeal(state, selected);
          m.water = Math.max(0, (Number(m.water) || 0) + delta);
        });
        return;
      }
      if (cell && !cell.classList.contains('dim')) {
        selected = cell.dataset.date;
        const d = parseISO(selected);
        cursor = { y: d.getFullYear(), m: d.getMonth() };
        ctx.rerender();
      }
    });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const input = e.target.closest('[data-slot-input]');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      const slot = input.dataset.slotInput;
      ctx.commit((state) => {
        const m = ensureMeal(state, selected);
        m[slot] = m[slot] || [];
        m[slot].push(text);
      });
      input.value = '';
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'meal-note') {
        const v = e.target.value.trim();
        ctx.commit((state) => {
          const m = ensureMeal(state, selected);
          m.note = v;
        });
      }
    });
  },
  render(root, ctx) {
    initCursor();
    const state = ctx.state;
    const weekStart = (state.settings && state.settings.weekStart) ?? 1;
    const meal = mealOn(state, selected);
    const sum = mealSummary(meal);
    const monthKeyStr = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
    const monthDays = state.meals.filter((m) => m.date.slice(0, 7) === monthKeyStr && mealSummary(m).recorded > 0).length;
    const water = weekWaterAvg(state);

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">今天记录</div>
          <div class="metric-value">${dayRecorded(state, todayISO()).recorded}<small>/4 餐</small></div>
          <div class="metric-foot">水 ${dayRecorded(state, todayISO()).water} 杯</div>
        </div>
        <div class="metric">
          <div class="metric-label">本月记录</div>
          <div class="metric-value">${monthDays}<small>天</small></div>
          <div class="metric-foot">当月有饮食记录的天数</div>
        </div>
        <div class="metric">
          <div class="metric-label">近 7 天饮水</div>
          <div class="metric-value">${water}<small>杯/天</small></div>
          <div class="metric-foot">按记录过水的天数算</div>
        </div>
        <div class="metric">
          <div class="metric-label">饮食记录总数</div>
          <div class="metric-value">${state.meals.length}</div>
          <div class="metric-foot">每天一条</div>
        </div>
      </div>

      <div class="section-gap">
        ${calendarHTML({
          year: cursor.y,
          month: cursor.m,
          weekStart,
          selected,
          cell: (iso, inMonth) => {
            if (!inMonth) return '';
            const m = state.meals.find((x) => x.date === iso);
            const s = m ? mealSummary(m) : { recorded: 0, water: 0 };
            if (!s.recorded && !s.water) return '<span class="cal-dots"></span>';
            return `<span class="cal-tags">${['breakfast', 'lunch', 'dinner']
              .map((k, i) => (m && m[k] && m[k].length ? `<i class="cal-dot" style="background:var(--m-diet)"></i>` : '<i class="cal-dot" style="background:var(--border-2)"></i>'))
              .join('')}</span>
              <span class="tiny hint" style="margin-top:auto">${
                s.water ? '水 ' + s.water + ' 杯' : s.recorded ? s.recorded + ' 餐' : ''
              }</span>`;
          }
        })}
      </div>

      <div class="grid section-gap" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${fmtCN(selected)} ${weekdayCN(selected)}${
      selected === todayISO() ? ' · 今天' : ''
    }</div>
              <div class="tiny hint">${sum.recorded} 餐已记 · 水 ${sum.water} 杯</div>
            </div>
            <div class="row" style="gap:4px">
              <button class="icon-btn" data-act="water" data-delta="-1" title="减一杯">${icon('left', 14)}</button>
              <span class="small num" style="min-width:34px;text-align:center">${sum.water} 杯</span>
              <button class="icon-btn" data-act="water" data-delta="1" title="加一杯">${icon('right', 14)}</button>
            </div>
          </div>

          ${SLOTS.map((slot) => {
            const items = (meal && meal[slot.key]) || [];
            return `<div style="padding:10px 0;border-top:1px solid var(--border)">
              <div class="row" style="gap:6px;margin-bottom:6px">
                ${icon(slot.icon, 14)}
                <span class="small strong">${slot.label}</span>
                <span class="tiny hint">${items.length ? items.length + ' 项' : '未记录'}</span>
              </div>
              ${
                items.length
                  ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
                      ${items
                        .map(
                          (t, i) =>
                            `<span class="chip chip-diet">${escapeHtml(t)}
                              <button data-act="del-item" data-slot="${slot.key}" data-idx="${i}" style="margin-left:2px;opacity:.6">×</button>
                            </span>`
                        )
                        .join('')}
                    </div>`
                  : ''
              }
              <div class="row" style="gap:6px">
                <input class="input input-sm" id="meal-${slot.key}" data-slot-input="${slot.key}"
                  placeholder="吃了什么？回车添加" autocomplete="off" />
                <button class="btn btn-sm" data-act="add-item" data-slot="${slot.key}">添加</button>
              </div>
            </div>`;
          }).join('')}

          <div style="margin-top:12px">
            <span class="label">当天备注</span>
            <input class="input input-sm" id="meal-note" placeholder="吃多了、外食、想调整的地方" value="${escapeHtml(
              (meal && meal.note) || ''
            )}" />
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div class="card-title">${icon('diet', 15)} 记录情况</div></div>
          <div class="list">
            <div class="list-row" style="border-top:none">
              <span class="grow small">本月记录天数</span><span class="strong num">${monthDays}</span>
            </div>
            <div class="list-row">
              <span class="grow small">连续记录</span><span class="strong num">${(() => {
                let n = 0;
                let iso = todayISO();
                while (dayRecorded(state, iso).recorded > 0) {
                  n += 1;
                  iso = addDays(iso, -1);
                }
                return n;
              })()} 天</span>
            </div>
            <div class="list-row">
              <span class="grow small">近 7 天平均饮水</span><span class="strong num">${water} 杯</span>
            </div>
          </div>
          <p class="tiny hint" style="margin-top:10px">只做记录，不算热量、不给建议。想复盘时看日历就知道这周吃得乱不乱。</p>
        </section>
      </div>
    `;
  }
};
