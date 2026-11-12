/* 浮层类组件：轻提示、二次确认、右侧抽屉、空状态。 */
import { icon } from './icons.js';
import { escapeHtml } from '../utils.js';

export function toast(message, type = '') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' err' : '');
  el.innerHTML = `${type === 'error' ? icon('alert', 13) : icon('check', 13)}<span>${escapeHtml(
    message
  )}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, 2000);
}

/**
 * 二次确认。返回 Promise<boolean>
 * requireText: 必须输入指定文字才能确认（用于清空模块这类破坏性操作）
 */
export function confirmDialog({
  title = '确认操作',
  message = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  requireText = null
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('overlay-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    backdrop.style.zIndex = '69';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.innerHTML = `
      <div class="modal-title">${escapeHtml(title)}</div>
      <div class="modal-body">${message}</div>
      ${
        requireText
          ? `<input class="input" style="margin-top:12px" placeholder="输入「${escapeHtml(
              requireText
            )}」以确认" />`
          : ''
      }
      <div class="modal-foot">
        <button class="btn" data-cancel>${escapeHtml(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok ${
      requireText ? 'disabled' : ''
    }>${escapeHtml(confirmText)}</button>
      </div>`;

    overlay.appendChild(backdrop);
    overlay.appendChild(modal);

    const okBtn = modal.querySelector('[data-ok]');
    const input = modal.querySelector('input');

    if (input) {
      input.addEventListener('input', () => {
        okBtn.disabled = input.value.trim() !== requireText;
      });
      setTimeout(() => input.focus(), 30);
    } else {
      setTimeout(() => okBtn.focus(), 30);
    }

    function done(value) {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      modal.remove();
      resolve(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(false);
      }
      if (e.key === 'Enter' && !okBtn.disabled) {
        e.stopPropagation();
        done(true);
      }
    }

    backdrop.addEventListener('click', () => done(false));
    modal.querySelector('[data-cancel]').addEventListener('click', () => done(false));
    okBtn.addEventListener('click', () => done(true));
    document.addEventListener('keydown', onKey, true);
  });
}

/**
 * 右侧抽屉。返回 { close, el }
 * footer: [{ label, primary, danger, onClick(close) => boolean|void }]
 */
export function openDrawer({ title, subtitle = '', content = '', onMount, footer = [] }) {
  const overlay = document.getElementById('overlay-root');

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', title);
  drawer.innerHTML = `
    <div class="drawer-head">
      <div class="grow">
        <div class="drawer-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="drawer-sub">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <button class="icon-btn" data-close aria-label="关闭">${icon('x', 16)}</button>
    </div>
    <div class="drawer-body">${content}</div>
    ${footer.length ? '<div class="drawer-foot"></div>' : ''}`;

  overlay.appendChild(backdrop);
  overlay.appendChild(drawer);

  const bodyEl = drawer.querySelector('.drawer-body');
  const footEl = drawer.querySelector('.drawer-foot');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    drawer.remove();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  drawer.querySelector('[data-close]').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  (footer || []).forEach((btn) => {
    const el = document.createElement('button');
    el.className = 'btn' + (btn.primary ? ' btn-primary' : '') + (btn.danger ? ' btn-danger' : '');
    el.textContent = btn.label;
    if (btn.align === 'left') el.style.marginRight = 'auto';
    el.addEventListener('click', async () => {
      const res = btn.onClick ? await btn.onClick(close) : true;
      if (res !== false) close();
    });
    footEl.appendChild(el);
  });

  if (onMount) onMount(bodyEl, { close, drawer });

  return { close, el: drawer, body: bodyEl };
}

export function emptyHTML({ iconName = 'inbox', title, desc = '', actionLabel = '', action = '' }) {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName, 20)}</div>
    <div class="empty-title">${escapeHtml(title)}</div>
    ${desc ? `<div class="empty-desc">${escapeHtml(desc)}</div>` : ''}
    ${
      actionLabel
        ? `<button class="btn btn-sm" data-act="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>`
        : ''
    }
  </div>`;
}

export function field(label, inputHTML, hint = '') {
  return `<label class="field"><span class="label">${escapeHtml(label)}</span>${inputHTML}${
    hint ? `<span class="tiny hint">${escapeHtml(hint)}</span>` : ''
  }</label>`;
}
