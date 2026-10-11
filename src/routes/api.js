import { apiResponse, hasBearerToken, readJson } from '../utils.js';
import { getLatestData, ingestRecords, rebuildSnapshotAndPurgeCache } from '../storage/banLogsRepository.js';
import { markStaleRunInterrupted, writeRefreshStatus } from '../storage/refreshStatusStore.js';
import { runDailyRefresh } from '../crawl/dailyUpdate.js';

const SEARCH_HEADERS = ['닉네임', '식별코드', '게시글 / 댓글', '사유', '기간', '처리날짜', '처리자'];

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

export async function handleAppApi(request, env, ctx) {
  let body;
  try { body = await readJson(request); }
  catch (error) { return apiResponse({ status: 'error', message: error.message }); }
  const action = body.action;
  const expectedToken = action === 'ingest' ? env.INGEST_TOKEN : env.VIEW_TOKEN;
  if (!hasBearerToken(request, expectedToken)) return apiResponse({ status: 'error', message: 'unauthorized' });

  try {
    if (action === 'ingest') {
      const gid = String(body.galleryId || '').trim();
      if (!gid || !Array.isArray(body.banList)) throw new Error('There is an empty data');
      const refresh = (request.headers.get('X-Refresh-Snapshot') || '').trim().toLowerCase() === 'true';
      return apiResponse(await ingestRecords(gid, body.banList, env, refresh, ctx));
    }
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

export async function handleRefresh(request, env, ctx) {
  if (!hasBearerToken(request, env.INGEST_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
  ctx.waitUntil(rebuildSnapshotAndPurgeCache(env, ctx));
  return apiResponse({ status: 'started' });
}

export async function handleManualRefresh(request, env, ctx) {
  if (!hasBearerToken(request, env.ADMIN_TOKEN)) return apiResponse({ status: 'error', message: 'unauthorized' });
  const current = await markStaleRunInterrupted(env);
  if (current && ['queued', 'running'].includes(current.state)) {
    const label = current.trigger === 'manual' ? '수동 갱신' : '자동 갱신';
    return apiResponse({ status: 'running', message: `${label}이 이미 진행 중입니다.` }, 409);
  }
  const runId = crypto.randomUUID();
  await writeRefreshStatus(env, {
    state: 'queued', trigger: 'manual', runId, startedAt: new Date().toISOString(),
    stage: 'queued', logs: [], message: '수동 갱신 요청을 접수했습니다. 작업을 시작합니다.',
  });
  ctx.waitUntil(runDailyRefresh(env, { trigger: 'manual', runId, ctx }));
  return apiResponse({ status: 'started', runId }, 202);
}
