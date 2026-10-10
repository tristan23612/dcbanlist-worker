import { SEC, SNAPSHOT_KEY } from '../constants.js';
import { HTML } from '../web/page.js';
import { markStaleRunInterrupted } from '../storage/refreshStatusStore.js';

function pageWithStatus() {
  const statusMarkup = '<div class="s" id="crawl-status" style="display:none"></div>';
  const script = `
async function showCrawlStatus(){
  try{
    const response=await fetch('/refresh-status.json?token='+encodeURIComponent(viewToken));
    if(!response.ok)return null;
    const status=await response.json();
    const el=$('crawl-status');
    el.dataset.state=status?.state||'';
    if(!['queued','running','failed','interrupted'].includes(status?.state)){
      el.style.display='none';
      return status;
    }
    el.style.display='block';
    el.style.color=['queued','running'].includes(status.state)?'var(--muted)':'var(--danger-text)';
    el.textContent=status.message||({queued:'자동 갱신 대기 중',running:'자동 갱신 중',failed:'자동 갱신 실패',interrupted:'자동 갱신 중단'}[status.state]);
    if(status.state==='running'&&status.galleryId)el.textContent+=' ('+status.galleryId+' '+(status.page||0)+'페이지)';
    return status;
  }catch(e){return null}
}
let crawlStatusTimer;
async function pollCrawlStatus(keepPolling=false){
  clearTimeout(crawlStatusTimer);
  const status=await showCrawlStatus();
  const el=$('crawl-status');
  const active=['queued','running'].includes(status?.state);
  const button=$('refreshNow');
  if(active){
    button.dataset.refreshing='true';
    button.disabled=true;
    button.textContent=status.state==='queued'?'갱신 대기 중...':'갱신 진행 중...';
    crawlStatusTimer=setTimeout(()=>pollCrawlStatus(false),status.state==='queued'?2500:8000);
  }else if(keepPolling){
    crawlStatusTimer=setTimeout(()=>pollCrawlStatus(true),3000);
  }else if(button.dataset.refreshing==='true'){
    delete button.dataset.refreshing;
    button.disabled=false;
    button.textContent='지금 갱신';
    if(status?.state==='success'){
      try{await loadSnapshot()}catch(e){}
      $('s').textContent=status.message||'자동 갱신이 완료되었습니다.';
    }else if(status?.state==='failed'||status?.state==='interrupted'){
      $('s').textContent=status.message||'자동 갱신에 실패했습니다.';
    }
  }
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
