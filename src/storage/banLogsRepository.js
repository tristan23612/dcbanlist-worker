import { cache } from 'cloudflare:workers';
import { COLS, SNAPSHOT_KEY } from '../constants.js';

const INSERT_SQL =
  'INSERT INTO ban_logs(gallery_id,nickname,identifier,content,reason,duration,date_time,manager) ' +
  "SELECT ?1, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), " +
  "json_extract(value,'$[3]'), json_extract(value,'$[4]'), json_extract(value,'$[5]'), " +
  "json_extract(value,'$[6]') FROM json_each(?2) ORDER BY key";

export async function getLatestData(galleryId, env) {
  const row = await env.DB.prepare(
    'SELECT nickname,identifier,content,reason,duration,date_time,manager ' +
    'FROM ban_logs WHERE gallery_id=?1 ORDER BY id DESC LIMIT 1',
  ).bind(galleryId).first();
  return row ? {
    nickname: row.nickname, identifier: row.identifier, content: row.content,
    reason: row.reason, duration: row.duration, dateTime: row.date_time, manager: row.manager,
  } : null;
}

export async function ingestRecords(galleryId, records, env, refreshSnapshot = false, source = 'local-ingest') {
  return ingestGalleryRecords([{ galleryId, records }], env, refreshSnapshot, source);
}

export async function ingestGalleryRecords(galleries, env, refreshSnapshot = false, source = 'local-ingest') {
  const statements = [];
  for (const { galleryId, records } of galleries) {
    const items = records.map(record => [
      record.nickname, record.identifier, record.content, record.reason,
      record.duration, record.dateTime, record.manager,
    ].map(value => value == null ? '' : String(value)));
    // Reverse once so newest records keep the greatest row IDs, matching the current app API.
    const reversed = items.reverse();
    for (let i = 0; i < reversed.length; i += 200) {
      statements.push(env.DB.prepare(INSERT_SQL).bind(galleryId, JSON.stringify(reversed.slice(i, i + 200))));
    }
  }
  let inserted = 0;
  if (statements.length) {
    const result = await env.DB.batch(statements);
    inserted = result.reduce((sum, item) => sum + (item.meta.changes || 0), 0);
  }
  const response = {
    status: 'success', inserted,
    database: { status: 'success', inserted },
    snapshot: { status: 'skipped' },
  };
  if (refreshSnapshot) {
    try {
      const rows = await rebuildSnapshotAndPurgeCache(env, { source });
      response.snapshot = { status: 'updated', rows, cachePurged: true };
    } catch (error) {
      response.snapshot = {
        status: error.snapshotUpdated ? 'updated' : 'failed',
        ...(error.snapshotUpdated ? { rows: error.snapshotRows, cachePurged: false } : {}),
        message: error.message,
      };
    }
  }
  return response;
}

export async function rebuildSnapshot(env) {
  const { results } = await env.DB.prepare(
    'SELECT id,gallery_id,nickname,identifier,content,reason,duration,date_time,manager ' +
    'FROM ban_logs ORDER BY id DESC',
  ).all();
  if (!results.length) {
    await env.KV.delete(SNAPSHOT_KEY);
    return { rows: 0, updatedAt: null };
  }
  const rows = results.map(row => [
    row.gallery_id, row.nickname, row.identifier, row.content,
    row.reason, row.duration, row.date_time, row.manager,
  ]);
  const ids = results.map(row => row.id);
  const updatedAt = new Date().toISOString();
  await env.KV.put(SNAPSHOT_KEY, JSON.stringify({ updatedAt, columns: COLS, rows, ids }));
  return { rows: rows.length, updatedAt };
}

export async function rebuildSnapshotAndPurgeCache(env, { source = 'unknown' } = {}) {
  const snapshot = await rebuildSnapshot(env);
  try {
    await purgeSnapshotCache(source, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cacheError = new Error(`KV 스냅샷은 갱신됐지만 캐시 purge/반영 확인에 실패했습니다: ${message}`);
    cacheError.snapshotUpdated = true;
    cacheError.snapshotRows = snapshot.rows;
    throw cacheError;
  }
  return snapshot.rows;
}

function logCacheEvent(level, event, details = {}) {
  const entry = {
    service: 'dcbanlist', component: 'snapshot-cache', at: new Date().toISOString(),
    level, event, ...details,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

async function purgeFromAdminEndpoint(env) {
  const configuredUrl = String(env.SELF_WORKER_URL || '').trim();
  if (!configuredUrl) throw new Error('SELF_WORKER_URL runtime variable이 설정되지 않았습니다.');
  if (!env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN secret이 설정되지 않았습니다.');

  let baseUrl;
  try { baseUrl = new URL(configuredUrl); }
  catch { throw new Error('SELF_WORKER_URL이 올바른 URL이 아닙니다.'); }
  if (baseUrl.protocol !== 'https:' || !baseUrl.hostname.endsWith('.workers.dev') ||
      baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || !['', '/'].includes(baseUrl.pathname)) {
    throw new Error('SELF_WORKER_URL에는 https://<worker>.<account>.workers.dev 주소를 설정하세요.');
  }

  const purgeUrl = new URL('/admin/purge-cache', baseUrl);
  const response = await fetch(purgeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ADMIN_TOKEN}`,
      Accept: 'application/json',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  let result;
  try { result = await response.json(); }
  catch {
    if (!response.ok) throw new Error(`내부 관리자 purge 요청 실패 (HTTP ${response.status})`);
    throw new Error('내부 관리자 purge 응답이 올바른 JSON이 아닙니다.');
  }
  if (!response.ok || result?.status !== 'success' || result?.cachePurged !== true) {
    throw new Error(result?.message || `내부 관리자 purge 요청 실패 (HTTP ${response.status})`);
  }
  return result;
}

export async function purgeSnapshotCache(source = 'unknown', env = null) {
  const eventDetails = { source, purgeEverything: true };
  logCacheEvent('info', 'purge_started', {
    ...eventDetails,
    api: source === 'cron' ? 'self-http-admin-endpoint' : 'cloudflare:workers.cache',
  });
  try {
    if (source === 'cron') {
      if (!env) throw new Error('Cron purge를 위해 Worker 환경 설정이 필요합니다.');
      const result = await purgeFromAdminEndpoint(env);
      logCacheEvent('info', 'purge_accepted', { ...eventDetails, via: 'self-http-admin-endpoint', success: true });
      return result;
    }

    const result = await cache.purge({ purgeEverything: true });
    if (!result?.success) {
      const details = Array.isArray(result?.errors)
        ? result.errors.map(error => error.message || `code ${error.code}`).join('; ')
        : '';
      throw new Error(details || 'Cloudflare가 캐시 purge 요청을 승인하지 않았습니다.');
    }
    logCacheEvent('info', 'purge_accepted', { ...eventDetails, success: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logCacheEvent('error', 'purge_failed', { ...eventDetails, message });
    throw error;
  }
}