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
  if (!status || status.state !== 'running') return status;
  const started = Date.parse(status.startedAt || status.updatedAt || '');
  if (!Number.isFinite(started) || Date.now() - started < staleAfterMs) return status;
  const interrupted = {
    ...status,
    state: 'interrupted',
    message: 'Worker 실행이 예상보다 오래 걸려 중단된 것으로 표시했습니다. 다음 예약 실행에서 다시 시도합니다.',
  };
  await writeRefreshStatus(env, interrupted);
  return interrupted;
}
