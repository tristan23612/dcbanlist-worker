import { CORS, SEC } from './constants.js';
import { apiResponse } from './utils.js';
import { handlePublicGet } from './routes/public.js';
import { handleAdmin } from './routes/admin.js';
import { handleAppApi, handleManualCrawl, handleRefresh } from './routes/api.js';
import { runDailyRefresh } from './crawl/dailyUpdate.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (request.method === 'GET') {
      const response = await handlePublicGet(request, env);
      if (response) return response;
    }

    if (request.method === 'POST') {
      if (path === '/admin/verify' || path === '/admin/delete') {
        const response = await handleAdmin(request, env, path);
        if (response) return response;
      }
      if (path === '/refresh') return handleRefresh(request, env, ctx);
      if (path === '/admin/refresh') return handleManualCrawl(request, env, ctx);
      if (path === '/') return handleAppApi(request, env);
    }

    return new Response('not found', { status: 404, headers: SEC });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyRefresh(env, { trigger: 'cron' }));
  },
};
