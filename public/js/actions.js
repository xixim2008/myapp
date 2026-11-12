import { uid, todayISO } from './utils.js';

/** 把一件事加到今日计划（单向，不反向同步） */
export function addToPlan(ctx, title, module = null) {
  ctx.commit((state) => {
    state.plans.push({
      id: uid('p_'),
      title,
      date: todayISO(),
      done: false,
      doneAt: null,
      priority: 'mid',
      time: null,
      module,
      note: '',
      sort: 0,
      createdAt: new Date().toISOString()
    });
  });
  ctx.toast('已加入今日计划');
}
