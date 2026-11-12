const P = {
  home: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.8V20h12V9.8"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1.6 1.6L8.2 5"/>',
  content: '<path d="M3.5 7.5h12v9h-12z"/><path d="M15.5 11.2 20.5 8.5v7l-5-2.7z"/>',
  dev: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
  consult: '<path d="M20 11.6a7.6 7.6 0 0 1-7.6 7.6H8.2L4 22.4v-4.5A7.6 7.6 0 1 1 20 11.6z"/>',
  fitness: '<path d="M6.5 8.5v7M17.5 8.5v7M3.5 10.5v3M20.5 10.5v3M6.5 12h11"/>',
  diet: '<path d="M3.8 11.2h16.4a8.2 8.2 0 0 1-16.4 0z"/><path d="M9 7.6c0-1.3 1-1.9 1-3.1"/>',
  game: '<path d="M7.4 6.5h9.2a4 4 0 0 1 4 4v3.4a3.6 3.6 0 0 1-6.2 2.5l-.6-.6h-3.6l-.6.6a3.6 3.6 0 0 1-6.2-2.5V10.5a4 4 0 0 1 4-4z"/><path d="M8.6 10v3M7.1 11.5h3"/><circle cx="15.6" cy="11" r="0.9"/>',
  settings: '<path d="M4 8h9M17.5 8H20M4 16h2.5M11 16h9"/><circle cx="15" cy="8" r="2.1"/><circle cx="9" cy="16" r="2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.6 4.6L19 7.6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
  more: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  save: '<path d="M5 4.5h11L19.5 8v11.5h-15z"/><path d="M8.5 4.5v5h7v-5M8 19.5v-6h8v6"/>',
  calendar: '<path d="M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4"/>',
  chart: '<path d="M4 19.5V4.5M4 19.5h16"/><path d="M7.5 15.5l3.2-4.4 3 2.2L20 7"/>',
  bar: '<path d="M7 19.5V11M12 19.5V5.5M17 19.5v-5"/>',
  grid: '<path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z"/>',
  table: '<path d="M4.5 5.5h15v13h-15zM4.5 10h15M10 10v8.5"/>',
  download: '<path d="M12 4v11M8 11.5l4 4 4-4M5 19.5h14"/>',
  upload: '<path d="M12 16V5M8 8.5l4-4 4 4M5 19.5h14"/>',
  alert: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4M12 16.6v.1"/>',
  clock: '<circle cx="12" cy="12" r="7.2"/><path d="M12 8.4V12l2.6 2"/>',
  target: '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="3.4"/>',
  play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
  search: '<circle cx="10.6" cy="10.6" r="6"/><path d="M15 15l4.5 4.5"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M12.5 6.5H5.5v12h12v-6"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5V9H15"/>',
  folder: '<path d="M4 7.5h6l1.6 2H20v9.5H4z"/>',
  inbox: '<path d="M4 12.5 6.5 5h11L20 12.5V19H4z"/><path d="M4 12.5h4.5l1 2h5l1-2H20"/>',
  spark: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  bolt: '<path d="M13 3.5 6 13.5h5l-1 7 7-10h-5z"/>',
  filter: '<path d="M4.5 6.5h15l-5.8 7v5.2l-3.4-1.8v-3.4z"/>'
};

export function icon(name, size = 16, extraClass = '') {
  const paths = P[name] || '';
  return `<svg class="ico ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
