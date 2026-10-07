/* PRESENTACIÓN DE TESIS · v5 · Un solo recorrido, ordenado por el guion.
 * Textos visibles y notas: index.html | Diseño: styles.css
 * Fuentes y anexos: fuentes.js | Figuras y editables: figuras.js / assets
 * No utiliza bibliotecas, peticiones de red ni almacenamiento de datos personales.
 */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const slides = $$('#presentation > .slide');
  if (!slides.length) return;
  const SOURCES = window.TESIS_SOURCES || {};
  const ANNEXES = window.TESIS_ANNEXES || {};
  const figures = window.TESIS_FIGURES || [];
  const panel = $('#panel-dialog');
  const figureDialog = $('#figure-dialog');
  let active = 0, isReading = false, zoom = 1, currentFigure = null;
  let focusBeforeDialog = null, toastTimer = null, readingFrame = null;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = slide => slide.querySelector('h2')?.textContent || '';
  const groups = [...new Set(slides.map(s => s.dataset.block))].map(n => ({
    number:n, title:slides.find(s=>s.dataset.block===n).dataset.blockTitle,
    slides:slides.filter(s=>s.dataset.block===n)
  }));

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800);
  }
  function resize() {
    if (!isReading) {
      const r = $('#presentation').getBoundingClientRect();
      document.documentElement.style.setProperty('--scale', String(Math.max(.12, Math.min((r.width-24)/1280,(r.height-20)/720))));
    }
    if (figureDialog.open && currentFigure) fitFigure();
  }
  function updateCounters() {
    $('#counter').textContent = `${String(active+1).padStart(2,'0')} / ${slides.length}`;
    $('#progress').style.width = `${(active+1)/slides.length*100}%`;
    $('#prev-btn').disabled = active === 0;
    $('#next-btn').disabled = active === slides.length-1;
    $('#announcement').textContent = `Bloque ${slides[active].dataset.block} de 11. Diapositiva ${active+1} de ${slides.length}. ${title(slides[active])}`;
  }
  function show(index, changeHash=true, scroll=true) {
    active=Math.max(0,Math.min(slides.length-1,index));
    slides.forEach((slide,i) => {
      slide.classList.toggle('is-active',i===active);
      slide.inert=!isReading && i!==active;
      slide.setAttribute('aria-hidden',String(!isReading && i!==active));
    });
    updateCounters();
    if (changeHash && location.hash!==`#${slides[active].id}`) {
      try { history.replaceState(null,'',`#${slides[active].id}`); }
      catch { location.hash=slides[active].id; }
    }
    if (isReading && scroll) slides[active].scrollIntoView({behavior:'auto',block:'start'});
  }
  function goTo(id) {
    const index=slides.findIndex(slide=>slide.id===id);
    if(index>=0) show(index);
  }
  function setReading(value) {
    isReading=Boolean(value);
    document.body.classList.toggle('reading',isReading);
    $('#reading-btn').textContent=isReading?'Diapositivas':'Lectura';
    $('#reading-btn').setAttribute('aria-pressed',String(isReading));
    show(active,false,isReading);resize();
  }
  function closeDialogs() {
    if(panel.open) panel.close();
    if(figureDialog.open) figureDialog.close();
  }
  function openPanel(heading,content) {
    const focus=document.activeElement;
    if(figureDialog.open) figureDialog.close();
    if(!panel.open) focusBeforeDialog=focus;
    $('#panel-title').textContent=heading;
    $('#panel-content').innerHTML=content;
    if(!panel.open) panel.showModal();
    $('#panel-content').scrollTop=0;
    panel.querySelector('.close-dialog').focus({preventScroll:true});
  }
  function overview() {
    openPanel('Índice · once bloques del guion',
      `<p class="small-print">${slides.length} diapositivas en un único recorrido. Los materiales de consulta no añaden diapositivas a la exposición.</p><div class="block-index">`+
      groups.map(g=>`<section><h3>${esc(g.number.padStart(2,'0'))}. ${esc(g.title)}</h3><div class="block-slides">${g.slides.map(s=>`<button data-goto="${esc(s.id)}" class="${slides.indexOf(s)===active?'active':''}"><span>DIAPOSITIVA ${slides.indexOf(s)+1}</span>${esc(title(s))}</button>`).join('')}</div></section>`).join('')+'</div>');
  }
  function notes() {
    const slide=slides[active];
    openPanel(`Guion · ${title(slide)}`,
      '<p class="notes-warning">Las notas se muestran en esta misma pantalla. No son una ventana privada del presentador.</p>'+
      (slide.querySelector('.speaker-notes')?.innerHTML||'<p>No hay notas en esta diapositiva.</p>'));
  }
  function fullScript() {
    openPanel('Guion oral completo · once bloques',
      '<p class="notes-warning">Texto para ensayo. Se muestra en esta pantalla; cerrá el panel antes de proyectar.</p>'+
      groups.map(g=>`<section class="script-block"><h3>${esc(g.number)}. ${esc(g.title)}</h3>${g.slides.map(s=>s.querySelector('.oral-script')?.innerHTML||'').join('')}<button class="text-button" data-goto="${esc(g.slides[0].id)}">Ir a este bloque</button></section>`).join(''));
  }
  function sources(all=false) {
    const keys=all?Object.keys(SOURCES):(slides[active].dataset.sources||'').split(',').filter(Boolean);
    const markup=keys.filter(k=>SOURCES[k]).map(k=>{
      const s=SOURCES[k];
      return `<article class="source-item"><h3><span class="source-key">${esc(k)}</span>${esc(s.title)}</h3><p>${esc(s.text)}</p><small>${esc(s.note||'')}</small>${s.url?`<p class="source-link"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Referencia editorial ↗</a></p>`:''}</article>`;
    }).join('');
    openPanel(all?'Fuentes y documentos de referencia':`Fuentes · ${title(slides[active])}`, markup+(!all?'<p style="margin-top:22px"><button data-open="sources">Ver todas las referencias</button></p>':''));
  }
  function annexes(number=null) {
    const entries=number && ANNEXES[number]?[[number,ANNEXES[number]]]:Object.entries(ANNEXES);
    const cards=entries.map(([n,a])=>`<article class="annex-card"><b>Anexo ${esc(n)}</b><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><small>${esc(a.support)}</small></article>`).join('');
    openPanel(number?`Referencia al Anexo ${number}`:'Mapa de anexos del guion',
      '<p class="small-print">Mapa de consulta. Las denominaciones son descriptivas y no sustituyen los títulos del documento. Los archivos de los anexos y los registros internos no se incorporan a este paquete.</p><div class="annex-grid">'+cards+'</div>'+(number?'<p style="margin-top:22px"><button data-open="annexes">Ver el mapa completo</button></p>':''));
  }
  function atlas() {
    openPanel('Figuras estructurantes del documento',
      '<p class="small-print">Se conservan las ocho figuras de la versión anterior, con sus títulos y archivos editables. Su consulta es opcional.</p><div class="figure-atlas atlas-modal">'+figures.map(f=>`<button class="atlas-item" data-figure="${f.n}"><img src="${esc(f.src)}" alt="${esc(f.description)}"/><strong>Figura ${f.n}</strong><span>${esc(f.title)}</span></button>`).join('')+'</div>');
  }
  function fitFigure() {
    const img=$('#modal-figure'), viewport=$('.figure-viewport');
    if(!img.naturalWidth||!img.naturalHeight) return;
    const fit=Math.min((viewport.clientWidth-44)/img.naturalWidth,(viewport.clientHeight-44)/img.naturalHeight);
    img.style.width=`${Math.max(1,img.naturalWidth*fit*zoom)}px`;
    img.style.height='auto';
    $('#zoom-value').textContent=`${Math.round(zoom*100)} %`;
  }
  function openFigure(n) {
    const f=figures.find(item=>item.n===Number(n));
    if(!f){toast('La figura no está disponible en este catálogo.');return;}
    const focus=document.activeElement;
    if(panel.open) panel.close();
    focusBeforeDialog=focus;
    currentFigure=f;zoom=1;
    $('#figure-title').textContent=`Figura ${f.n}. ${f.title}`;
    const img=$('#modal-figure');
    img.alt=f.description;img.onload=fitFigure;
    img.onerror=()=>toast('No se pudo cargar la figura. Conservá la carpeta assets junto al HTML.');
    img.src=f.src;
    $('#figure-svg-link').href=f.src;
    $('#figure-drawio-link').href=f.editable;
    $('#figure-drawio-link').download=f.n<=4?'figuras-1-4.drawio':'figuras-5-8.drawio';
    $('#figure-note').innerHTML=`<p>${esc(f.note||f.description)}</p><span>Procedencia: ${esc(f.source)}</span>`;
    if(!figureDialog.open) figureDialog.showModal();
    figureDialog.querySelector('.close-dialog').focus({preventScroll:true});
    requestAnimationFrame(fitFigure);
  }
  async function fullscreen() {
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('Utilizá la pantalla completa del navegador.');
    } catch {toast('Utilizá F11 o la pantalla completa del navegador.');}
  }
  $('#prev-btn').addEventListener('click',()=>show(active-1));
  $('#next-btn').addEventListener('click',()=>show(active+1));
  $('#overview-btn').addEventListener('click',overview);
  $('#figures-btn').addEventListener('click',atlas);
  $('#annexes-btn').addEventListener('click',()=>annexes());
  $('#sources-btn').addEventListener('click',()=>sources());
  $('#notes-btn').addEventListener('click',notes);
  $('#script-btn').addEventListener('click',fullScript);
  $('#reading-btn').addEventListener('click',()=>setReading(!isReading));
  $('#fullscreen-btn').addEventListener('click',fullscreen);
  $('#zoom-in').addEventListener('click',()=>{zoom=Math.min(5,zoom+.25);fitFigure();});
  $('#zoom-out').addEventListener('click',()=>{zoom=Math.max(.5,zoom-.25);fitFigure();});
  $('#zoom-fit').addEventListener('click',()=>{zoom=1;fitFigure();});

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target) return;
    const goto=target.closest('[data-goto]');
    if(goto){closeDialogs();goTo(goto.dataset.goto);return;}
    const figure=target.closest('[data-figure]');
    if(figure){openFigure(figure.dataset.figure);return;}
    const annex=target.closest('[data-annex]');
    if(annex){annexes(annex.dataset.annex);return;}
    const opener=target.closest('[data-open]');
    if(opener){if(opener.dataset.open==='sources')sources(true);else if(opener.dataset.open==='annexes')annexes();return;}
    const close=target.closest('.close-dialog');
    if(close)close.closest('dialog').close();
  });
  [panel,figureDialog].forEach(dialog=>{
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
    });
    dialog.addEventListener('close',()=>{
      if(focusBeforeDialog && document.contains(focusBeforeDialog) && !focusBeforeDialog.closest('[aria-hidden="true"]'))focusBeforeDialog.focus({preventScroll:true});
    });
  });
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||panel.open||figureDialog.open)return;
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('input,textarea,select,[contenteditable="true"]'))return;
    const key=event.key.toLowerCase();
    if(['arrowright','pagedown'].includes(key)||(key===' '&&!target?.closest('button,a,summary'))){event.preventDefault();show(active+1);}
    else if(['arrowleft','pageup'].includes(key)){event.preventDefault();show(active-1);}
    else if(key==='home'){event.preventDefault();show(0);}
    else if(key==='end'){event.preventDefault();show(slides.length-1);}
    else if(key==='o'){event.preventDefault();overview();}
    else if(key==='g'){event.preventDefault();atlas();}
    else if(key==='a'){event.preventDefault();annexes();}
    else if(key==='r'){event.preventDefault();sources();}
    else if(key==='n'){event.preventDefault();notes();}
    else if(key==='h'){event.preventDefault();fullScript();}
    else if(key==='f'){event.preventDefault();fullscreen();}
    else if(key==='l'){event.preventDefault();setReading(!isReading);}
  });
  let touchX=0,touchY=0;
  $('#presentation').addEventListener('touchstart',e=>{
    if(e.touches.length===1){touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;}
  },{passive:true});
  $('#presentation').addEventListener('touchend',e=>{
    if(isReading||panel.open||figureDialog.open||!e.changedTouches.length)return;
    const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;
    if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.6)show(active+(dx<0?1:-1));
  },{passive:true});
  // Keep notes and references associated with the visible slide in continuous reading.
  window.addEventListener('scroll',()=>{
    if(!isReading||readingFrame!==null)return;
    readingFrame=requestAnimationFrame(()=>{
      readingFrame=null;
      if(panel.open||figureDialog.open)return;
      const baseline=window.innerHeight*.33;
      let best=0,bestDistance=Infinity;
      slides.forEach((s,i)=>{
        const r=s.getBoundingClientRect();
        const distance=r.top<=baseline&&r.bottom>=baseline?0:Math.min(Math.abs(r.top-baseline),Math.abs(r.bottom-baseline));
        if(distance<bestDistance){best=i;bestDistance=distance;}
      });
      if(best!==active)show(best,false,false);
    });
  },{passive:true});
  window.addEventListener('resize',resize);
  document.addEventListener('fullscreenchange',resize);
  window.addEventListener('hashchange',()=>{try{goTo(decodeURIComponent(location.hash.slice(1)));}catch{}});
  document.body.classList.add('js-ready');
  isReading=window.innerWidth<700||new URLSearchParams(location.search).has('lectura');
  document.body.classList.toggle('reading',isReading);
  $('#reading-btn').textContent=isReading?'Diapositivas':'Lectura';
  $('#reading-btn').setAttribute('aria-pressed',String(isReading));
  let initial=-1;
  try{initial=slides.findIndex(s=>s.id===decodeURIComponent(location.hash.slice(1)));}catch{}
  show(initial>=0?initial:0,false,false);resize();
  window.TESIS_DECK={next:()=>show(active+1),prev:()=>show(active-1),goTo,setReading,openFigure,
    overview,notes,fullScript,annexes,sources,atlas,
    getState:()=>({active:active+1,total:slides.length,block:Number(slides[active].dataset.block),reading:isReading})};
})();
