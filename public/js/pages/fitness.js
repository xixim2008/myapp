import { icon } from '../components/icons.js';
import { calendarHTML } from '../components/calendar.js';
import { escapeHtml, todayISO, fmtCN, weekdayCN, addDays, uid, parseISO } from '../utils.js';
import { PARTS, partFrequency, weekWorkoutDays, workoutsOn, exerciseCandidates, workoutVolume } from '../stats.js';

let cursor = null; // { y, m }
let selected = todayISO();
let lastPart = 'chest';

function initCursor() {
  if (cursor) return;
  const d = new Date();
  cursor = { y: d.getFullYear(), m: d.getMonth() };
}

function partMeta(key) {
  return PARTS.find((p) => p.key === key) || { label: key, color: 'var(--text-3)' };
}

function getWorkout(state, iso) {
  return state.workouts.find((w) => w.date === iso) || null;
}

function streakDays(state) {
  let count = 0;
  let iso = workoutsOn(state, todayISO()).length ? todayISO() : addDays(todayISO(), -1);
  const days = new Set(state.workouts.map((w) => w.date));
  while (days.has(iso)) {
    count += 1;
    iso = addDays(iso, -1);
  }
  return count;
}

export default {
  id: 'fitness',
  title: '健身计划',
  subtitle(state) {
    const days = weekWorkoutDays(state, todayISO(), (state.settings && state.settings.weekStart) ?? 1);
    return `本周练了 ${days} 天 · 连续打卡 ${streakDays(state)} 天`;
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
      if (el && el.dataset.act === 'add-ex') {
        const part = root.querySelector('#ex-part').value;
        const name = root.querySelector('#ex-name').value.trim();
        const sets = Number(root.querySelector('#ex-sets').value) || 0;
        const reps = Number(root.querySelector('#ex-reps').value) || 0;
        const weight = Number(root.querySelector('#ex-weight').value) || 0;
        if (!name) {
          ctx.toast('先写动作名称', 'error');
          return;
        }
        if (!sets || !reps) {
          ctx.toast('组数和次数要大于 0', 'error');
          return;
        }
        lastPart = part;
        ctx.commit((state) => {
          let w = getWorkout(state, selected);
          if (!w) {
            w = {
              id: uid('w_'),
              date: selected,
              parts: [],
              exercises: [],
              duration: null,
              note: ''
            };
            state.workouts.push(w);
          }
          w.exercises.push({ id: uid('e_'), part, name, sets, reps, weight });
          if (!w.parts.includes(part)) w.parts.push(part);
        });
        root.querySelector('#ex-name').value = '';
        root.querySelector('#ex-weight').value = '';
        return;
      }
      if (el && el.dataset.act === 'del-ex') {
        const id = el.dataset.id;
        ctx.commit((state) => {
          const w = getWorkout(state, selected);
          if (!w) return;
          w.exercises = w.exercises.filter((x) => x.id !== id);
          const parts = new Set(w.exercises.map((x) => x.part));
          w.parts = Array.from(parts);
          if (!w.exercises.length) {
            state.workouts = state.workouts.filter((x) => x.id !== w.id);
          }
        });
        return;
      }
      if (el && el.dataset.act === 'del-workout') {
        ctx.confirm({
          title: '删除当天训练',
          message: `${fmtCN(selected)} 的整条训练记录将被删除。`,
          confirmText: '删除',
          danger: true
        }).then((ok) => {
          if (!ok) return;
          ctx.commit((state) => {
            state.workouts = state.workouts.filter((w) => w.date !== selected);
          });
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

    root.addEventListener('change', (e) => {
      if (e.target.id === 'w-duration') {
        const v = Number(e.target.value) || null;
        ctx.commit((state) => {
          const w = getWorkout(state, selected);
          if (w) w.duration = v;
        });
      }
      if (e.target.id === 'w-note') {
        const v = e.target.value.trim();
        ctx.commit((state) => {
          const w = getWorkout(state, selected);
          if (w) w.note = v;
        });
      }
    });
  },
  render(root, ctx) {
    initCursor();
    const state = ctx.state;
    const weekStart = (state.settings && state.settings.weekStart) ?? 1;
    const workout = getWorkout(state, selected);
    const weekFreq = partFrequency(state, selected, weekStart);
    const candidates = exerciseCandidates(state, 40);

    const restParts = new Set(weekFreq.filter((p) => p.count > 0).map((p) => p.key)).size;
    const monthCount = state.workouts.filter((w) => w.date.slice(0, 7) === `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`).length;
    const weekDays = weekWorkoutDays(state, todayISO(), weekStart);

    root.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">本周训练</div>
          <div class="metric-value">${weekDays}<small>天</small></div>
          <div class="metric-foot">${weekDays >= 4 ? '节奏不错' : '还能再练一次'}</div>
        </div>
        <div class="metric">
          <div class="metric-label">本月训练</div>
          <div class="metric-value">${monthCount}<small>次</small></div>
          <div class="metric-foot">${fmtCN(selected).slice(0, 3)}月内</div>
        </div>
        <div class="metric">
          <div class="metric-label">连续打卡</div>
          <div class="metric-value">${streakDays(state)}<small>天</small></div>
          <div class="metric-foot">别断</div>
        </div>
        <div class="metric">
          <div class="metric-label">本周练到</div>
          <div class="metric-value">${restParts}<small>/7 部位</small></div>
          <div class="metric-foot">${restParts >= 4 ? '覆盖不错' : '注意别漏'}</div>
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
            const w = getWorkout(state, iso);
            if (!w) return '<span class="cal-dots"></span>';
            return `<span class="cal-tags">${(w.parts || [])
              .slice(0, 3)
              .map((p) => `<span class="cal-tag" style="color:${partMeta(p).color}">${partMeta(p).label}</span>`)
              .join('')}</span>
              <span class="cal-dots">${(w.parts || [])
                .slice(0, 4)
                .map((p) => `<i class="cal-dot" style="background:${partMeta(p).color}"></i>`)
                .join('')}<span class="tiny hint" style="margin-left:auto">${(w.exercises || []).length} 动作</span></span>`;
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
              <div class="tiny hint">${
                workout
                  ? `${workout.exercises.length} 个动作 · 总容量 ${workoutVolume(workout)} 次`
                  : '还没有记录'
              }</div>
            </div>
            ${workout ? `<button class="icon-btn danger" data-act="del-workout" title="删除整天">${icon('trash', 14)}</button>` : ''}
          </div>

          ${
            workout && workout.exercises.length
              ? `<div class="table-wrap" style="border:none">
                  <table class="table">
                    <thead><tr><th>部位</th><th>动作</th><th class="num">组</th><th class="num">次</th><th class="num">重量</th><th style="width:36px"></th></tr></thead>
                    <tbody>
                      ${workout.exercises
                        .map(
                          (ex) => `<tr>
                          <td><span class="chip" style="color:${partMeta(ex.part).color};background:var(--surface-3)">${
                            partMeta(ex.part).label
                          }</span></td>
                          <td>${escapeHtml(ex.name)}</td>
                          <td class="num">${ex.sets}</td>
                          <td class="num">${ex.reps}</td>
                          <td class="num">${ex.weight ? ex.weight + ' kg' : '—'}</td>
                          <td><button class="icon-btn danger" data-act="del-ex" data-id="${escapeHtml(
                            ex.id
                          )}">${icon('trash', 13)}</button></td>
                        </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : `<div class="list-empty" style="text-align:left;padding:10px 0">这天还没有训练记录，在下面加第一个动作。</div>`
          }

          <div class="divider"></div>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <select class="select" id="ex-part" style="width:92px">
              ${PARTS.map(
                (p) => `<option value="${p.key}" ${p.key === lastPart ? 'selected' : ''}>${p.label}</option>`
              ).join('')}
            </select>
            <input class="input" id="ex-name" list="ex-list" placeholder="动作名，如卧推" style="flex:1;min-width:120px" />
            <datalist id="ex-list">${candidates.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('')}</datalist>
            <input class="input" id="ex-sets" type="number" min="1" placeholder="组" style="width:58px" value="4" />
            <input class="input" id="ex-reps" type="number" min="1" placeholder="次" style="width:58px" value="10" />
            <input class="input" id="ex-weight" type="number" min="0" step="2.5" placeholder="kg" style="width:70px" />
            <button class="btn btn-primary btn-sm" data-act="add-ex">${icon('plus', 13)} 添加</button>
          </div>

          ${
            workout
              ? `<div class="row" style="gap:10px;margin-top:12px;align-items:flex-start">
                  <div style="width:110px">
                    <span class="label">时长（分钟）</span>
                    <input class="input input-sm" id="w-duration" type="number" min="0" value="${
                      workout.duration || ''
                    }" />
                  </div>
                  <div class="grow">
                    <span class="label">当天感受</span>
                    <input class="input input-sm" id="w-note" placeholder="状态如何、哪里不舒服" value="${escapeHtml(
                      workout.note || ''
                    )}" />
                  </div>
                </div>`
              : ''
          }
        </section>

        <section class="card">
          <div class="card-head"><div class="card-title">${icon('chart', 15)} 本周部位分布</div></div>
          <div class="list">
            ${weekFreq
              .map(
                (p) => `<div class="list-row" style="min-height:34px;padding:6px 0;border-top:none">
                  <i class="dot" style="background:${p.color}"></i>
                  <span class="small grow">${p.label}</span>
                  <div class="bar" style="width:90px"><i style="width:${Math.min(
                    100,
                    p.count * 40
                  )}%;background:${p.color}"></i></div>
                  <span class="tiny hint num" style="width:16px;text-align:right">${p.count}</span>
                </div>`
              )
              .join('')}
          </div>
          <p class="tiny hint" style="margin-top:8px">数字是本周练这个部位的天数。</p>
        </section>
      </div>
    `;
  }
};
