const LOCK_ID = 1;
const LOCK_LEASE_MS = 30 * 60 * 1000;
const OPERATION_LABELS = {
  cron: '자동 갱신',
  manual: '수동 갱신',
  local: '앱 로컬 ingest',
  snapshot: '스냅샷 갱신',
  delete: '관리자 삭제',
  'admin-verify': '관리자 데이터 확인',
};

export function operationLabel(trigger) {
  return OPERATION_LABELS[trigger] || '다른 작업';
}

export async function acquireOperationLock(env, trigger, runId = crypto.randomUUID()) {
  const now = Date.now();
  const result = await env.DB.prepare(
    'INSERT INTO worker_operation_lock(id,run_id,trigger,expires_at) VALUES(?1,?2,?3,?4) ' +
    'ON CONFLICT(id) DO UPDATE SET run_id=excluded.run_id,trigger=excluded.trigger,expires_at=excluded.expires_at ' +
    'WHERE worker_operation_lock.expires_at<=?5',
  ).bind(LOCK_ID, runId, trigger, now + LOCK_LEASE_MS, now).run();
  if ((result.meta?.changes || 0) > 0) return { acquired: true, runId };

  const active = await env.DB.prepare(
    'SELECT run_id AS runId,trigger,expires_at AS expiresAt FROM worker_operation_lock WHERE id=?1',
  ).bind(LOCK_ID).first();
  return { acquired: false, active };
}

export async function releaseOperationLock(env, runId) {
  await env.DB.prepare('DELETE FROM worker_operation_lock WHERE id=?1 AND run_id=?2')
    .bind(LOCK_ID, runId).run();
}
