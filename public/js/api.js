/* 与服务端通信，只有 4 个接口 */

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error((body && body.error) || `请求失败（${res.status}）`);
    err.status = res.status;
    err.corrupted = Boolean(body && body.corrupted);
    err.conflict = Boolean(body && body.conflict);
    err.rev = body && typeof body.rev === 'number' ? body.rev : undefined;
    throw err;
  }
  return body;
}

export const api = {
  health: () => request('/api/health'),
  getData: () => request('/api/data'),
  /**
   * opts.keepalive：页面即将关闭时用，让请求在页面销毁后仍能发出去。
   *   浏览器对 keepalive 请求体有 64KB 上限，超了就直接退回普通请求。
   * opts.force：跳过版本检查强制覆盖（只给「导入备份」这类明确意图用）。
   */
  saveData: (data, opts = {}) => {
    const body = JSON.stringify(data);
    const useKeepalive = Boolean(opts.keepalive) && body.length < 60000;
    return request('/api/data', {
      method: 'PUT',
      body,
      headers: {
        'content-type': 'application/json',
        ...(opts.force ? { 'x-force': '1' } : {})
      },
      ...(useKeepalive ? { keepalive: true } : {})
    });
  },
  status: () => request('/api/data/status')
};
