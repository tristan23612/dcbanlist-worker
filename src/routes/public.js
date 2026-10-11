import { SEC, SNAPSHOT_KEY } from '../constants.js';
import { HTML } from '../web/page.js';
import { markStaleRunInterrupted } from '../storage/refreshStatusStore.js';

function pageWithStatus() {
  const statusMarkup = '<section class="refresh-summary" id="crawl-status"><div id="crawl-message">갱신 상태 확인 중...</div><div class="crawl-disclosure"><button type="button" class="crawl-details-toggle" aria-expanded="false" aria-controls="crawl-details-panel">세부 정보</button><div class="crawl-details-panel" id="crawl-details-panel" aria-hidden="true" inert><dl id="crawl-details"></dl></div></div></section>';
  const script = `
let crawlDetailsSignature='';
const crawlDetailsDisclosure=$('crawl-status');
const crawlDetailsToggle=crawlDetailsDisclosure.querySelector('.crawl-details-toggle');
const crawlDetailsPanel=crawlDetailsDisclosure.querySelector('.crawl-details-panel');
 crawlDetailsToggle.addEventListener('click',()=>{
  const open=crawlDetailsToggle.getAttribute('aria-expanded')!=='true';
  crawlDetailsToggle.setAttribute('aria-expanded',String(open));
  crawlDetailsPanel.setAttribute('aria-hidden',String(!open));
  crawlDetailsPanel.inert=!open;
  crawlDetailsDisclosure.classList.toggle('details-open',open);
  if(open){
    crawlDetailsPanel.style.height='0px';
    crawlDetailsPanel.offsetHeight;
    crawlDetailsPanel.style.height=crawlDetailsPanel.scrollHeight+'px';
  }else{
    crawlDetailsPanel.style.height=crawlDetailsPanel.getBoundingClientRect().height+'px';
    crawlDetailsPanel.offsetHeight;
    crawlDetailsPanel.style.height='0px';
  }
});
crawlDetailsPanel.addEventListener('transitionend',event=>{
  if(event.target===crawlDetailsPanel&&event.propertyName==='height'&&crawlDetailsToggle.getAttribute('aria-expanded')==='true'){
    crawlDetailsPanel.style.height='auto';
  }
});
function formatRefreshTime(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'미기록':date.toLocaleString('ko-KR');
}
function formatDuration(value){
  if(!Number.isFinite(Number(value)))return '미기록';
  const ms=Number(value);
  if(ms<1000)return ms+'ms';
  if(ms<60000)return (ms/1000).toFixed(1)+'초';
  const seconds=Math.round(ms/1000);
  return Math.floor(seconds/60)+'분 '+(seconds%60)+'초';
}
function renderRefreshDetails(status){
  const trigger=status.trigger==='cron'?'Cron 자동 실행':status.trigger==='manual'?'관리자 수동 실행':(status.trigger||'미상');
  const db=status.database;
  const snapshot=status.snapshot;
  const dbText=db?.status==='updated'?((db.inserted??0)+'건 추가'):db?.status==='skipped'?'추가할 기록 없음':db?.status==='running'?'저장 중':db?.status==='failed'?'실패':'미실행';
  const snapshotText=snapshot?.status==='updated'?((snapshot.rows??0)+'건'):snapshot?.status==='running'?'갱신 중':snapshot?.status==='failed'?'실패':'미실행';
  const rows=[
    ['상태',status.state||'기록 없음'],
    ['실행 방식',trigger],
    ['시작',formatRefreshTime(status.startedAt)],
    ['완료',status.finishedAt?formatRefreshTime(status.finishedAt):'진행 중'],
    ['소요 시간',Number.isFinite(Number(status.durationMs))?formatDuration(status.durationMs):(['queued','running'].includes(status.state)?'진행 중':'미기록')],
    ['DB 저장',dbText],
    ['KV 스냅샷',snapshotText],
  ];
  if(Number.isFinite(Number(status.collected)))rows.push(['수집 건수',Number(status.collected)+'건']);
  if(status.maxPages)rows.push(['페이지 상한',status.maxPages+'페이지']);
  for(const gallery of status.galleries||[]){
    rows.push([gallery.galleryId,(gallery.collected||0)+'건 수집 · '+(gallery.pagesRead||0)+'페이지 확인']);
  }
  for(const log of status.logs||[]){
    const stage=({initializing:'준비',crawl:'수집',database:'DB 저장',snapshot:'KV 스냅샷'})[log.stage]||log.stage||'갱신';
    rows.push(['오류 로그 · '+formatRefreshTime(log.at),stage+' · '+(log.message||'원인 정보 없음')]);
  }
  const signature=JSON.stringify(rows);
  if(signature===crawlDetailsSignature)return;
  crawlDetailsSignature=signature;
  const list=$('crawl-details');
  list.replaceChildren();
  for(const [label,value] of rows){
    const term=document.createElement('dt');term.textContent=label;
    const description=document.createElement('dd');description.textContent=value;
    list.append(term,description);
  }
}
async function showCrawlStatus(){
  try{
    const response=await fetch('/refresh-status.json?token='+encodeURIComponent(viewToken));
    if(!response.ok){
      $('crawl-message').textContent='갱신 상태를 불러오지 못했습니다.';
      renderRefreshDetails({});
      return null;
    }
    const status=await response.json();
    const el=$('crawl-status');
    el.dataset.state=status?.state||'';
    const refreshLabel=status?.trigger==='manual'?'수동 갱신':'자동 갱신';
    const failed=['failed','interrupted'].includes(status?.state);
    $('crawl-message').style.color=failed?'var(--danger-text)':'var(--muted)';
    if(status?.state==='queued')$('crawl-message').textContent=refreshLabel+' 대기 중';
    else if(status?.state==='running'){
      const stage=status.stage==='database'?'DB 저장 중':status.stage==='snapshot'?'KV 스냅샷 갱신 중':status.stage==='crawl'?'수집 중':'준비 중';
      const progress=status.stage==='crawl'&&status.galleryId
        ?' · '+status.galleryId+(status.page?' '+status.page+'/'+(status.pageLimit||'?')+'페이지':' 최신 기록 확인')
        :'';
      $('crawl-message').textContent=refreshLabel+' '+stage+progress;
    }else if(status?.state==='success'){
      const count=Number(status.database?.inserted)||0;
      const result=status.database?.status==='skipped'?'새 기록 없음':count+'건 저장';
      $('crawl-message').textContent=refreshLabel+' 성공 · '+result+' · '+formatDuration(status.durationMs);
    }else if(failed){
      const outcome=status.state==='interrupted'?'중단':'실패';
      $('crawl-message').textContent=refreshLabel+' '+outcome+' · '+(status.message||'원인을 확인할 수 없습니다.');
    }else{
      $('crawl-message').textContent='갱신 상태 기록이 없습니다.';
    }
    renderRefreshDetails(status||{});
    return status;
  }catch(e){
    $('crawl-message').textContent='갱신 상태를 불러오지 못했습니다.';
    renderRefreshDetails({});
    return null;
  }
}
let crawlStatusTimer;
async function pollCrawlStatus(keepPolling=false,idleDelay=60000){
  clearTimeout(crawlStatusTimer);
  const status=await showCrawlStatus();
  const active=['queued','running'].includes(status?.state);
  const button=$('manualRefresh');
  if(active){
    button.dataset.refreshing='true';
    button.disabled=true;
    const refreshLabel=status.trigger==='manual'?'수동 갱신':'자동 갱신';
    button.textContent=refreshLabel+(status.state==='queued'?' 대기 중...':' 진행 중...');
    crawlStatusTimer=setTimeout(()=>pollCrawlStatus(true,idleDelay),status.state==='queued'?2500:8000);
  }else{
    const justFinished=button.dataset.refreshing==='true';
    if(justFinished){
      delete button.dataset.refreshing;
      button.disabled=false;
      button.textContent='수동 갱신';
      if(status?.state==='success'){
        try{await loadSnapshot()}catch(e){}
        $('s').textContent=status.message||'갱신이 완료되었습니다.';
      }else if(status?.state==='failed'||status?.state==='interrupted'){
        $('s').textContent=status.message||'갱신에 실패했습니다.';
      }
    }
    if(keepPolling)crawlStatusTimer=setTimeout(()=>pollCrawlStatus(true,justFinished?60000:idleDelay),justFinished?60000:idleDelay);
  }
}
pollCrawlStatus(true,60000);
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
