// ========== Helpers ==========
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const log = (m) => { const p = $('#log'); p.textContent += (m + '\n'); p.scrollTop = p.scrollHeight; };
const fmtBytes = (b) => { if(!b && b!==0) return '-'; const u=['B','KB','MB','GB']; let i=0; while(b>=1024 && i<u.length-1){b/=1024;i++;} return b.toFixed(i?1:0)+' '+u[i]; };

const fileState = []; // {id,file,name,size,ab}
let MODE = 'split';
let dragIndex = null;

// ========== File List UI ==========
function renderFiles(){
  const ul = $('#fileList'); ul.innerHTML = '';
  fileState.forEach((f, idx)=>{
    const li = document.createElement('li');
    li.className = 'flex items-center gap-3 bg-slate-800/50 rounded-xl p-3 hover:bg-slate-800';
    li.draggable = true;
    li.dataset.index = String(idx);
    li.innerHTML =
      '<div class="w-10 h-10 rounded-lg bg-slate-900/60 flex items-center justify-center text-slate-300">'+(idx+1)+'</div>'+
      '<div class="flex-1 min-w-0">'+
        '<div class="truncate">'+f.name+'</div>'+
        '<div class="text-xs text-slate-400">'+fmtBytes(f.size)+'</div>'+
      '</div>'+
      '<button class="text-xs px-2.5 py-1 rounded-lg bg-slate-700/70 hover:bg-slate-600 remove">Hapus</button>';

    li.addEventListener('dragstart', ()=>{ dragIndex = idx; li.classList.add('opacity-60'); });
    li.addEventListener('dragend',   ()=>{ dragIndex = null; li.classList.remove('opacity-60'); });
    li.addEventListener('dragover',  (e)=>{ e.preventDefault(); });
    li.addEventListener('drop',      ()=>{
      if(dragIndex===null) return;
      const target = idx;
      const moved = fileState.splice(dragIndex,1)[0]; fileState.splice(target,0,moved);
      renderFiles();
    });
    li.querySelector('.remove').onclick = ()=>{ fileState.splice(idx,1); renderFiles(); };
    ul.appendChild(li);
  });
}

async function addFiles(files){
  const arr = Array.from(files||[]);
  for(const file of arr){
    if(file.type !== 'application/pdf'){ log('Lewati: '+file.name+' (bukan PDF)'); continue; }
    const ab = await file.arrayBuffer();
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
    fileState.push({ id, file, name: file.name, size: file.size, ab });
  }
  renderFiles();
  log('Ditambahkan '+arr.length+' file');
}

// ========== Mode Panel ==========
function buildPanel(){
  const p = $('#panel');
  if(MODE==='split'){
    p.innerHTML =
      '<div>'+
        '<div class="font-medium mb-2">Split Options</div>'+
        '<label class="block text-slate-300">Pilih skenario</label>'+
        '<select id="splitScenario" class="mt-1 w-full bg-slate-800 rounded-lg p-2.5">'+
          '<option value="one">1) Ambil 1 halaman</option>'+
          '<option value="range">2) Ambil rentang halaman</option>'+
          '<option value="multi">3) Ambil multi seleksi</option>'+
          '<option value="one_plus_rest">4) Ambil 1 halaman + sisanya</option>'+
          '<option value="all">5) Split semua halaman ke file terpisah</option>'+
        '</select>'+
        '<div class="mt-3 space-y-2">'+
          '<input id="splitPage" type="number" min="1" placeholder="Halaman (mis. 3)" class="w-full bg-slate-800 rounded-lg p-2.5">'+
          '<div class="grid grid-cols-2 gap-2">'+
            '<input id="splitStart" type="number" min="1" placeholder="Start (mis. 2)" class="bg-slate-800 rounded-lg p-2.5">'+
            '<input id="splitEnd" type="number" min="1" placeholder="End (kosong = sampai akhir)" class="bg-slate-800 rounded-lg p-2.5">'+
          '</div>'+
          '<input id="splitSpec" type="text" placeholder="Multi: 1,3,5-7,10-" class="w-full bg-slate-800 rounded-lg p-2.5">'+
          '<input id="splitPrefix" type="text" placeholder="Prefix untuk opsi (5), default: page" class="w-full bg-slate-800 rounded-lg p-2.5">'+
        '</div>'+
        '<p class="text-xs text-slate-400 mt-2">Gunakan 1 file saja pada daftar File.</p>'+
      '</div>';
  } else if(MODE==='merge'){
    p.innerHTML =
      '<div>'+
        '<div class="font-medium mb-2">Merge Options (Normal)</div>'+
        '<p class="text-xs text-slate-400">Urutkan file di panel kanan sesuai keinginan (drag).</p>'+
        '<input id="mergeName" type="text" placeholder="Nama output (merged.pdf)" class="mt-3 w-full bg-slate-800 rounded-lg p-2.5">'+
      '</div>';
  } else if(MODE==='insert'){
    p.innerHTML =
      '<div>'+
        '<div class="font-medium mb-2">Insert Options</div>'+
        '<p class="text-xs text-slate-400">Gunakan 2 file: pertama = utama, kedua = selipan.</p>'+
        '<label class="block mt-2">Posisi:</label>'+
        '<select id="insertPos" class="w-full bg-slate-800 rounded-lg p-2.5">'+
          '<option value="start">1) Di awal file</option>'+
          '<option value="end">2) Di akhir file</option>'+
          '<option value="afterN">3) Setelah halaman ke-N</option>'+
          '<option value="afterRange">4) Setelah rentang start-end</option>'+
        '</select>'+
        '<div class="grid grid-cols-2 gap-2 mt-3">'+
          '<input id="insertN" type="number" min="0" placeholder="N (0=awal)" class="bg-slate-800 rounded-lg p-2.5">'+
          '<input id="insertRange" type="text" placeholder="start-end (mis. 3-10)" class="bg-slate-800 rounded-lg p-2.5">'+
        '</div>'+
        '<input id="insertName" type="text" placeholder="Nama output (merged_insert.pdf)" class="mt-3 w-full bg-slate-800 rounded-lg p-2.5">'+
      '</div>';
  } else if(MODE==='compress'){
    p.innerHTML =
      '<div>'+
        '<div class="font-medium mb-2">Compress Options</div>'+
        '<p class="text-xs text-slate-400">Ini bukan Ghostscript. Kita rasterize pakai PDF.js lalu rebuild dengan jsPDF. Hasil: ukuran turun, tetapi teks jadi gambar.</p>'+
        '<label class="block mt-2">Level:</label>'+
        '<select id="cmpLevel" class="w-full bg-slate-800 rounded-lg p-2.5">'+
          '<option value="extreme">extreme (kecil sekali, kasar)</option>'+
          '<option value="medium" selected>medium (seimbang)</option>'+
          '<option value="kecil">kecil (lebih tajam, ukuran lebih besar)</option>'+
        '</select>'+
        '<input id="cmpName" type="text" placeholder="Nama output (compressed.pdf)" class="mt-3 w-full bg-slate-800 rounded-lg p-2.5">'+
      '</div>';
  }
}

// ========== Mode Buttons ==========
$("[data-mode='split']").onclick  = ()=>{ MODE='split';  buildPanel(); log('Mode: split'); };
$("[data-mode='merge']").onclick  = ()=>{ MODE='merge';  buildPanel(); log('Mode: merge'); };
$("[data-mode='insert']").onclick = ()=>{ MODE='insert'; buildPanel(); log('Mode: insert'); };
$("[data-mode='compress']").onclick=()=>{ MODE='compress';buildPanel(); log('Mode: compress'); };

// ========== Dropzone ==========
const dz = $('#dropzone');
dz.addEventListener('dragover',  (e)=>{ e.preventDefault(); dz.classList.add('ring-2','ring-indigo-500'); });
dz.addEventListener('dragleave', ()=>  dz.classList.remove('ring-2','ring-indigo-500'));
dz.addEventListener('drop',      (e)=>{ e.preventDefault(); dz.classList.remove('ring-2','ring-indigo-500'); addFiles(e.dataTransfer.files); });
$('#fileInput').addEventListener('change', (e)=> addFiles(e.target.files));

$('#clearLog').onclick = ()=> $('#log').textContent = '';
$('#resetBtn').onclick = ()=>{ fileState.length = 0; renderFiles(); $('#log').textContent = ''; };

// Ctrl+Enter
document.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && e.key==='Enter'){ $('#runBtn').click(); } });

// ========== Core Ops (pdf-lib) ==========
async function loadPdfDoc(ab){ return await PDFLib.PDFDocument.load(ab); }

async function splitOne(ab, pageNum){
  const src = await loadPdfDoc(ab);
  const out = await PDFLib.PDFDocument.create();
  const copied = await out.copyPages(src, [pageNum-1]);
  out.addPage(copied[0]);
  return await out.save();
}
async function splitRange(ab, start, end){
  const src = await loadPdfDoc(ab); const total = src.getPageCount();
  const s = Math.max(1, start), e = Math.min(end || total, total);
  if(s>e) throw new Error('Range invalid: '+start+'-'+end);
  const out = await PDFLib.PDFDocument.create();
  const idx = Array.from({length:e-s+1}, (_,i)=> s-1+i);
  const pages = await out.copyPages(src, idx);
  pages.forEach(p=> out.addPage(p));
  return await out.save();
}
async function splitMulti(ab, spec){
  const src = await loadPdfDoc(ab); const total = src.getPageCount();
  const parts = spec.split(',').map(s=>s.trim()).filter(Boolean);
  const outList = []; let idx = 1;
  for(const part of parts){
    if(part.includes('-')){
      const bits = part.split('-'); const a = bits[0].trim(); const b = bits[1].trim();
      const start = a ? parseInt(a,10) : 1; const end = b ? parseInt(b,10) : total;
      const bytes = await splitRange(ab, start, end);
      outList.push({ name: 'pick_'+idx+'_'+start+'-'+end+'.pdf', bytes });
    } else {
      const p = parseInt(part,10);
      const bytes = await splitOne(ab, p);
      outList.push({ name: 'pick_'+idx+'_'+p+'-'+p+'.pdf', bytes });
    }
    idx++;
  }
  return outList;
}
async function splitAll(ab, prefix){
  if(!prefix) prefix='page';
  const src = await loadPdfDoc(ab); const total = src.getPageCount();
  const outs = [];
  for(let i=0;i<total;i++){
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(src, [i]); out.addPage(copied[0]);
    outs.push({ name: prefix+'_'+(i+1)+'.pdf', bytes: await out.save() });
  }
  return outs;
}

async function mergeNormal(files){
  const out = await PDFLib.PDFDocument.create();
  for(const f of files){
    const src = await loadPdfDoc(f.ab);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p=> out.addPage(p));
  }
  return await out.save();
}

async function insertAt(mainAb, insertAb, afterPage){
  const main = await loadPdfDoc(mainAb);
  const ins  = await loadPdfDoc(insertAb);
  const out  = await PDFLib.PDFDocument.create();
  const N = main.getPageCount();

  const beforeIdx = Array.from({length: Math.max(0, Math.min(afterPage, N))}, (_,i)=> i);
  const afterIdx  = Array.from({length: Math.max(0, N-afterPage)}, (_,i)=> afterPage+i);

  const before = await out.copyPages(main, beforeIdx); before.forEach(p=> out.addPage(p));
  const insP   = await out.copyPages(ins, ins.getPageIndices()); insP.forEach(p=> out.addPage(p));
  const after  = await out.copyPages(main, afterIdx); after.forEach(p=> out.addPage(p));

  return await out.save();
}

async function insertAfterRange(mainAb, insertAb, start, end){
  const main = await loadPdfDoc(mainAb);
  const N = main.getPageCount();
  if(start<1 || end<start || end>N) throw new Error('Range harus 1..'+N);

  const out = await PDFLib.PDFDocument.create();

  const before = await out.copyPages(main, Array.from({length:start-1}, (_,i)=> i));
  before.forEach(p=> out.addPage(p));

  const keep   = await out.copyPages(main, Array.from({length:end-start+1}, (_,i)=> start-1+i));
  keep.forEach(p=> out.addPage(p));

  const ins    = await PDFLib.PDFDocument.load(insertAb);
  const insP   = await out.copyPages(ins, ins.getPageIndices());
  insP.forEach(p=> out.addPage(p));

  const after  = await out.copyPages(main, Array.from({length: N-end}, (_,i)=> end+i));
  after.forEach(p=> out.addPage(p));

  return await out.save();
}

// ========== Compression (PDF.js -> canvas -> jsPDF) ==========
const CMP = {
  extreme: { scale: 1.2, quality: 0.65 },
  medium:  { scale: 1.7, quality: 0.78 },
  kecil:   { scale: 2.2, quality: 0.90 }
};
async function compressViaRaster(ab, level){
  const jsPDFNS = window.jspdf;
  const cfg = CMP[level] || CMP.medium;
  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js';

  const loadingTask = pdfjsLib.getDocument({ data: ab });
  const pdf = await loadingTask.promise;

  let doc = null;
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: cfg.scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', cfg.quality);
    const ptW = vp.width * 72/96, ptH = vp.height * 72/96;

    if(!doc){ doc = new jsPDFNS.jsPDF({ unit:'pt', format:[ptW, ptH] }); }
    else { doc.addPage([ptW, ptH]); }

    doc.addImage(dataUrl, 'JPEG', 0, 0, ptW, ptH, undefined, 'FAST');
  }
  return doc.output('arraybuffer');
}

// ========== Download helper ==========
function saveBytes(bytes, name){
  const blob = new Blob([bytes], {type:'application/pdf'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 5000);
}

// ========== Run ==========
$('#runBtn').onclick = async ()=>{
  try{
    $('#runBtn').disabled = true;

    if(MODE==='split'){
      if(fileState.length!==1) throw new Error('Butuh tepat 1 file di daftar File.');
      const f = fileState[0];
      const scenario = $('#splitScenario').value;

      if(scenario==='one'){
        const p = parseInt($('#splitPage').value||''); if(!p) throw new Error('Isi halaman.');
        log('Split: ambil halaman '+p+' dari '+f.name);
        const bytes = await splitOne(f.ab, p);
        saveBytes(bytes, f.name.replace(/\.pdf$/i,'')+'_p'+p+'.pdf');

      } else if(scenario==='range'){
        const s = parseInt($('#splitStart').value||''); const e = parseInt($('#splitEnd').value||'');
        if(!s) throw new Error('Start wajib diisi. End boleh kosong.');
        log('Split: '+s+'-'+(e||'end')+' dari '+f.name);
        const bytes = await splitRange(f.ab, s, e || 1e9);
        saveBytes(bytes, f.name.replace(/\.pdf$/i,'')+'_'+s+'-'+(e||'end')+'.pdf');

      } else if(scenario==='multi'){
        const spec = $('#splitSpec').value.trim(); if(!spec) throw new Error('Masukkan multi seleksi.');
        log('Split multi: '+spec);
        const outs = await splitMulti(f.ab, spec);
        outs.forEach(o=> saveBytes(o.bytes, f.name.replace(/\.pdf$/i,'')+'_'+o.name));

      } else if(scenario==='one_plus_rest'){
        const p = parseInt($('#splitPage').value||''); if(!p) throw new Error('Isi halaman.');
        log('Split: only p'+p+' + sisanya dari '+f.name);
        const one = await splitOne(f.ab, p);
        saveBytes(one, f.name.replace(/\.pdf$/i,'')+'_only_p'+p+'.pdf');

        const src = await loadPdfDoc(f.ab); const N = src.getPageCount();
        const keep = Array.from({length:N}, (_,i)=> i).filter(i=> i!==p-1);
        const out = await PDFLib.PDFDocument.create();
        const pages = await out.copyPages(src, keep);
        pages.forEach(pg=> out.addPage(pg));
        saveBytes(await out.save(), f.name.replace(/\.pdf$/i,'')+'_except_p'+p+'.pdf');

      } else if(scenario==='all'){
        const prefix = ($('#splitPrefix').value||'page').trim();
        log('Split semua halaman: prefix="'+prefix+'"');
        const outs = await splitAll(f.ab, prefix);
        outs.forEach(o=> saveBytes(o.bytes, o.name));
      }
      log('Selesai split.');

    } else if(MODE==='merge'){
      if(fileState.length<2) throw new Error('Butuh >= 2 file untuk merge.');
      const outName = ($('#mergeName').value||'merged.pdf').trim();
      log('Merge normal: '+fileState.length+' file → '+outName);
      const bytes = await mergeNormal(fileState);
      saveBytes(bytes, outName);
      log('Merged.');

    } else if(MODE==='insert'){
      if(fileState.length!==2) throw new Error('Gunakan tepat 2 file (1=utama, 2=selipan).');
      const mainF = fileState[0]; const insF = fileState[1];
      const pos = $('#insertPos').value;
      const outName = ($('#insertName').value||'merged_insert.pdf').trim();
      const mainDoc = await loadPdfDoc(mainF.ab); const N = mainDoc.getPageCount();
      let bytes;

      if(pos==='start'){
        log('Insert: di awal');
        bytes = await insertAt(mainF.ab, insF.ab, 0);
      } else if(pos==='end'){
        log('Insert: di akhir');
        bytes = await insertAt(mainF.ab, insF.ab, N);
      } else if(pos==='afterN'){
        const k = parseInt($('#insertN').value||'');
        if(isNaN(k) || k<0 || k>N) throw new Error('N harus 0..'+N);
        log('Insert: setelah halaman '+k);
        bytes = await insertAt(mainF.ab, insF.ab, k);
      } else if(pos==='afterRange'){
        const bits = ($('#insertRange').value||'').split('-');
        const s = parseInt(bits[0],10); const e = parseInt(bits[1],10);
        if(!s || !e) throw new Error('Isi start-end, contoh 3-10');
        log('Insert: setelah rentang '+s+'-'+e);
        bytes = await insertAfterRange(mainF.ab, insF.ab, s, e);
      }
      saveBytes(bytes, outName);
      log('Insert done.');

    } else if(MODE==='compress'){
      if(fileState.length!==1) throw new Error('Pilih tepat 1 file untuk compress.');
      const f = fileState[0];
      const lvl = $('#cmpLevel').value;
      const name = ($('#cmpName').value||'compressed.pdf').trim();
      log('Compress (rasterize) level='+lvl+' ...');
      const t0 = performance.now();
      const bytes = await compressViaRaster(f.ab, lvl);
      const t1 = performance.now();
      saveBytes(bytes, name);
      log('Compressed → '+name+' ('+((t1-t0)/1000).toFixed(1)+'s)');
    }
  } catch (err){
    console.error(err);
    log('Error: '+(err && err.message ? err.message : String(err)));
  } finally {
    $('#runBtn').disabled = false;
  }
};

// ========== Init ==========
buildPanel();
log('Siap. Pilih mode, tambahkan file, lalu Jalankan.');
