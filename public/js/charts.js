/* 手写 SVG 图表：折线图与柱状图。零依赖，离线可用。 */

function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(v >= 100000 ? 0 : 1) + '万';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(Math.round(v));
}

function niceMax(max) {
  if (max <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * 折线图
 * @param {{labels: string[], series: {name: string, color: string, values: number[]}[], height?: number, format?: Function}} opts
 */
export function lineChartHTML({ labels = [], series = [], height = 210, format = compact }) {
  const W = 800;
  const P = { l: 46, r: 16, t: 14, b: 26 };
  const ih = height - P.t - P.b;
  const iw = W - P.l - P.r;

  const allValues = series.flatMap((s) => s.values || []);
  const maxRaw = Math.max(0, ...allValues);
  if (!labels.length || maxRaw === 0) {
    return `<div class="chart-empty">还没有数据，录入一次就会出现在这里</div>`;
  }
  const max = niceMax(maxRaw);

  const x = (i) => (labels.length > 1 ? P.l + (i * iw) / (labels.length - 1) : P.l + iw / 2);
  const y = (v) => P.t + ih - (Math.max(0, v) / max) * ih;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));
  const grid = ticks
    .map(
      (t) =>
        `<line x1="${P.l}" y1="${y(t).toFixed(1)}" x2="${W - P.r}" y2="${y(t).toFixed(
          1
        )}" stroke="var(--border)" stroke-width="1" />
         <text x="${P.l - 8}" y="${y(t).toFixed(1)}" text-anchor="end" dominant-baseline="central" class="chart-axis">${format(
          t
        )}</text>`
    )
    .join('');

  const step = Math.max(1, Math.ceil(labels.length / 6));
  const xLabels = labels
    .map((l, i) =>
      i % step === 0 || i === labels.length - 1
        ? `<text x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${Number(
            l.slice(5, 7)
          )}/${Number(l.slice(8, 10))}</text>`
        : ''
    )
    .join('');

  const paths = series
    .map((s) => {
      const pts = (s.values || []).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      const dots = (s.values || [])
        .map(
          (v, i) =>
            `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${s.color}" stroke="var(--surface)" stroke-width="1"><title>${labels[i]} · ${s.name} ${format(
              v
            )}</title></circle>`
        )
        .join('');
      return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />${dots}`;
    })
    .join('');

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${height}" width="100%" role="img" aria-label="趋势折线图">
    ${grid}${xLabels}${paths}
  </svg>`;
}

/**
 * 柱状图
 * @param {{items: {label: string, value: number, color?: string}[], height?: number, format?: Function}} opts
 */
export function barChartHTML({ items = [], height = 190, format = compact }) {
  const W = 800;
  const P = { l: 46, r: 16, t: 18, b: 26 };
  const ih = height - P.t - P.b;
  const iw = W - P.l - P.r;
  const maxRaw = Math.max(0, ...items.map((i) => Number(i.value) || 0));
  if (!items.length || maxRaw === 0) {
    return `<div class="chart-empty">还没有数据，录入一次就会出现在这里</div>`;
  }
  const max = niceMax(maxRaw);
  const slot = iw / items.length;
  const barW = Math.min(56, slot * 0.46);

  const bars = items
    .map((item, i) => {
      const v = Number(item.value) || 0;
      const h = (v / max) * ih;
      const cx = P.l + slot * i + slot / 2;
      const yTop = P.t + ih - h;
      return `<g>
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(
        1
      )}" height="${Math.max(h, 1).toFixed(1)}" rx="4" fill="${item.color || 'var(--text-2)'}" opacity="0.9">
          <title>${item.label} ${format(v)}</title>
        </rect>
        <text x="${cx.toFixed(1)}" y="${(yTop - 7).toFixed(1)}" text-anchor="middle" class="chart-value">${format(
        v
      )}</text>
        <text x="${cx.toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${item.label}</text>
      </g>`;
    })
    .join('');

  const grid = [0, 0.5, 1]
    .map((r) => {
      const t = max * r;
      const yy = P.t + ih - (t / max) * ih;
      return `<line x1="${P.l}" y1="${yy.toFixed(1)}" x2="${W - P.r}" y2="${yy.toFixed(
        1
      )}" stroke="var(--border)" stroke-width="1" stroke-dasharray="${r === 0 ? '0' : '3 4'}" />`;
    })
    .join('');

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${height}" width="100%" role="img" aria-label="柱状图">
    ${grid}${bars}
  </svg>`;
}

export function legendHTML(series) {
  return `<div class="chart-legend">${series
    .map(
      (s) =>
        `<span class="legend-item"><i style="background:${s.color}"></i>${s.name}</span>`
    )
    .join('')}</div>`;
}

export function sparklineHTML(values = [], color = 'var(--text-2)', width = 120, height = 32) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const px = (i / Math.max(1, values.length - 1)) * width;
      const py = height - ((v - min) / span) * (height - 4) - 2;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(' ');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" /></svg>`;
}
