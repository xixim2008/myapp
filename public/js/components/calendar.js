import { icon } from './icons.js';
import { monthMatrix, weekdayOrder, todayISO, fmtMonth, monthOf, yearOf } from '../utils.js';

/**
 * 通用月历
 * @param {{year:number, month:number, weekStart?:number, selected?:string, cell:(iso:string, inMonth:boolean)=>string}} opts
 */
export function calendarHTML({ year, month, weekStart = 1, selected, cell }) {
  const weeks = monthMatrix(year, month, weekStart);
  const today = todayISO();
  const heads = weekdayOrder(weekStart);

  const cells = weeks
    .flat()
    .map((iso) => {
      const inMonth = yearOf(iso) === year && monthOf(iso) === month;
      const classes = ['cal-cell'];
      if (!inMonth) classes.push('dim');
      if (iso === today) classes.push('today');
      if (iso === selected) classes.push('selected');
      return `<button class="${classes.join(' ')}" data-date="${iso}" ${inMonth ? '' : 'tabindex="-1"'}>
        <span class="cal-daynum">${Number(iso.slice(8, 10))}</span>
        ${inMonth ? cell(iso, true) : cell(iso, false)}
      </button>`;
    })
    .join('');

  return `<div class="calendar">
    <div class="cal-head">
      <div class="cal-month">${fmtMonth(year, month)}</div>
      <div class="row" style="margin-left:auto;gap:2px">
        <button class="icon-btn" data-act="cal-prev" aria-label="上个月">${icon('left', 16)}</button>
        <button class="btn btn-sm" data-act="cal-today">今天</button>
        <button class="icon-btn" data-act="cal-next" aria-label="下个月">${icon('right', 16)}</button>
      </div>
    </div>
    <div class="cal-weekdays">${heads.map((h) => `<div>${h}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
  </div>`;
}
