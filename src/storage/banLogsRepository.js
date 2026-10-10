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

export async function ingestRecords(galleryId, records, env, refreshSnapshot = false) {
  return ingestGalleryRecords([{ galleryId, records }], env, refreshSnapshot);
}

export async function ingestGalleryRecords(galleries, env, refreshSnapshot = false) {
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
      const rows = await rebuildSnapshot(env);
      response.snapshot = { status: 'updated', rows };
    } catch (error) {
      response.snapshot = { status: 'failed', message: error.message };
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
    return 0;
  }
  const rows = results.map(row => [
    row.gallery_id, row.nickname, row.identifier, row.content,
    row.reason, row.duration, row.date_time, row.manager,
  ]);
  const ids = results.map(row => row.id);
  await env.KV.put(SNAPSHOT_KEY, JSON.stringify({
    updatedAt: new Date().toISOString(), columns: COLS, rows, ids,
  }));
  return rows.length;
}
