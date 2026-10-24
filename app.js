/* CSV Compass: all parsing, profiling and cleaning happens in this browser tab. */
import { parseCSV, detectDelimiter, encodeCell, decodeCSV } from './csv-core.js';
(() => {
  'use strict';
  const MAX_BYTES = 100 * 1024 * 1024;
  const $ = (s) => document.querySelector(s);
  const drop = $('#dropZone'), fileInput = $('#fileInput'), workspace = $('#workspace'), table = $('#dataTable');
  let headers = [], rows = [], original = [], history = [], fileBytes = 0, fileName = '', delimiter = ',', protectFormulas = true, toastTimer;

  function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
  function snapshot() { history.push({headers:[...headers],rows:rows.map(r=>[...r])}); if (history.length>20) history.shift(); $('#undoButton').disabled = false; }
  function updateStats() {
    const cols=headers.length, cells=rows.length*cols, blanks=rows.reduce((n,r)=>n+r.filter(v=>String(v).trim()==='').length,0), dup=duplicateCount(rows);
    const items=[['Rows',rows.length.toLocaleString(),'records loaded'],['Columns',cols.toLocaleString(),'fields detected'],['Empty cells',blanks.toLocaleString(),cells?`${Math.round(blanks/cells*100)}% of all cells`:'No cells'],['Duplicate rows',dup.toLocaleString(),dup?'ready to remove':'none found']];
    $('#stats').innerHTML=items.map(([a,b,c])=>`<article class="stat-card"><div class="stat-label">${a}</div><div class="stat-value">${b}</div><div class="stat-detail">${c}</div></article>`).join('');
  }
  function duplicateCount(data){const seen=new Set();let n=0;for(const r of data){const k=JSON.stringify(r);if(seen.has(k))n++;else seen.add(k)}return n}
  function render() {
    updateStats(); const q=$('#searchInput').value.trim().toLocaleLowerCase(); const shown=rows.map((r,i)=>({r,i})).filter(({r})=>!q||r.some(v=>String(v).toLocaleLowerCase().includes(q)));
    const thead=`<thead><tr><th>#</th>${headers.map((h,i)=>`<th title="${escapeHTML(h)}">${escapeHTML(h||`Column ${i+1}`)}</th>`).join('')}</tr></thead>`;
    const tbody=shown.slice(0,500).map(({r,i})=>`<tr><td class="row-index">${i+1}</td>${headers.map((_,j)=>{const v=r[j]??'';return `<td class="${String(v).trim()===''?'empty-cell':''}" title="${escapeHTML(v)}">${String(v).trim()===''?'empty':escapeHTML(v)}</td>`}).join('')}</tr>`).join('');
    table.innerHTML=thead+`<tbody>${tbody}</tbody>`; $('#emptySearch').classList.toggle('hidden',shown.length!==0); $('#rowCount').textContent=`Showing ${Math.min(shown.length,500).toLocaleString()} of ${shown.length.toLocaleString()} matching rows${shown.length>500?' · preview limited to 500':''}`;
  }
  function escapeHTML(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function loadFile(file){if(!file)return;if(file.size>MAX_BYTES){notify('This file is larger than the 100 MB limit.');return}try{let text=decodeCSV(await file.arrayBuffer());if(text.includes('\u0000')){notify('This file does not look like a text CSV.');return}text=text.replace(/^\uFEFF/,'');delimiter=detectDelimiter(text);const parsed=parseCSV(text,delimiter);if(!parsed.length||parsed[0].length<1){notify('No table data found in this file.');return}headers=parsed.shift().map((h,i)=>h.trim()||`Column ${i+1}`);rows=parsed.map(r=>Array.from({length:headers.length},(_,i)=>r[i]??''));original=rows.map(r=>[...r]);history=[];fileName=file.name;fileBytes=file.size;$('#fileName').textContent=fileName;$('#fileMeta').textContent=`${formatBytes(fileBytes)} · ${delimiter==='\t'?'tab':delimiter===';'?'semicolon':delimiter==='|'?'pipe':'comma'} separated · ${headers.length} columns`;$('#searchInput').value='';$('#undoButton').disabled=true;workspace.classList.remove('hidden');workspace.scrollIntoView({behavior:'smooth',block:'start'});render();notify('File opened locally. Nothing was uploaded.')}catch(e){notify(`Could not read this file: ${e.message}`)}}
  function formatBytes(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`}
  $('#chooseButton').addEventListener('click',e=>{e.stopPropagation();fileInput.click()});drop.addEventListener('click',()=>fileInput.click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}});fileInput.addEventListener('change',()=>loadFile(fileInput.files[0]));
  for(const ev of ['dragenter','dragover'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragging')});for(const ev of ['dragleave','drop'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragging')});drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
  $('#searchInput').addEventListener('input',render);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#searchInput').value){$('#searchInput').value='';render()}});
  $('#cleanButton').addEventListener('click',()=>{snapshot();rows=rows.map(r=>r.map(v=>String(v).split(/\r?\n/).map(line=>line.trim().replace(/[^\S\r\n]+/g,' ')).join('\n')));render();notify('Trimmed whitespace on each line and collapsed repeated spaces.')});
  $('#duplicatesButton').addEventListener('click',()=>{snapshot();const seen=new Set();rows=rows.filter(r=>{const k=JSON.stringify(r);if(seen.has(k))return false;seen.add(k);return true});const removed=original.length?Math.max(0,history.at(-1).rows.length-rows.length):0;render();notify(`Removed ${removed} duplicate ${removed===1?'row':'rows'}.`)});
  $('#undoButton').addEventListener('click',()=>{const state=history.pop();if(!state)return;headers=state.headers;rows=state.rows;$('#undoButton').disabled=history.length===0;render();notify('Last cleaning action undone.')});
  $('#formulaButton').addEventListener('click',e=>{protectFormulas=!protectFormulas;e.currentTarget.setAttribute('aria-pressed',String(protectFormulas));notify(protectFormulas?'Formula protection enabled for export.':'Formula protection disabled.')});
  $('#exportButton').addEventListener('click',()=>{if(!headers.length)return;const data=[headers,...rows].map(r=>headers.map((_,i)=>encodeCell(r[i]??'',protectFormulas)).join(delimiter)).join('\r\n');const blob=new Blob(['\uFEFF',data],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName.replace(/\.[^.]*$/,'')+'-cleaned.csv';a.click();URL.revokeObjectURL(a.href);notify('Clean CSV downloaded to your device.')});
  $('#resetButton').addEventListener('click',()=>{headers=[];rows=[];history=[];fileInput.value='';workspace.classList.add('hidden');window.scrollTo({top:0,behavior:'smooth'})});
  $('#themeButton').addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem('csv-compass-theme',document.body.classList.contains('light')?'light':'dark')});if(localStorage.getItem('csv-compass-theme')==='light')document.body.classList.add('light');
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
