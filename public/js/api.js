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
    throw err;
  }
  return body;
}

export const api = {
  health: () => request('/api/health'),
  getData: () => request('/api/data'),
  saveData: (data) =>
    request('/api/data', { method: 'PUT', body: JSON.stringify(data) }),
  status: () => request('/api/data/status')
};
