import { createBlockListClient } from '../dcinside/blockListClient.js';
import { parseBlockListPage, isSameEntry } from '../dcinside/blockListParser.js';
import { getLatestData, ingestGalleryRecords, rebuildSnapshotAndPurgeCache } from '../storage/banLogsRepository.js';
import { logRefreshEvent, markStaleRunInterrupted, writeRefreshStatus } from '../storage/refreshStatusStore.js';
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

export async function runDailyRefresh(env, { trigger = 'cron', runId = null, ctx } = {}) {
  const refreshLabel = trigger === 'manual' ? '수동 갱신' : '자동 갱신';
  const previous = await markStaleRunInterrupted(env);
  if (previous && ['queued', 'running'].includes(previous.state) && previous.runId !== runId) {
    logRefreshEvent({ runId, trigger }, 'warn', 'run_skipped', `이미 다른 갱신 작업이 진행 중이어서 ${refreshLabel} 요청을 건너뜁니다.`, {
      activeRunId: previous.runId || null,
    });
    return previous;
  }

  const startedMs = Date.now();
  const base = {
    state: 'running', trigger, runId,
    startedAt: new Date().toISOString(), stage: 'initializing',
    galleries: [], logs: [], message: `${refreshLabel}을 시작했습니다.`,
  };
  const batches = [];
  logRefreshEvent(base, 'info', 'run_started', base.message);

  try {
    await writeRefreshStatus(env, base);
    const galleries = configuredGalleries(env);
    const pageLimit = maxPages(env);
    base.galleryCount = galleries.length;
    base.maxPages = pageLimit;
    base.pageLimit = pageLimit;
    logRefreshEvent(base, 'info', 'configuration_loaded', '수집 설정을 확인했습니다.', {
      galleryCount: galleries.length, pageLimit,
    });

    const client = await createBlockListClient(env);
    logRefreshEvent(base, 'info', 'dcinside_session_ready', 'DCInside 로그인 세션을 준비했습니다.');

    for (const gallery of galleries) {
      base.stage = 'crawl';
      base.galleryId = gallery.id;
      base.page = 0;
      base.pageLimit = pageLimit;
      base.message = `${gallery.id} 갤러리의 최신 기록을 확인하고 있습니다.`;
      logRefreshEvent(base, 'info', 'gallery_started', `${gallery.id} 갤러리 수집을 시작합니다.`, { galleryId: gallery.id });

      const latest = await getLatestData(gallery.id, env);
      const collected = [];
      let foundLatest = latest == null;
      const pagesToRead = latest == null ? 1 : pageLimit;
      let lastPage = 0;
      let pagesRead = 0;
      base.pageLimit = pagesToRead;
      logRefreshEvent(base, 'info', 'latest_record_checked', latest
        ? `${gallery.id} 기존 최신 기록을 기준으로 새 기록을 확인합니다.`
        : `${gallery.id} DB에 기존 최신 기록이 없어 첫 페이지를 수집합니다.`, {
        galleryId: gallery.id, hasLatestRecord: latest != null,
      });

      for (let page = 1; page <= pagesToRead; page++) {
        base.page = page;
        base.galleries = [
          ...batches.map(batch => ({ galleryId: batch.galleryId, collected: batch.records.length, pagesRead: batch.pagesRead })),
          { galleryId: gallery.id, collected: collected.length, pagesRead },
        ];
        base.message = `${gallery.id} ${page}/${pagesToRead}페이지를 확인하고 있습니다.`;
        logRefreshEvent(base, 'info', 'page_fetch_started', `${gallery.id} ${page}페이지를 요청합니다.`, {
          galleryId: gallery.id, page, pageLimit: pagesToRead,
        });
        await writeRefreshStatus(env, base);

        const html = await client.fetchPage(gallery, page);
        const records = parseBlockListPage(html);
        lastPage = page;
        pagesRead++;
        let matched = false;
        for (const record of records) {
          if (latest && isSameEntry(record, latest)) { matched = true; break; }
          collected.push(record);
        }
        logRefreshEvent(base, 'info', matched ? 'latest_record_found' : 'page_fetch_completed', matched
          ? `${gallery.id} ${page}페이지에서 기존 최신 기록을 찾았습니다.`
          : `${gallery.id} ${page}페이지 파싱을 완료했습니다.`, {
          galleryId: gallery.id, page, parsedRecords: records.length,
          collectedRecords: collected.length, latestMatched: matched,
        });
        if (matched) { foundLatest = true; break; }
        if (latest == null || records.length === 0) break;
      }

      if (!foundLatest) {
        throw new Error(`${gallery.id}: ${pageLimit}페이지 안에서 기존 최신 기록을 찾지 못해 이번 갱신을 중지했습니다. 부분 수집 데이터는 저장하지 않았습니다.`);
      }
      batches.push({ galleryId: gallery.id, records: collected, pagesRead });
      base.galleries = batches.map(batch => ({
        galleryId: batch.galleryId, collected: batch.records.length, pagesRead: batch.pagesRead,
      }));
      base.message = `${gallery.id} 수집 완료 (${collected.length}건)`;
      logRefreshEvent(base, 'info', 'gallery_completed', base.message, {
        galleryId: gallery.id, pagesRead, collectedRecords: collected.length,
      });
      await writeRefreshStatus(env, base);
    }

    const total = batches.reduce((sum, batch) => sum + batch.records.length, 0);
    base.collected = total;
    if (total) {
      base.stage = 'database';
      base.database = { status: 'running', inserted: 0 };
      base.message = `새 기록 ${total}건을 DB에 저장하고 있습니다.`;
      logRefreshEvent(base, 'info', 'database_write_started', base.message, { records: total });
      await writeRefreshStatus(env, base);
      const dbStatus = (await ingestGalleryRecords(batches, env)).database;
      base.database = { status: 'updated', inserted: dbStatus.inserted };
      logRefreshEvent(base, 'info', 'database_write_completed', `DB 저장을 완료했습니다. ${dbStatus.inserted}건이 추가되었습니다.`, {
        records: total, inserted: dbStatus.inserted,
      });
    } else {
      base.database = { status: 'skipped', inserted: 0 };
      logRefreshEvent(base, 'info', 'database_write_skipped', '새 기록이 없어 DB 저장을 건너뜁니다.', { records: 0 });
    }

    base.stage = 'snapshot';
    base.snapshot = { status: 'running' };
    base.message = 'KV 스냅샷을 갱신하고 있습니다.';
    logRefreshEvent(base, 'info', 'snapshot_rebuild_started', base.message);
    await writeRefreshStatus(env, base);
    const snapshotRows = await rebuildSnapshotAndPurgeCache(env, ctx);
    base.snapshot = { status: 'updated', rows: snapshotRows, cachePurged: true };
    logRefreshEvent(base, 'info', 'snapshot_rebuild_completed', `KV 스냅샷 갱신을 완료했습니다. ${snapshotRows}건입니다.`, {
      rows: snapshotRows,
    });

    const completed = {
      ...base, state: 'success', stage: 'complete', finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      message: `${refreshLabel} 완료: ${base.database.inserted}건 저장, 스냅샷 ${snapshotRows}건`,
    };
    logRefreshEvent(completed, 'info', 'run_completed', completed.message, { durationMs: completed.durationMs });
    await writeRefreshStatus(env, completed);
    return completed;
  } catch (error) {
    const message = base.stage === 'snapshot'
      ? error.snapshotUpdated
        ? `KV 스냅샷은 갱신됐지만 캐시 비우기에 실패했습니다: ${safeError(error)}`
        : `DB 저장은 완료했지만 KV 스냅샷 갱신에 실패했습니다: ${safeError(error)}`
      : base.stage === 'database'
        ? `DB 저장에 실패했습니다: ${safeError(error)}`
        : safeError(error);
    const failed = {
      ...base, state: 'failed', finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs, message,
      logs: [{
        at: new Date().toISOString(), level: 'error', stage: base.stage,
        message: safeError(error),
      }],
    };
    if (base.stage === 'database') failed.database = { status: 'failed', inserted: null };
    if (base.stage === 'snapshot') {
      failed.snapshot = error.snapshotUpdated
        ? { status: 'updated', rows: error.snapshotRows, cachePurged: false }
        : { status: 'failed' };
    }
    logRefreshEvent(failed, 'error', 'run_failed', message, { durationMs: failed.durationMs, stage: base.stage });
    await writeRefreshStatus(env, failed);
    return failed;
  }
}
