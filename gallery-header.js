/* Shared header: the homepage and Gallery section use the same saved settings. */
(()=>{
  "use strict";
  const $=s=>document.querySelector(s);
  const {value,number}=window.GalleryCustomization;
  const editorFrame=new URLSearchParams(location.search).has('editor_view');
  const releaseKey=!editorFrame&&document.currentScript?.src?new URL(document.currentScript.src,location.href).searchParams.get('v'):null;
  function pageHref(file){if(!releaseKey)return file;const url=new URL(file,location.href);url.searchParams.set('v',releaseKey);return url.href;}
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  let entryInteracted=false;
  for(const type of ['wheel','touchstart','pointerdown','keydown'])addEventListener(type,()=>{entryInteracted=true;},{passive:true});
  if(!editorFrame&&location.hash)history.replaceState(history.state,'',location.pathname+location.search);
  scrollTo({left:0,top:0,behavior:'instant'});
  addEventListener('pageshow',event=>{
    if(editorFrame&&!event.persisted||!event.persisted&&entryInteracted)return;
    entryInteracted=false;
    if(location.hash)history.replaceState(history.state,'',location.pathname+location.search);
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    window.GallerySection?.resetEntry();scrollTo({left:0,top:0,behavior:'instant'});window.GalleryHeaderMotion?.update();
  });
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  // Hub tangencies retained; the badge is now 31.2 base units (21.84px).
  function tileOutline(badgeSize) {
    const edge=.5, radius=11.5, size=78.666667, center=badgeSize/2;
    const notch=center+6.5+edge, sum=notch+radius;
    const join=center+Math.sqrt(sum*sum-(edge+radius-center)**2);
    const tangent={x:center+notch/sum*(join-center),y:center+notch/sum*(edge+radius-center)};
    return `M ${join} ${edge} H ${size-edge-radius} A ${radius} ${radius} 0 0 1 ${size-edge} ${edge+radius} V ${size-edge-radius} A ${radius} ${radius} 0 0 1 ${size-edge-radius} ${size-edge} H ${edge+radius} A ${radius} ${radius} 0 0 1 ${edge} ${size-edge-radius} V ${join} A ${radius} ${radius} 0 0 1 ${tangent.y} ${tangent.x} A ${notch} ${notch} 0 0 0 ${tangent.x} ${tangent.y} A ${radius} ${radius} 0 0 1 ${join} ${edge} Z`;
  }
  const page=document.body.dataset.page||"home";
  if(page!=="home") {
    document.body.classList.add("is-section-page");
    const pack=document.querySelector("#matrix-pack"),header=document.querySelector('.matrix-header'),shell=document.querySelector('.matrix-shell');
    let frame=0,lastTop=null,measured={};
    function syncSectionHeader(){
      frame=0;
      const width=pack?.getBoundingClientRect().width;
      if(width)document.documentElement.style.setProperty('--section-menu-width',width+'px');
      const height=header.getBoundingClientRect().height,gap=number('header:matrixGap',33);
      const contentTop=shell.getBoundingClientRect().top+scrollY+parseFloat(getComputedStyle(shell).paddingTop);
      const start=contentTop-gap-height,boundary=number('section:menuTop',20);
      const top=Math.max(boundary,start-scrollY);
      document.documentElement.style.setProperty('--section-menu-current-top',top+'px');
      document.documentElement.style.setProperty('--section-current-content-top',(top+height+gap)+'px');
      measured={start,top,boundary,height,gap,contentTop,rail:top+height+gap,fixedRail:boundary+height+gap};
      const color=getComputedStyle(document.body).backgroundColor,channels=color.match(/[\d.]+/g)?.map(Number)||[255,255,255];
      const alpha=channels.length>3?channels[3]:1;
      document.documentElement.style.setProperty('--section-canvas','rgb('+channels.slice(0,3).map(c=>Math.round(c*alpha+255*(1-alpha))).join(',')+')');
      if(lastTop!==top){lastTop=top;dispatchEvent(new CustomEvent('gallery:header-motion',{detail:{...measured}}));}
      return {...measured};
    }
    const queue=()=>{if(!frame)frame=requestAnimationFrame(syncSectionHeader);};
    if(pack)new ResizeObserver(queue).observe(pack);
    new ResizeObserver(queue).observe(header);
    addEventListener('resize',queue);addEventListener('scroll',queue,{passive:true});
    window.GalleryHeaderMotion={metrics:()=>({...measured}),update:syncSectionHeader};
    syncSectionHeader();document.fonts?.ready.then(queue);
  }
  const tilePath = tileOutline(Math.min(42, number("header:badgeSize",21.84) / number("header:tileSize",55.066667) * 78.666667));
  const pages={home:"index.html",gallery:"gallery.html",painting:"painting.html",digital:"digital.html",glass:"glass.html",artist:"artist.html"};
  window.GalleryNavigation={pages};
  const menuIds = ["home","gallery","painting","digital","glass","artist","contacts"];
  const sections = ["Главная", "Галерея", "Живопись", "Диджитал", "Стекло", "Художник", "Контакты"];
  $("#section-tabs").innerHTML = sections.map((originalName, index) => { const id=menuIds[index], name=value(`menu:${id}:label`,originalName); return `<button type="button" class="section-tab" data-menu="${id}" aria-label="${esc(name)}" aria-pressed="${id === page}"${pages[id]?"":" disabled"}>
    <svg class="tab-outline" viewBox="0 0 78.666667 78.666667" aria-hidden="true" focusable="false"><path d="${tilePath}"></path></svg>
    <span class="tab-number">${esc(value(`menu:${id}:number`, String(index + 1).padStart(2, "0")))}</span><span class="tab-name"${id===page ? ` style="color:${esc(value(`menu:${id}:activeColor`,"#202124"))}"` : ""}>${esc(name)}</span>
  </button>`; }).join("");
  document.querySelectorAll("[data-menu]:enabled").forEach(button=>button.addEventListener("click",()=>{
    location.href=pageHref(pages[button.dataset.menu]);
  }));

  if(releaseKey){const brand=document.querySelector('.brand-pill');if(brand)brand.href=pageHref(pages.home);}

  const header=document.querySelector('.matrix-header'),nav=document.querySelector('.section-tabs');
  const matrixFrame=document.querySelector('.matrix-frame');
  function requiredHeaderFrame(tile,gap,diameter,inset=0){
    const need=2*(menuIds.length*tile+(menuIds.length-1)*gap)+2*inset;
    // CSS rounds box geometry to subpixels; 1px prevents floor(8.9999) columns.
    return Math.ceil(need/Math.max(1,diameter))*diameter+1;
  }
  const controls=document.createElement('div');controls.className='gallery-nav-controls';controls.setAttribute('data-gallery-menu-scroll','controls');controls.hidden=true;controls.setAttribute('aria-label','Прокрутка меню');
  const arrows=[[-1,'Предыдущие разделы','M14 6 8 12 14 18'],[1,'Следующие разделы','M10 6 16 12 10 18']].map(([direction,label,path])=>{
    const button=document.createElement('button');button.type='button';button.className='gallery-nav-scroll';button.dataset.galleryMenuScroll=String(direction);button.setAttribute('aria-label',label);button.title=label;
    button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;controls.append(button);return button;
  });header.append(controls);
  function updateNavigationScroll(){
    const maximum=Math.max(0,nav.scrollWidth-nav.clientWidth);controls.hidden=maximum<=1;
    arrows[0].disabled=nav.scrollLeft<=1;arrows[1].disabled=nav.scrollLeft>=maximum-1;
  }
  // Utility arrows remain usable in an editor's select mode, like native scrollbars.
  addEventListener('pointerdown',event=>{if(event.target.closest?.('button[data-gallery-menu-scroll]'))event.stopImmediatePropagation();},true);
  addEventListener('click',event=>{
    const button=event.target.closest?.('button[data-gallery-menu-scroll]');if(!button||button.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const amount=number('header:tileSize',55.066667)+number('header:tabGap',4);
    nav.scrollBy({left:Number(button.dataset.galleryMenuScroll)*amount,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  },true);
  nav.addEventListener('scroll',updateNavigationScroll,{passive:true});
  function fitNavigationHalves(){
    const diameter=number('matrix:circleSize',107.1225),inset=page==='home'?number('header:sideInset',8.26):0;
    matrixFrame.style.setProperty('--header-min-frame-width',requiredHeaderFrame(number('header:tileSize',55.066667),number('header:tabGap',4),diameter,inset)+'px');
    const width=nav.clientWidth,tile=number('header:tileSize',55.066667),minimum=number('header:tabGap',4);
    if(width>0)header.style.setProperty('--computed-tab-gap',Math.max(minimum,(width-menuIds.length*tile)/(menuIds.length-1))+'px');
    const selected=nav.querySelector('[aria-pressed="true"]');
    if(selected){
      const box=nav.getBoundingClientRect(),item=selected.getBoundingClientRect();
      if(item.right>box.right)nav.scrollLeft+=item.right-box.right;
      else if(item.left<box.left)nav.scrollLeft-=box.left-item.left;
    }
    updateNavigationScroll();
  }
  new ResizeObserver(fitNavigationHalves).observe(header);
  new ResizeObserver(fitNavigationHalves).observe(document.querySelector('#matrix-pack'));
  addEventListener('resize',fitNavigationHalves);fitNavigationHalves();
  document.fonts?.ready.then(fitNavigationHalves);

})();

/* Approved Gallery entrance: shared header; artwork wave on Home only. */
(() => {
  'use strict';
  const root=document.documentElement, reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const gate=window.GalleryEntrance={quoteReady:false,afterReveal(callback){pendingQuote=callback;}};
  const ease='cubic-bezier(.16,1,.3,1)';
  let pendingQuote=null, shell=null, generation=0, headerAnimations=[], orbAnimations=[];
  root.classList.add('gallery-enter-pending');
  function releaseQuote(){gate.quoteReady=true;const callback=pendingQuote;pendingQuote=null;callback?.();}
  function cancel(){for(const animation of [...headerAnimations,...orbAnimations])animation.cancel();headerAnimations=[];orbAnimations=[];}
  function play(){
    const run=++generation;cancel();
    const header=document.querySelector('.matrix-header'),brand=header.querySelector('.brand-pill');
    const matrix=document.querySelector('#work-matrix');
    header.dataset.entrance=reduced.matches?'still':'entering';
    if(reduced.matches){root.classList.remove('gallery-enter-pending');if(matrix)matrix.dataset.orbEntrance='still';releaseQuote();return;}
    function animate(element,frames,duration,delay=0,curve=ease){
      const animation=element.animate(frames,{duration,delay,easing:curve,fill:'both'});
      headerAnimations.push(animation);return animation;
    }
    animate(header.querySelector('.brand-disc'),[
      {transform:'scale(.015)',opacity:1,offset:0,easing:'cubic-bezier(.3,0,.35,1)'},
      {transform:'scale(1.3)',opacity:1,offset:.65,easing:'ease-in-out'},
      {transform:'scale(1)',opacity:1,offset:1}
    ],800,0,'ease-in-out');
    animate(shell,[{width:brand.offsetHeight+'px',opacity:0,offset:0},
      {width:(brand.offsetHeight+(brand.clientWidth-brand.offsetHeight)*.08)+'px',opacity:1,offset:.12},
      {width:brand.getBoundingClientRect().width+'px',opacity:1,offset:1}],440,456);
    header.querySelectorAll('.section-tab').forEach((tab,index)=>animate(tab,[
      {opacity:0,transform:'perspective(650px) rotateX(-86deg)'},
      {opacity:1,transform:'perspective(650px) rotateX(0deg)'}
    ],420,index*90));
    const clock=animate(header.querySelector('.brand-quote'),[{visibility:'hidden'},{visibility:'hidden'}],956);
    clock.finished.then(()=>{if(run!==generation)return;clock.cancel();releaseQuote();}).catch(()=>{});
    Promise.all(headerAnimations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
      if(run!==generation)return;
      headerAnimations.forEach(animation=>animation.cancel());headerAnimations=[];header.dataset.entrance='complete';
    });
    if(matrix){
      const orbs=[...matrix.querySelectorAll(':scope > .work-orb')];
      const columns=Math.max(1,Math.round(matrix.clientWidth/(orbs[0]?.offsetWidth||1)));
      matrix.dataset.orbEntrance='entering';
      orbs.forEach((orb,index)=>orbAnimations.push(orb.animate([
        {opacity:0,scale:'.86',translate:'0 8px'},
        {opacity:1,scale:'1',translate:'0 0'}
      ],{duration:580,delay:380+Math.floor(index/columns)*110+(index%columns)*36,easing:ease,fill:'both'})));
      Promise.all(orbAnimations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{
        if(run!==generation)return;
        orbAnimations.forEach(animation=>animation.cancel());orbAnimations=[];matrix.dataset.orbEntrance='complete';
      });
    }
    root.classList.remove('gallery-enter-pending');
  }
  async function init(){
    await document.fonts.ready;
    if(document.querySelector('#work-matrix'))await window.GalleryArtwork.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await Promise.all([...document.querySelectorAll('#work-matrix img')].map(image=>image.decode().catch(()=>{})));
    const brand=document.querySelector('.brand-pill');
    root.classList.remove('gallery-enter-pending');
    const style=getComputedStyle(brand);
    shell=document.createElement('span');shell.className='gallery-brand-shell';shell.setAttribute('aria-hidden','true');
    shell.style.borderColor=style.borderTopColor;shell.style.borderWidth=style.borderTopWidth;shell.style.backgroundColor=style.backgroundColor;
    brand.prepend(shell);brand.classList.add('gallery-brand-entrance');play();
  }
  document.addEventListener('DOMContentLoaded',()=>init().catch(error=>{
    cancel();root.classList.remove('gallery-enter-pending');releaseQuote();console.error('Gallery entrance:',error);
  }),{once:true});
  addEventListener('pageshow',event=>{if(event.persisted&&shell){gate.quoteReady=false;play();}});
  reduced.addEventListener('change',()=>{if(reduced.matches){++generation;cancel();root.classList.remove('gallery-enter-pending');releaseQuote();}});
})();
