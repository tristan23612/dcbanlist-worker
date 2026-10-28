import { apiResponse, hasBearerToken, readJson } from '../utils.js';
import { purgeSnapshotCache, rebuildSnapshotAndPurgeCache } from '../storage/banLogsRepository.js';
import { acquireOperationLock, releaseOperationLock } from '../storage/operationLock.js';

export async function handleAdmin(request, env, path) {
  if (path === '/admin/purge-cache') {
    if (!hasBearerToken(request, env.ADMIN_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
    try {
      await purgeSnapshotCache('admin-purge-button');
      return apiResponse({ status: 'success', cachePurged: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return apiResponse({ status: 'error', cachePurged: false, message }, 502);
    }
  }

  if (path === '/admin/verify') {
    if (!hasBearerToken(request, env.ADMIN_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
    const snapshot = await env.KV.get('snapshot');
    if (snapshot) {
      let needsRebuild = false;
      try { needsRebuild = !Array.isArray(JSON.parse(snapshot).ids); }
      catch { needsRebuild = true; }
      if (needsRebuild) {
        const runId = crypto.randomUUID();
        const lock = await acquireOperationLock(env, 'admin-verify', runId);
        if (!lock.acquired) return apiResponse({ status: 'error', message: '다른 갱신 작업이 진행 중입니다.' }, 409);
        try { await rebuildSnapshotAndPurgeCache(env, { source: 'admin-verify' }); }
        finally { await releaseOperationLock(env, runId); }
      }
    }
    return apiResponse({ status: 'success' });
  }

  if (path === '/admin/delete') {
    if (!hasBearerToken(request, env.ADMIN_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
    let body;
    try { body = await readJson(request); }
    catch (error) { return apiResponse({ status: 'error', message: error.message }); }
    const rawIds = Array.isArray(body.ids) ? body.ids : (body.id == null ? [] : [body.id]);
    const ids = [...new Set(rawIds.map(Number))];
    if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
      return apiResponse({ status: 'error', message: 'Invalid record ids' });
    }
    const runId = crypto.randomUUID();
    const lock = await acquireOperationLock(env, 'delete', runId);
    if (!lock.acquired) return apiResponse({ status: 'error', message: '다른 갱신 작업이 진행 중이어서 삭제를 시작하지 않았습니다.' }, 409);
    try {
      const result = await env.DB.prepare(
        'DELETE FROM ban_logs WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?1))',
      ).bind(JSON.stringify(ids)).run();
      const deleted = result.meta?.changes || 0;
      try { await rebuildSnapshotAndPurgeCache(env, { source: 'admin-delete' }); }
      catch (error) {
        return apiResponse({
          status: 'error', deleted,
          message: error.snapshotUpdated
            ? error.message
            : 'DB 변경은 완료했지만 KV 스냅샷 갱신에 실패했습니다.',
        });
      }
      return apiResponse({ status: 'success', deleted, requested: ids.length });
    } catch (error) {
      return apiResponse({ status: 'error', message: error.message });
    } finally {
      await releaseOperationLock(env, runId);
    }
  }
  return null;
}
