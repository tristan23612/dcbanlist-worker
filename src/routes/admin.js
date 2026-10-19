import { apiResponse, hasBearerToken, readJson } from '../utils.js';
import { purgeSnapshotCache, rebuildSnapshotAndPurgeCache } from '../storage/banLogsRepository.js';

export async function handleAdmin(request, env, path, ctx) {
  if (path === '/admin/purge-cache') {
    if (!hasBearerToken(request, env.ADMIN_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
    try {
      await purgeSnapshotCache(ctx);
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
      if (needsRebuild) await rebuildSnapshotAndPurgeCache(env, ctx);
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
    try {
      const result = await env.DB.prepare(
        'DELETE FROM ban_logs WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?1))',
      ).bind(JSON.stringify(ids)).run();
      const deleted = result.meta?.changes || 0;
      try { await rebuildSnapshotAndPurgeCache(env, ctx); }
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
    }
  }
  return null;
}
