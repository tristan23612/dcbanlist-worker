import { createBlockListClient } from '../dcinside/blockListClient.js';
import { parseBlockListPage, isSameEntry } from '../dcinside/blockListParser.js';
import { getLatestData, ingestGalleryRecords, rebuildSnapshot } from '../storage/banLogsRepository.js';
import { markStaleRunInterrupted, writeRefreshStatus } from '../storage/refreshStatusStore.js';
import { safeError } from '../utils.js';

function configuredGalleries(env) {
  let galleries;
  try { galleries = JSON.parse(env.GALLERIES_JSON || '[]'); }
  catch { throw new Error('GALLERIES_JSON이 올바른 JSON이 아닙니다.'); }
  if (!Array.isArray(galleries) || galleries.length === 0) throw new Error('GALLERIES_JSON에 수집할 갤러리를 설정하세요.');
  const maxGalleries = Math.max(1, Math.min(50, Number(env.MAX_CRAWL_GALLERIES) || 10));
  if (galleries.length > maxGalleries) throw new Error(`갤러리 수가 상한(${maxGalleries})을 초과했습니다.`);
  return galleries.map(item => {
    const id = String(item?.id || '').trim();
    const path = String(item?.path || 'mgallery').replace(/^\/+|\/+$/g, '');
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || !['mgallery', 'gallery', 'mini'].includes(path)) {
      throw new Error('GALLERIES_JSON의 id 또는 path 값이 올바르지 않습니다.');
    }
    return { id, path };
  });
}

function maxPages(env) {
  const value = Number(env.MAX_CRAWL_PAGES) || 20;
  return Math.max(1, Math.min(100, Math.floor(value)));
}

export async function runDailyRefresh(env, { trigger = 'cron' } = {}) {
  const previous = await markStaleRunInterrupted(env);
  if (previous?.state === 'running') return previous;
  const startedAt = new Date().toISOString();
  const base = { state: 'running', trigger, startedAt, galleries: [], message: '자동 갱신을 시작했습니다.' };
  await writeRefreshStatus(env, base);
  try {
    const galleries = configuredGalleries(env);
    const pageLimit = maxPages(env);
    const client = await createBlockListClient(env);
    const batches = [];

    for (const gallery of galleries) {
      const latest = await getLatestData(gallery.id, env);
      const collected = [];
      let foundLatest = latest == null;
      const pagesToRead = latest == null ? 1 : pageLimit;
      let lastPage = 0;

      for (let page = 1; page <= pagesToRead; page++) {
        await writeRefreshStatus(env, {
          ...base, galleryId: gallery.id, page,
          galleries: [...batches.map(batch => ({ galleryId: batch.galleryId, collected: batch.records.length })), { galleryId: gallery.id, collected: collected.length }],
          message: `${gallery.id} ${page}페이지를 확인하고 있습니다.`,
        });
        const html = await client.fetchPage(gallery, page);
        const records = parseBlockListPage(html);
        lastPage = page;
        let matched = false;
        for (const record of records) {
          if (latest && isSameEntry(record, latest)) { matched = true; break; }
          collected.push(record);
        }
        if (matched) { foundLatest = true; break; }
        if (latest == null || records.length === 0) break;
      }

      if (!foundLatest) {
        throw new Error(`${gallery.id}: ${pageLimit}페이지 안에서 기존 최신 기록을 찾지 못해 이번 갱신을 중지했습니다. 부분 수집 데이터는 저장하지 않았습니다.`);
      }
      batches.push({ galleryId: gallery.id, records: collected });
      await writeRefreshStatus(env, {
        ...base,
        galleries: batches.map(batch => ({ galleryId: batch.galleryId, collected: batch.records.length })),
        galleryId: gallery.id, page: lastPage,
        message: `${gallery.id} 수집 완료 (${collected.length}건)`,
      });
    }

    const total = batches.reduce((sum, batch) => sum + batch.records.length, 0);
    let dbStatus = { status: 'success', inserted: 0 };
    if (total) dbStatus = (await ingestGalleryRecords(batches, env)).database;
    let snapshotStatus;
    try {
      snapshotStatus = { status: 'updated', rows: await rebuildSnapshot(env) };
    } catch (error) {
      const failed = {
        ...base, state: 'failed', finishedAt: new Date().toISOString(),
        database: { ...dbStatus, status: 'updated', inserted: dbStatus.inserted },
        snapshot: { status: 'failed' },
        galleries: batches.map(batch => ({ galleryId: batch.galleryId, collected: batch.records.length })),
        message: `DB 저장은 완료했지만 KV 스냅샷 갱신에 실패했습니다: ${safeError(error)}`,
      };
      await writeRefreshStatus(env, failed);
      return failed;
    }
    const completed = {
      ...base, state: 'success', finishedAt: new Date().toISOString(),
      database: { ...dbStatus, status: 'updated' }, snapshot: snapshotStatus,
      galleries: batches.map(batch => ({ galleryId: batch.galleryId, collected: batch.records.length })),
      message: `자동 갱신 완료: ${dbStatus.inserted}건 저장, 스냅샷 ${snapshotStatus.rows}건`,
    };
    await writeRefreshStatus(env, completed);
    return completed;
  } catch (error) {
    const failed = {
      ...base, state: 'failed', finishedAt: new Date().toISOString(),
      previousRunState: previous?.state || null,
      message: safeError(error),
    };
    await writeRefreshStatus(env, failed);
    return failed;
  }
}
