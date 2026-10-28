import { apiResponse, hasBearerToken, readJson } from '../utils.js';
import { getLatestData, ingestRecords, rebuildSnapshotAndPurgeCache } from '../storage/banLogsRepository.js';
import { writeRefreshStatus } from '../storage/refreshStatusStore.js';
import { runDailyRefresh } from '../crawl/dailyUpdate.js';
import { acquireOperationLock, operationLabel, releaseOperationLock } from '../storage/operationLock.js';

const SEARCH_HEADERS = ['닉네임', '식별코드', '게시글 / 댓글', '사유', '기간', '처리날짜', '처리자'];

async function updateLocalIngestStatus(env, result, { startedAt, startedMs, galleryId, collected, runId }) {
  try {
    const now = new Date().toISOString();
    const inserted = Number(result.database?.inserted ?? result.inserted) || 0;
    const snapshot = result.snapshot || { status: 'skipped' };
    const snapshotOk = snapshot.status === 'updated' && snapshot.cachePurged === true;
    const success = result.status === 'success' && snapshotOk;
    const message = success
      ? `앱 로컬 갱신 완료: ${inserted}건 저장, 스냅샷 ${snapshot.rows}건`
      : snapshot.message || (snapshot.status === 'updated'
        ? 'KV 스냅샷은 갱신했지만 캐시 초기화에 실패했습니다.'
        : '앱 로컬 갱신 중 KV 스냅샷을 갱신하지 못했습니다.');
    const status = {
      state: success ? 'success' : 'failed',
      trigger: 'local',
      runId,
      startedAt,
      finishedAt: now,
      durationMs: Date.now() - startedMs,
      stage: success ? 'complete' : 'snapshot',
      collected,
      database: {
        status: result.status !== 'success' ? 'failed' : inserted > 0 ? 'updated' : 'skipped',
        inserted: result.status === 'success' ? inserted : null,
      },
      snapshot,
      message,
      logs: success ? [] : [{ at: now, level: 'error', stage: 'snapshot', message }],
      galleries: [{ galleryId, collected }],
    };
    await writeRefreshStatus(env, status);
    return { updated: true, state: status.state, message: status.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { updated: false, message: `갱신 상태 기록 실패: ${message}` };
  }
}

async function searchIdentifier(body, env) {
  const galleryId = String(body.galleryId || '').trim();
  const identifier = String(body.identifier || '').trim();
  if (!galleryId || !identifier) throw new Error('There is an empty data');
  const { results } = await env.DB.prepare(
    'SELECT nickname,identifier,content,reason,duration,date_time,manager FROM ban_logs ' +
    'WHERE gallery_id=?1 AND identifier IN (?2,?3,?4) ORDER BY id DESC LIMIT 500',
  ).bind(galleryId, identifier, identifier + ' + IP', identifier + '+ IP').all();
  return {
    status: 'success', headers: SEARCH_HEADERS,
    rows: results.map(row => ({
      '닉네임': row.nickname, '식별코드': row.identifier, '게시글 / 댓글': row.content,
      '사유': row.reason, '기간': row.duration, '처리날짜': row.date_time, '처리자': row.manager,
    })),
  };
}

export async function handleAppApi(request, env) {
  let body;
  try { body = await readJson(request); }
  catch (error) { return apiResponse({ status: 'error', message: error.message }); }
  const action = body.action;
  const expectedToken = action === 'ingest' ? env.INGEST_TOKEN : env.VIEW_TOKEN;
  if (!hasBearerToken(request, expectedToken)) return apiResponse({ status: 'error', message: 'unauthorized' });

  if (action === 'ingest') return handleIngest(body, request, env);
  try {
    if (action === 'getLatestData') {
      const gid = String(body.galleryId || '').trim();
      if (!gid) throw new Error('There is an empty data');
      return apiResponse({ status: 'success', latestData: await getLatestData(gid, env) });
    }
    if (action === 'searchIdentifier') return apiResponse(await searchIdentifier(body, env));
    return apiResponse({ status: 'error', message: 'Invalid action' });
  } catch (error) {
    return apiResponse({ status: 'error', message: error.message });
  }
}

async function handleIngest(body, request, env) {
  const galleryId = String(body.galleryId || '').trim();
  if (!galleryId || !Array.isArray(body.banList)) return apiResponse({ status: 'error', message: 'There is an empty data' });

  const runId = crypto.randomUUID();
  const lock = await acquireOperationLock(env, 'local', runId);
  if (!lock.acquired) {
    const trigger = operationLabel(lock.active?.trigger);
    return apiResponse({
      status: 'error', message: `${trigger}이 진행 중이어서 로컬 ingest를 시작하지 않았습니다.`,
      activeRunId: lock.active?.runId || null,
    }, 409);
  }

  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  try {
    if (body.updateRefreshStatus === true) {
      await writeRefreshStatus(env, {
        state: 'running', trigger: 'local', runId, startedAt, stage: 'database',
        collected: body.banList.length,
        database: { status: 'running', inserted: 0 }, snapshot: { status: 'pending' },
        logs: [], message: `앱 로컬 ingest를 시작했습니다. ${body.banList.length}건을 처리합니다.`,
        galleries: [{ galleryId, collected: body.banList.length }],
      });
    }

    const refresh = (request.headers.get('X-Refresh-Snapshot') || '').trim().toLowerCase() === 'true';
    const result = await ingestRecords(galleryId, body.banList, env, refresh, 'local-ingest');
    if (body.updateRefreshStatus === true) {
      result.refreshStatus = await updateLocalIngestStatus(env, result, {
        startedAt, startedMs, galleryId, collected: body.banList.length, runId,
      });
    }
    return apiResponse(result);
  } catch (error) {
    const response = { status: 'error', message: error.message };
    if (body.updateRefreshStatus === true) {
      response.refreshStatus = await updateLocalIngestStatus(env, {
        status: 'error', database: { inserted: null },
        snapshot: { status: 'failed', message: error.message },
      }, { startedAt, startedMs, galleryId, collected: body.banList.length, runId });
    }
    return apiResponse(response);
  } finally {
    await releaseOperationLock(env, runId);
  }
}

export async function handleRefresh(request, env, ctx) {
  if (!hasBearerToken(request, env.INGEST_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
  const runId = crypto.randomUUID();
  const lock = await acquireOperationLock(env, 'snapshot', runId);
  if (!lock.acquired) return apiResponse({ status: 'error', message: '다른 갱신 작업이 진행 중입니다.' }, 409);
  ctx.waitUntil((async () => {
    try { await rebuildSnapshotAndPurgeCache(env, { source: 'snapshot-refresh' }); }
    finally { await releaseOperationLock(env, runId); }
  })());
  return apiResponse({ status: 'started' });
}

export async function handleManualRefresh(request, env, ctx) {
  if (!hasBearerToken(request, env.ADMIN_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
  const runId = crypto.randomUUID();
  const lock = await acquireOperationLock(env, 'manual', runId);
  if (!lock.acquired) {
    const label = operationLabel(lock.active?.trigger);
    return apiResponse({ status: 'running', message: `${label}이 진행 중입니다.` }, 409);
  }
  try {
    await writeRefreshStatus(env, {
      state: 'queued', trigger: 'manual', runId, startedAt: new Date().toISOString(),
      stage: 'queued', logs: [], message: '수동 갱신 요청을 접수했습니다. 작업을 시작합니다.',
    });
  } catch (error) {
    await releaseOperationLock(env, runId);
    return apiResponse({ status: 'error', message: error.message }, 500);
  }
  ctx.waitUntil(runDailyRefresh(env, { trigger: 'manual', runId, lock }));
  return apiResponse({ status: 'started', runId }, 202);
}
