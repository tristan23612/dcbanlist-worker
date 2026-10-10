import { STATUS_KEY } from '../constants.js';

export async function readRefreshStatus(env) {
  const raw = await env.KV.get(STATUS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function writeRefreshStatus(env, status) {
  await env.KV.put(STATUS_KEY, JSON.stringify({ ...status, updatedAt: new Date().toISOString() }));
}

export async function markStaleRunInterrupted(env, staleAfterMs = 6 * 60 * 60 * 1000) {
  const status = await readRefreshStatus(env);
  if (!status || !['queued', 'running'].includes(status.state)) return status;
  const started = Date.parse(status.startedAt || status.updatedAt || '');
  if (!Number.isFinite(started) || Date.now() - started < staleAfterMs) return status;
  const interrupted = {
    ...status,
    state: 'interrupted',
    message: 'Worker 작업이 예상보다 오래 끝나지 않아 중단된 것으로 표시했습니다. 다시 갱신을 요청할 수 있습니다.',
  };
  await writeRefreshStatus(env, interrupted);
  return interrupted;
}
