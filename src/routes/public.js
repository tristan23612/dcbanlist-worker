import { SEC, SNAPSHOT_KEY } from '../constants.js';
import { HTML } from '../web/page.js';
import { markStaleRunInterrupted } from '../storage/refreshStatusStore.js';

function pageWithStatus() {
  const statusMarkup = '<div class="s" id="crawl-status" style="display:none"></div>';
  const script = `
async function showCrawlStatus(){
  try{
    const response=await fetch('/refresh-status.json?token='+encodeURIComponent(viewToken));
    if(!response.ok)return;
    const status=await response.json();
    const el=$('crawl-status');
    if(!['running','failed','interrupted'].includes(status?.state)){el.style.display='none';return;}
    el.style.display='block';
    el.dataset.state=status.state;
    el.style.color=status.state==='running'?'var(--muted)':'var(--danger-text)';
    el.textContent=status.message||({running:'자동 갱신 중',failed:'자동 갱신 실패',interrupted:'자동 갱신 중단'}[status.state]);
    if(status.state==='running'&&status.galleryId)el.textContent+=' ('+status.galleryId+' '+(status.page||0)+'페이지)';
  }catch(e){}
}
let crawlStatusTimer;
async function pollCrawlStatus(){
  clearTimeout(crawlStatusTimer);
  await showCrawlStatus();
  const el=$('crawl-status');
  if(el.dataset.state==='running')crawlStatusTimer=setTimeout(pollCrawlStatus,15000);
}
pollCrawlStatus();
`;
  return HTML
    .replace('<div class="s" id="u"></div>', '<div class="s" id="u"></div>' + statusMarkup)
    .replace('</script></body></html>', script + '</script></body></html>');
}

export async function handlePublicGet(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: SEC });

  if (path === '/refresh-status.json') {
    if (!env.VIEW_TOKEN || url.searchParams.get('token') !== env.VIEW_TOKEN) {
      return new Response('not found', { status: 404, headers: SEC });
    }
    return Response.json(await markStaleRunInterrupted(env), {
      headers: { 'Cache-Control': 'no-store', ...SEC },
    });
  }

  if (path === '/' || path === '/data.json') {
    if (!env.VIEW_TOKEN || url.searchParams.get('token') !== env.VIEW_TOKEN) {
      return new Response('not found', { status: 404, headers: SEC });
    }
    if (path === '/') {
      return new Response(pageWithStatus(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SEC },
      });
    }
    const snapshot = await env.KV.get(SNAPSHOT_KEY);
    if (!snapshot) return new Response('{"error":"no snapshot yet"}', { status: 404, headers: SEC });
    return new Response(snapshot, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC },
    });
  }
  return null;
}
