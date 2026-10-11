import { STATUS_KEY } from '../constants.js';

export async function readRefreshStatus(env) {
  const raw = await env.KV.get(STATUS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function writeRefreshStatus(env, status) {
  const summary = { ...status };
  if (Array.isArray(summary.logs)) summary.logs = summary.logs.slice(-10);
  else delete summary.logs;
  await env.KV.put(STATUS_KEY, JSON.stringify({ ...summary, updatedAt: new Date().toISOString() }));
}

export function logRefreshEvent(status, level, event, message, details = {}) {
  const output = JSON.stringify({
    service: 'dcbanlist', component: 'daily-refresh',
    runId: status.runId || null, trigger: status.trigger || null,
    at: new Date().toISOString(), level, event, message, ...details,
  });
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export async function markStaleRunInterrupted(env, staleAfterMs = 6 * 60 * 60 * 1000) {
  const status = await readRefreshStatus(env);
  if (!status || !['queued', 'running'].includes(status.state)) return status;
  const started = Date.parse(status.startedAt || status.updatedAt || '');
  if (!Number.isFinite(started) || Date.now() - started < staleAfterMs) return status;
  const interrupted = {
    ...status,
    state: 'interrupted',
    finishedAt: new Date().toISOString(),
    message: 'Worker 작업이 예상보다 오래 끝나지 않아 중단된 것으로 표시했습니다. 다시 갱신을 요청할 수 있습니다.',
    logs: [...(Array.isArray(status.logs) ? status.logs : []), {
      at: new Date().toISOString(), level: 'error', stage: status.stage || 'unknown',
      message: 'Worker 작업이 예상보다 오래 끝나지 않아 중단된 것으로 표시했습니다.',
    }].slice(-10),
  };
  logRefreshEvent(interrupted, 'error', 'run_interrupted', interrupted.message);
  await writeRefreshStatus(env, interrupted);
  return interrupted;
}
