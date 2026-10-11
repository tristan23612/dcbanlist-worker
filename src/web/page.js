export const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-gov-dynamic-subset.min.css" crossorigin>
<title>Ban Log Archive</title>
<style>
:root{color-scheme:light;--bg:#f6f8fa;--surface:#fff;--text:#1f2328;--muted:#656d76;--border:#d1d9e0;--header:#f6f8fa;--button-bg:#f6f8fa;--button-hover:#eaeef2;--focus:#0969da;--focus-ring:rgba(9,105,218,.22);--danger-bg:#ffebe9;--danger-text:#cf222e;--danger-border:#ff8182;--apply-bg:#cf222e;--admin-text:#1a7f37;--admin-border:#4ac26b}
:root[data-theme="dark"]{color-scheme:dark;--bg:#0d1117;--surface:#161b22;--text:#e6edf3;--muted:#9198a1;--border:#30363d;--header:#161b22;--button-bg:#21262d;--button-hover:#30363d;--focus:#2f81f7;--focus-ring:rgba(47,129,247,.3);--danger-bg:#490202;--danger-text:#ff7b72;--danger-border:#f85149;--apply-bg:#da3633;--admin-text:#3fb950;--admin-border:#238636}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;background:var(--bg);scrollbar-gutter:stable;transition:background-color .3s ease}
body{font-family:"Pretendard GOV",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:16px;background:transparent;color:var(--text);transition:color .3s ease}
.c{width:1134px;max-width:calc(100vw - 32px);margin:0 auto;background:var(--surface);color:var(--text);padding:16px;border:1px solid var(--border);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);transition:width .3s ease,background-color .3s ease,border-color .3s ease,color .3s ease,box-shadow .3s ease}
.c.admin-wide{width:1234px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.admin-actions{display:flex;align-items:center;gap:8px}
.admin-control{flex:0 1 auto;max-width:180px;margin-left:0;margin-right:0;opacity:1;transform:translateY(0);transition:max-width .3s ease,margin .3s ease,opacity .3s ease,transform .3s ease,padding .3s ease,border-width .3s ease}
.admin-control.is-hidden{visibility:hidden;flex:0 0 0;max-width:0;margin-left:-4px;margin-right:-4px;padding-left:0;padding-right:0;border-width:0;opacity:0;transform:translateY(-4px);pointer-events:none;transition:max-width .3s ease,margin .3s ease,opacity .3s ease,transform .3s ease,padding .3s ease,border-width .3s ease,visibility 0s linear .3s}
.search{display:flex;align-items:center;gap:8px;margin:12px 0}
select,input{padding:10px;border:1px solid var(--border);border-radius:6px;font-size:14px;background:var(--surface);color:var(--text);transition:background-color .3s ease,border-color .3s ease,color .3s ease,box-shadow .18s ease}
select{max-width:210px}
select:hover,input:hover{border-color:var(--focus)}
select:focus,input:focus{border-color:var(--focus);box-shadow:0 0 0 3px var(--focus-ring)}
.scope-picker{position:relative;flex:0 0 150px;max-width:150px}
.scope-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left}
#scopeLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scope-caret{width:7px;height:7px;margin:0 3px 3px 12px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transitdion:transform .16s ease}
.scope-picker.open .scope-caret{transform:rotate(225deg) translate(-2px,-2px)}
.scope-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;width:100%;min-width:0;max-height:min(320px,60vh);overflow-y:auto;padding:4px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(27,31,36,.16);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-7px) scale(.98);transform-origin:top center;transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s,background-color .3s ease,border-color .3s ease}
.scope-menu.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1);transition:opacity .16s ease,transform .16s ease,visibility 0s,background-color .3s ease,border-color .3s ease}
.scope-option{display:block;width:100%;padding:8px 10px;border:0;border-radius:5px;background:transparent;text-align:left;box-shadow:none}
.scope-option:hover,.scope-option:focus-visible{background:var(--button-hover);box-shadow:none;transform:none}
.scope-option[aria-selected="true"]{color:var(--focus);font-weight:600}
input{flex:1;min-width:80px}
button{padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--button-bg);color:var(--text);cursor:pointer;white-space:nowrap;transition:background-color .3s ease,border-color .3s ease,color .3s ease,box-shadow .16s ease,transform .16s ease,filter .16s ease}
button:hover{background:var(--button-hover)}
button:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 2px 5px rgba(27,31,36,.12)}
button:not(:disabled):active{transform:translateY(0);box-shadow:none}
.gallery-tabs .gallery-tab:not(:disabled):hover,.gallery-tabs .gallery-tab:not(:disabled):active{background:var(--button-hover);transform:none;box-shadow:none}
.scope-menu .scope-option:not(:disabled):hover,.scope-menu .scope-option:not(:disabled):active{background:var(--button-hover);transform:none;box-shadow:none}
button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
button:disabled{cursor:not-allowed;opacity:.55}
.del{width:80px;padding:4px 8px;color:var(--danger-text);border-color:var(--danger-border)}
.pending-delete{background:var(--danger-bg);color:var(--danger-text)}
.pending-delete td:not(:last-child){opacity:.6;animation:delete-mark .3s ease-out both}
tbody tr[data-row-index]{cursor:pointer}
tbody tr.row-selected td:first-child{box-shadow:inset 3px 0 var(--focus)}
.apply{color:#fff;background:var(--apply-bg);border-color:var(--apply-bg)}
.apply:hover{filter:brightness(1.08);background:var(--apply-bg)}
.admin-on{color:var(--admin-text);border-color:var(--admin-border)}
.gallery-tabs{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;border-bottom:1px solid var(--border);margin:0 0 12px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;transition:border-color .3s ease}
.gallery-tab{position:relative;flex:0 0 auto;padding:9px 12px;margin-bottom:-1px;border:0;border-radius:6px 6px 0 0;background:transparent;color:var(--muted);box-shadow:none}
.gallery-tab[aria-selected="true"]{color:var(--text);font-weight:600}
.gallery-tab[aria-selected="true"]::after{content:"";position:absolute;left:8px;right:8px;bottom:0;height:2px;border-radius:2px;background:var(--focus)}
.w{width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;table-layout:fixed;font-size:13px;transition:width .3s ease}
th,td{padding:8px;text-align:left;word-break:break-word}
.cell-value{position:relative;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top}
.cell-value::after{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px solid currentColor;transform:scaleX(0);transform-origin:left center;transition:transform .3s ease;pointer-events:none}
.pending-delete .cell-value::after{transform:scaleX(1)}
td:not(:last-child){transition:opacity .3s ease}
th{height:38px;background:var(--header);border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background-color .3s ease,border-color .3s ease}
td{height:38px;vertical-align:middle}
.admin-cell{padding:4px 8px}
.admin-cell .del{display:block;margin:0 auto;line-height:16px}
.cell-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;line-height:20px;max-height:20px;text-overflow:ellipsis}
tbody tr:hover{background:var(--button-hover)}
.pending-delete:hover{background:var(--danger-bg)}
.s{font-size:12px;color:var(--muted);margin-top:8px;transition:color .3s ease}
#u{min-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.refresh-summary{margin:4px 0 8px;padding:8px 10px;border:1px solid var(--border);border-left:3px solid var(--border);border-radius:6px;background:var(--header);font-size:12px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere;transition:background-color .3s ease,border-color .3s ease,color .3s ease}
.refresh-summary[data-state="running"],.refresh-summary[data-state="queued"]{border-left-color:var(--focus)}
.refresh-summary[data-state="failed"],.refresh-summary[data-state="interrupted"]{border-left-color:var(--danger-text)}
.crawl-disclosure{margin-top:4px}
.refresh-summary .crawl-details-toggle{display:block;width:max-content;padding:0;border:0;background:transparent;color:inherit;text-align:left;white-space:normal;box-shadow:none;transform:none}
.refresh-summary .crawl-details-toggle:hover,.refresh-summary .crawl-details-toggle:active{background:transparent;box-shadow:none;transform:none}
.crawl-details-toggle::before{content:"";display:inline-block;width:0;height:0;margin:0 6px 2px 1px;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:5px solid currentColor;transition:transform .24s ease}
.refresh-summary.details-open .crawl-details-toggle::before{transform:rotate(90deg)}
.crawl-details-panel{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .24s ease,opacity .18s ease}
.refresh-summary.details-open .crawl-details-panel{grid-template-rows:1fr;opacity:1}
.crawl-details-panel #crawl-details{min-height:0;overflow:hidden;display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;margin-top:8px}
#crawl-details dt{font-weight:600;color:var(--text)}
#crawl-details dd{min-width:0;overflow-wrap:anywhere}
tbody tr{border-bottom:1px solid var(--border);transition:background-color .3s ease,border-color .3s ease}
tbody tr.row-enter{animation:row-enter .16s ease-out both}
@keyframes row-enter{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
@keyframes delete-mark{from{opacity:1}to{opacity:.6}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto;transition-duration:.3s!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}body,.c{transition-duration:.3s!important}.scope-menu,.scope-caret{transition-duration:.16s!important}.crawl-details-panel,.crawl-details-toggle::before{transition-duration:.01ms!important}}
@media(max-width:600px){body{padding:8px}.c,.c.admin-wide{width:100%;max-width:none;padding:10px}.top{align-items:flex-start;flex-direction:column}.admin-actions{width:100%;flex-wrap:wrap}.admin-actions button{flex:1}.search{flex-wrap:wrap}.scope-picker{max-width:150px;flex:0 0 150px}.w{width:100%;margin:0}input{order:2;flex-basis:100%}}
</style></head><body><div class="c">
<div class="top"><h2>차단 기록 아카이브</h2><div class="admin-actions"><button id="theme" type="button">다크 모드</button><button id="manualRefresh" class="admin-control is-hidden" aria-hidden="true" tabindex="-1">수동 갱신</button><button id="apply" class="apply admin-control is-hidden" aria-hidden="true" tabindex="-1" disabled>삭제 반영</button><button id="a">관리자 인증</button></div></div><div class="s" id="u">마지막 데이터 갱신: 불러오는 중...</div>
<div class="search"><div class="scope-picker" id="scopePicker"><button type="button" id="scopeToggle" class="scope-toggle" aria-label="검색 범위" aria-haspopup="listbox" aria-expanded="false" aria-controls="scopeMenu"><span id="scopeLabel">전체</span><span class="scope-caret" aria-hidden="true"></span></button><div class="scope-menu" id="scopeMenu" role="listbox" aria-label="검색 범위"></div></div><select id="scope" aria-label="검색 범위" style="display:none"><option value="all">전체</option></select><input id="q" placeholder="검색..."><button id="copy">전체 복사</button></div>
<div class="gallery-tabs" id="galleryTabs" role="tablist" aria-label="갤러리"></div>
<div class="w"><table id="t"><colgroup id="cols"></colgroup><thead><tr id="h"></tr></thead><tbody id="b"></tbody></table></div>
<div class="s" id="s">불러오는 중...</div>
<button id="m" style="display:none">더 보기</button>
</div><script>
let rows=[],rowIds=[],columns=[],galleries=[],selectedGallery='',view=[],shown=0,lastRenderedIndices=[],lastRenderedIds=[],selectedRowIndex=null,adminToken='',pendingDelete=new Set(),applyingDeletes=false;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let savedTheme=null;
try{savedTheme=localStorage.getItem('dc-banlist-theme')}catch(e){}
const initialTheme=savedTheme||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
function setTheme(theme){
  document.documentElement.dataset.theme=theme;
  $('theme').textContent=theme==='dark'?'라이트 모드':'다크 모드';
  try{localStorage.setItem('dc-banlist-theme',theme)}catch(e){}
}
setTheme(initialTheme);
$('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
function updateApplyButton(){
  $('apply').classList.toggle('is-hidden',!adminToken);
  $('apply').setAttribute('aria-hidden',String(!adminToken));
  $('apply').tabIndex=adminToken?0:-1;
  $('apply').disabled=applyingDeletes||pendingDelete.size===0;
  $('apply').textContent=applyingDeletes?'삭제 및 갱신 중...':'삭제 반영'+(pendingDelete.size?' ('+pendingDelete.size+')':'');
}
function updateAdminUi(){
  $('a').textContent=adminToken?'관리자 인증됨':'관리자 인증';
  $('a').classList.toggle('admin-on',Boolean(adminToken));
  $('manualRefresh').classList.toggle('is-hidden',!adminToken);
  $('manualRefresh').setAttribute('aria-hidden',String(!adminToken));
  $('manualRefresh').tabIndex=adminToken?0:-1;
  updateApplyButton();
}
function updateCopyButton(){
  $('copy').textContent=selectedRowIndex!==null&&view.includes(selectedRowIndex)?'선택 복사':'전체 복사';
}
function updateScopeSelection(value){
  $('scopeLabel').textContent=value==='all'?'전체':(columns[Number(value)+1]||'전체');
  $('scopeMenu').querySelectorAll('.scope-option').forEach(option=>{
    option.setAttribute('aria-selected',String(option.dataset.value===value));
  });
}
function closeScopeMenu(returnFocus){
  $('scopePicker').classList.remove('open');
  $('scopeMenu').classList.remove('open');
  $('scopeToggle').setAttribute('aria-expanded','false');
  if(returnFocus)$('scopeToggle').focus();
}
function openScopeMenu(){
  $('scopePicker').classList.add('open');
  $('scopeMenu').classList.add('open');
  $('scopeToggle').setAttribute('aria-expanded','true');
  const selected=$('scopeMenu').querySelector('[aria-selected="true"]')||$('scopeMenu').querySelector('.scope-option');
  if(selected)selected.focus();
}
function renderGalleryTabs(){
  const previousGallery=selectedGallery;
  galleries=[...new Set(rows.map(row=>String(row[0]??'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base',numeric:true}));
  selectedGallery=galleries.includes(previousGallery)?previousGallery:(galleries[0]||'');
  $('galleryTabs').innerHTML=galleries.map(gallery=>
    '<button type="button" class="gallery-tab" role="tab" aria-selected="'+String(gallery===selectedGallery)+'" data-gallery="'+esc(gallery)+'">'+esc(gallery)+'</button>'
  ).join('');
}
$('galleryTabs').onclick=e=>{
  const tab=e.target.closest('.gallery-tab');
  if(!tab)return;
  selectedGallery=tab.dataset.gallery;
  $('galleryTabs').querySelectorAll('.gallery-tab').forEach(item=>item.setAttribute('aria-selected',String(item===tab)));
  filterRows();
};
$('scopeToggle').onclick=()=>{
  if($('scopePicker').classList.contains('open'))closeScopeMenu(false);else openScopeMenu();
};
$('scopeToggle').onkeydown=e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    openScopeMenu();
  }
};
$('scopeMenu').onclick=e=>{
  const option=e.target.closest('.scope-option');
  if(!option)return;
  $('scope').value=option.dataset.value;
  updateScopeSelection(option.dataset.value);
  $('scope').dispatchEvent(new Event('change',{bubbles:true}));
  closeScopeMenu(true);
};
$('scopeMenu').onkeydown=e=>{
  const options=[...$('scopeMenu').querySelectorAll('.scope-option')];
  const index=options.indexOf(document.activeElement);
  if(e.key==='Escape'){
    e.preventDefault();
    closeScopeMenu(true);
  }else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    const delta=e.key==='ArrowDown'?1:-1;
    options[(index+delta+options.length)%options.length]?.focus();
  }else if(e.key==='Home'){
    e.preventDefault();options[0]?.focus();
  }else if(e.key==='End'){
    e.preventDefault();options[options.length-1]?.focus();
  }
};
document.addEventListener('click',e=>{
  if(!$('scopePicker').contains(e.target))closeScopeMenu(false);
});
$('scopePicker').addEventListener('focusout',()=>setTimeout(()=>{
  if(!$('scopePicker').contains(document.activeElement))closeScopeMenu(false);
},0));
function filterRows(forceRender=false){
  const q=$('q').value.trim().toLowerCase(),scope=$('scope').value;
  const nextView=[];
  for(let i=0;i<rows.length;i++){
    if(selectedGallery&&String(rows[i][0]??'').trim()!==selectedGallery)continue;
    const hay=scope==='all'?rows[i].slice(1).join('\\t'):String(rows[i][Number(scope)+1]??'');
    if(!q||hay.toLowerCase().includes(q))nextView.push(i);
  }
  const nextIds=nextView.map(i=>rowIds[i]);
  const resultsChanged=nextIds.length!==lastRenderedIds.length||nextIds.some((id,i)=>id!==lastRenderedIds[i]);
  const indicesChanged=nextView.length!==lastRenderedIndices.length||nextView.some((index,i)=>index!==lastRenderedIndices[i]);
  view=nextView;
  if(selectedRowIndex!==null&&!view.includes(selectedRowIndex))selectedRowIndex=null;
  if(forceRender||resultsChanged||indicesChanged)render(false,resultsChanged);
}
function render(more,animateRows=false){
  if(!more)shown=0;
  const widths=[150,150,250,200,50,150,150];
  const hasAdminColumn=adminToken&&rowIds.length===rows.length;
  document.querySelector('.c').classList.toggle('admin-wide',Boolean(hasAdminColumn));
  $('cols').innerHTML=columns.slice(1).map((_,i)=>'<col style="width:'+(widths[i]||140)+'px">').join('')+(hasAdminColumn?'<col style="width:100px">':'');
  $('t').style.width=(widths.slice(0,columns.length-1).reduce((sum,width)=>sum+width,0)+(hasAdminColumn?100:0))+'px';
  $('h').innerHTML=columns.slice(1).map(k=>'<th title="'+esc(k)+'">'+esc(k)+'</th>').join('')+(hasAdminColumn?'<th>관리</th>':'');
  const end=Math.min(shown+100,view.length),out=[];
  for(let i=shown;i<end;i++){
    const rowIndex=view[i];
    const cells=rows[rowIndex].slice(1).map(v=>'<td title="'+esc(v)+'"><div class="cell-text"><span class="cell-value">'+esc(v)+'</span></div></td>').join('');
    const pending=adminToken&&pendingDelete.has(rowIds[rowIndex]);
    const selected=rowIndex===selectedRowIndex;
    const deleteCell=adminToken&&rowIds[rowIndex]!=null?'<td class="admin-cell"><button class="del" data-index="'+rowIndex+'"'+(applyingDeletes?' disabled':'')+'>'+(pending?'삭제 취소':'삭제 표시')+'</button></td>':'';
    const rowClasses=[more||animateRows?'row-enter':'',pending?'pending-delete':'',selected?'row-selected':''].filter(Boolean).join(' ');
    out.push('<tr data-row-index="'+rowIndex+'" aria-selected="'+String(selected)+'"'+(rowClasses?' class="'+rowClasses+'"':'')+'>'+cells+deleteCell+'</tr>');
  }
  if(more)$('b').insertAdjacentHTML('beforeend',out.join(''));else $('b').innerHTML=out.join('');
  shown=end;
  lastRenderedIndices=[...view];
  lastRenderedIds=view.map(i=>rowIds[i]);
  $('s').textContent=view.length+'건 중 '+shown+'건 표시';
  $('m').style.display=shown<view.length?'':'none';
  updateApplyButton();
  updateCopyButton();
}
const viewToken = new URLSearchParams(location.search).get('token') || '';
async function loadSnapshot(){
  const r=await fetch('/data.json?token='+encodeURIComponent(viewToken));
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();
  selectedRowIndex=null;
  rows=j.rows||[];
  rowIds=j.ids||[];
  columns=j.columns||[];
  renderGalleryTabs();
  $('scope').innerHTML='<option value="all">전체</option>'+columns.slice(1).map((k,i)=>'<option value="'+i+'">'+esc(k)+'</option>').join('');
  $('scopeMenu').innerHTML='<button type="button" class="scope-option" role="option" aria-selected="false" data-value="all">전체</button>'+columns.slice(1).map((k,i)=>'<button type="button" class="scope-option" role="option" aria-selected="false" data-value="'+i+'">'+esc(k)+'</button>').join('');
  updateScopeSelection('all');
  $('u').textContent=j.updatedAt
    ?'마지막 데이터 갱신: '+new Date(j.updatedAt).toLocaleString('ko-KR')
    :'마지막 데이터 갱신: 기록 없음';
  filterRows(true);
}
async function initializePage(){
  try{await loadSnapshot()}catch(e){$('u').textContent='마지막 데이터 갱신: 확인 불가';$('s').textContent='데이터 로드 실패: '+e.message;return}
  let storedToken='';
  try{storedToken=sessionStorage.getItem('dc-banlist-admin-token')||''}catch(e){}
  if(!storedToken)return;
  try{
    const response=await fetch('/admin/verify',{method:'POST',headers:{Authorization:'Bearer '+storedToken}});
    const result=await response.json();
    if(!response.ok||result.status!=='success')throw new Error('관리자 토큰이 만료되었거나 올바르지 않습니다.');
    adminToken=storedToken;updateAdminUi();await loadSnapshot();
  }catch(e){
    try{sessionStorage.removeItem('dc-banlist-admin-token')}catch(ignore){}
    adminToken='';updateAdminUi();
  }
}
initializePage();
let t;
$('q').oninput=()=>{clearTimeout(t);t=setTimeout(filterRows,150)};
$('scope').onchange=filterRows;
$('m').onclick=()=>render(true);
$('copy').onclick=async()=>{
  const query=$('q').value.trim();
  const scope=$('scope').value;
  const visibleColumns=columns.slice(1);
  const selected=selectedRowIndex!==null&&view.includes(selectedRowIndex);
  const copiedRowIndex=selected?selectedRowIndex:null;
  const copiedRows=selected?[copiedRowIndex]:view;
  const searchCondition=query?'검색: '+(scope==='all'?'전체':visibleColumns[Number(scope)])+' = '+query:'';
  const title=[selectedGallery,selected?'선택 복사':'전체 복사',searchCondition].filter(Boolean).join(' · ');
  const text=title+'\\n'+copiedRows.length+'건\\n\\n'+copiedRows.map(i=>
    visibleColumns.map((column,j)=>column+': '+String(rows[i][j+1]??'')).join('\\n')
  ).join('\\n\\n');
  try{
    await navigator.clipboard.writeText(text);
    if(selected&&selectedRowIndex===copiedRowIndex){
      const row=$('b').querySelector('tr[data-row-index="'+copiedRowIndex+'"]');
      if(row){row.classList.remove('row-selected');row.setAttribute('aria-selected','false')}
      selectedRowIndex=null;updateCopyButton();
    }
    $('s').textContent=copiedRows.length+'건을 복사했습니다.'
  }
  catch(e){$('s').textContent='복사하지 못했습니다. 브라우저 클립보드 권한을 확인해주세요.'}
};
$('a').onclick=async()=>{
  if(adminToken){adminToken='';pendingDelete.clear();try{sessionStorage.removeItem('dc-banlist-admin-token')}catch(e){}updateAdminUi();render(false);return}
  const token=prompt('관리자 토큰을 입력하세요.');
  if(!token)return;
  try{
    const r=await fetch('/admin/verify',{method:'POST',headers:{Authorization:'Bearer '+token}});
    const j=await r.json();
    if(!r.ok||j.status!=='success')throw new Error('관리자 인증에 실패했습니다.');
    adminToken=token;try{sessionStorage.setItem('dc-banlist-admin-token',token)}catch(e){}updateAdminUi();await loadSnapshot();
  }catch(e){alert(e.message)}
};
$('manualRefresh').onclick=async()=>{
  if(!adminToken)return;
  const button=$('manualRefresh');button.dataset.refreshing='true';button.disabled=true;button.textContent='수동 갱신 요청 중...';$('s').textContent='수동 갱신 요청을 전송하고 있습니다...';
  try{
    const response=await fetch('/admin/manual-refresh',{method:'POST',headers:{Authorization:'Bearer '+adminToken}});
    const result=await response.json();
    if((!response.ok&&result.status!=='running')||!['started','running'].includes(result.status))throw new Error(result.message||'수동 갱신 요청에 실패했습니다.');
    $('s').textContent=result.status==='running'?result.message:'수동 갱신을 시작했습니다. 진행 상태를 확인하고 있습니다...';
    if(typeof pollCrawlStatus==='function')pollCrawlStatus(true,3000);
  }catch(e){delete button.dataset.refreshing;button.disabled=false;button.textContent='수동 갱신';$('s').textContent=e.message}
};
$('b').onclick=async e=>{
  const button=e.target.closest('.del');
  if(button){
    if(!adminToken||applyingDeletes)return;
    const index=Number(button.dataset.index),id=rowIds[index];
    if(pendingDelete.has(id))pendingDelete.delete(id);else pendingDelete.add(id);
    const pending=pendingDelete.has(id);
    button.closest('tr').classList.toggle('pending-delete',pending);
    button.textContent=pending?'삭제 취소':'삭제 표시';
    updateApplyButton();
    return;
  }
  const row=e.target.closest('tr[data-row-index]');
  if(!row)return;
  const previous=selectedRowIndex;
  selectedRowIndex=Number(row.dataset.rowIndex)===previous?null:Number(row.dataset.rowIndex);
  if(previous!==null){
    const previousRow=$('b').querySelector('tr[data-row-index="'+previous+'"]');
    if(previousRow){previousRow.classList.remove('row-selected');previousRow.setAttribute('aria-selected','false')}
  }
  if(selectedRowIndex!==null){
    row.classList.add('row-selected');row.setAttribute('aria-selected','true');
  }
  updateCopyButton();
};
$('apply').onclick=async()=>{
  if(!adminToken||pendingDelete.size===0)return;
  const ids=[...pendingDelete];
  if(!confirm(ids.length+'건을 DB에서 삭제하고 KV 스냅샷에 반영할까요?'))return;
  applyingDeletes=true;updateApplyButton();
  document.querySelectorAll('.del').forEach(button=>button.disabled=true);
  $('s').textContent=ids.length+'건 삭제 및 KV 갱신 중...';
  try{
    const r=await fetch('/admin/delete',{method:'POST',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:JSON.stringify({ids})});
    const j=await r.json();
    if(!r.ok||j.status!=='success')throw new Error(j.message||'삭제에 실패했습니다.');
    const deletedIds=new Set(ids);
    for(let i=rowIds.length-1;i>=0;i--)if(deletedIds.has(rowIds[i])){rowIds.splice(i,1);rows.splice(i,1)}
    pendingDelete.clear();selectedRowIndex=null;renderGalleryTabs();filterRows();$('s').textContent=(j.deleted||0)+'건을 삭제하고 KV 스냅샷을 갱신했습니다.';
  }catch(e){$('s').textContent='삭제/갱신 실패: '+e.message}
  finally{
    applyingDeletes=false;updateApplyButton();
    document.querySelectorAll('.del').forEach(button=>button.disabled=false);
  }
};
</script></body></html>`;;

