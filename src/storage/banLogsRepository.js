import { cache } from 'cloudflare:workers';
import { COLS, SNAPSHOT_CACHE_TAG, SNAPSHOT_KEY } from '../constants.js';

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
    await purgeSnapshotCache(source);
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

export async function purgeSnapshotCache(source = 'unknown') {
  const pathPrefixes = source === 'cron' ? ['/data.json'] : [];
  const purgeOptions = {
    tags: [SNAPSHOT_CACHE_TAG],
    ...(pathPrefixes.length ? { pathPrefixes } : {}),
  };
  const eventDetails = {
    source,
    tags: purgeOptions.tags,
    ...(pathPrefixes.length ? { pathPrefixes } : {}),
  };
  logCacheEvent('info', 'purge_started', { ...eventDetails, api: 'cloudflare:workers.cache' });
  try {
    const result = await cache.purge(purgeOptions);
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
