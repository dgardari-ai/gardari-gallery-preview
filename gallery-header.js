/* GARDARI_TABLET_1_2_0: portrait-only tablet adaptation; landscape uses desktop. */
(() => {
  const root = document.documentElement;
  const phone = matchMedia('(max-width: 600px)');
  const portrait = matchMedia('(min-width: 601px) and (max-width: 1100px) and (orientation: portrait)');
  const touch = matchMedia('(any-pointer: coarse)');
  const changes = new EventTarget();
  let active = false;
  function reviewTablet() {
    try {
      // The existing editor's four device controls already size and label this shell.
      const editorFrame = frameElement;
      if (editorFrame && ['preview', 'compare-preview'].includes(editorFrame.id))
        return !!editorFrame.closest('.device-shell.is-tablet');
      if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))
        return !!frameElement?.closest('#tablet') || new URLSearchParams(location.search).get('tablet_preview') === '1';
    } catch {}
    return false;
  }
  const compactMedia = {
    get matches() { return phone.matches || active; },
    addEventListener: (...args) => changes.addEventListener(...args),
    removeEventListener: (...args) => changes.removeEventListener(...args)
  };
  window.GalleryTablet = {get active() { return active; }, compactMedia};
  function sync() {
    const next = portrait.matches && (touch.matches || reviewTablet());
    const changed = next !== active;
    active = next;
    root.classList.toggle('gallery-tablet-portrait', active);
    if (changed) changes.dispatchEvent(new Event('change'));
  }
  phone.addEventListener('change', () => { sync(); changes.dispatchEvent(new Event('change')); });
  portrait.addEventListener('change', sync);
  touch.addEventListener('change', sync);
  addEventListener('resize', sync);
  sync();
})();

/* Shared header: the homepage and Gallery section use the same saved settings. */
(()=>{
  "use strict";
  const $=s=>document.querySelector(s);
  const {value,number}=window.GalleryCustomization;
  const editorFrame=new URLSearchParams(location.search).has('editor_view') || (['preview','compare-preview'].includes(frameElement?.id) && !!frameElement.closest('.device-shell'));
  const releaseKey=!editorFrame&&document.currentScript?.src?new URL(document.currentScript.src,location.href).searchParams.get('v'):null;
  function pageHref(file){if(editorFrame){const url=new URL(file,location.href);url.searchParams.set('editor_view',new URLSearchParams(location.search).get('editor_view')||String(Date.now()));return url.href;}if(!releaseKey)return file;const url=new URL(file,location.href);url.searchParams.set('v',releaseKey);return url.href;}
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
      const height=header.getBoundingClientRect().height,gap=window.GalleryTablet.active ? 32 : number('header:matrixGap',33);
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
  const pages={home:"index.html",gallery:"gallery.html",painting:"painting.html",digital:"digital.html",glass:"glass.html",artist:"artist.html",contacts:"contacts.html"};
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

  if(releaseKey||editorFrame){const brand=document.querySelector('.brand-pill');if(brand)brand.href=pageHref(pages.home);}

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

/* GARDARI_MOBILE_1_1_0 */
(() => {
function installPhoneLayout() {
/* Review-only geometry; the installed Gallery and its authored settings stay intact. */
(() => {
  'use strict';
  const pack = document.querySelector('#matrix-pack');
  if (!pack) return;
  const root = document.documentElement;
  let lastSize = null;
  function sync() {
    const gap = parseFloat(getComputedStyle(root).getPropertyValue('--phone-menu-gap')) || 0;
    const columns = window.GalleryTablet.active ? 8 : 4;
    const size = (pack.getBoundingClientRect().width - (columns - 1) * gap) / columns;
    if (size <= 0 || size === lastSize) return;
    lastSize = size;
    root.style.setProperty('--phone-menu-tile', size + 'px');
    window.GalleryHeaderMotion?.update();
  }
  new ResizeObserver(sync).observe(pack);
  sync();
})();

/* Text actions, menu labels and purchase actions: phone-only type scaling. */
(() => {
  const media = window.GalleryTablet.compactMedia;
  const selector = '.gallery-action-button,.drawer-buy,.drawer-next,.section-disclosure summary,.filter-btn,.tab-name,.tab-number';
  const originals = new Map();
  function update() {
    if (!media.matches) {
      for (const [node, base] of originals) {
        for (const [property, value, priority] of base.inline) {
          if (value) node.style.setProperty(property, value, priority);
          else node.style.removeProperty(property);
        }
      }
      originals.clear(); return;
    }
    for (const node of document.querySelectorAll(selector)) {
      if (originals.has(node)) continue;
      const size = node.matches('.tab-name,.tab-number') ? Math.min(11, Math.max(9, innerWidth * .028)) : parseFloat(getComputedStyle(node).fontSize);
      originals.set(node, {inline: ['font-size','font-weight'].map(property => [property,node.style.getPropertyValue(property),node.style.getPropertyPriority(property)])});
      node.style.setProperty('font-size', size * 1.15 + 'px', 'important');
      node.style.setProperty('font-weight', '700', 'important');
      node.dataset.phoneButtonBaseSize = String(size);
    }
  }
  new MutationObserver(update).observe(document.body, {childList: true, subtree: true});
  media.addEventListener('change', update);
  update();
})();

/* Move the existing photo nodes, retaining their sources, crops and handlers.
   Above the phone breakpoint the original DOM is restored in place. */
(() => {
function installPhoneContent() {
  'use strict';
  if (document.body.dataset.page === 'home' || !document.querySelector('#gallery-layout')) return;
  const media = window.GalleryTablet.compactMedia;
  const weight = '3';
  const strokes = {'0': 0, '1': .3, '2': .65, '3': 1};
  const stroke = strokes[weight] || 0;
  document.documentElement.style.setProperty('--phone-title-stroke', stroke + 'px');
  const layout = document.querySelector('#gallery-layout');
  const firstCard = layout.querySelector('.gallery-case');
  if (!firstCard || firstCard.dataset.phoneLayoutBound === 'true') return;
  layout.phoneLayoutCleanup?.();
  firstCard.dataset.phoneLayoutBound = 'true';
  const pairs = [...layout.querySelectorAll('.gallery-case')].map(card => {
    const id = card.dataset.gallerySection;
    const panel = layout.querySelector(`[data-gallery-panel="${id}"]`);
    const frame = panel.querySelector('[data-gallery-frame]');
    const marker = document.createComment('Original photo position: ' + id);
    panel.before(marker);
    const heading = card.querySelector('.gallery-case-heading > span');
    return {card, panel, frame, marker, heading, originalRows: [...heading.childNodes]};
  });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {willReadFrequently: true});
  let typographyFrame = 0;
  const titleBases = new WeakMap();
  function fontOf(style) {
    return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  }
  function lineInk(line) {
    const style = getComputedStyle(line);
    context.font = fontOf(style);
    const text = style.textTransform === 'uppercase' ? line.textContent.toLocaleUpperCase('ru-RU') : line.textContent;
    const metrics = context.measureText(text.trim());
    let baseline = line.querySelector('[data-phone-baseline]');
    if (!baseline) {
      baseline = document.createElement('span');
      baseline.dataset.phoneBaseline = '';
      baseline.setAttribute('aria-hidden', 'true');
      baseline.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;margin:0;padding:0;border:0';
      line.append(baseline);
    }
    line.dataset.phoneInkAscent = String(metrics.actualBoundingBoxAscent);
    line.dataset.phoneInkDescent = String(metrics.actualBoundingBoxDescent);
    const y = baseline.getBoundingClientRect().top;
    return {top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent};
  }
  // Tablet titles fit the actual working field; every physical line keeps its yellow fill.
  function measureTabletTypography() {
    const setFill = (line, name, value) => {
      if (line.style.getPropertyValue(name) !== value) line.style.setProperty(name, value);
    };
    pairs.forEach(({card, heading, originalRows}) => {
      const title = card.querySelector('h2');
      if (!titleBases.has(title)) titleBases.set(title, {
        fontValue: title.style.getPropertyValue('font-size'), fontPriority: title.style.getPropertyPriority('font-size'),
        lineValue: title.style.getPropertyValue('line-height'), linePriority: title.style.getPropertyPriority('line-height')
      });
      const base = titleBases.get(title);
      if (!base.tabletMeasured) {
        for (const [property, value, priority] of [['font-size', base.fontValue, base.fontPriority], ['line-height', base.lineValue, base.linePriority]]) {
          if (value) title.style.setProperty(property, value, priority); else title.style.removeProperty(property);
        }
        const native = getComputedStyle(title);
        base.tabletNativeSize = parseFloat(native.fontSize) || 30;
        base.tabletNativeLineHeight = parseFloat(native.lineHeight) || 32;
      }
      base.tabletMeasured = true;
      const tabletSize = base.tabletNativeSize * 4 / 3;
      if (title.style.getPropertyValue('font-size') !== tabletSize + 'px') title.style.setProperty('font-size', tabletSize + 'px', 'important');
      const tabletLineHeight = tabletSize * 1.1 * base.tabletNativeLineHeight / 32;
      if (title.style.getPropertyValue('line-height') !== tabletLineHeight + 'px') title.style.setProperty('line-height', tabletLineHeight + 'px', 'important');
      const style = getComputedStyle(title);
      context.font = fontOf(style);
      const tracking = parseFloat(style.letterSpacing) || 0;
      const limit = title.clientWidth - 42;
      const text = originalRows.map(node => node.textContent).join('').trim().replace(/\s+/g, ' ');
      const rows = [];
      let row = '';
      for (const word of text.split(' ')) {
        const next = row ? row + ' ' + word : word;
        const width = context.measureText(next.toLocaleUpperCase('ru-RU')).width + (next.length - 1) * tracking;
        if (row && width > limit) { rows.push(row); row = word; }
        else row = next;
      }
      if (row) rows.push(row);
      const old = [...heading.querySelectorAll('.gallery-heading-line')].map(line => line.firstChild?.textContent || '');
      if (JSON.stringify(old) !== JSON.stringify(rows)) heading.replaceChildren(...rows.map(text => {
        const line = document.createElement('span');
        line.className = 'gallery-heading-line'; line.textContent = text; return line;
      }));
      heading.querySelectorAll('.gallery-heading-line').forEach(line => {
        lineInk(line);
        context.font = fontOf(getComputedStyle(line));
        const letter = context.measureText('Н');
        const range = document.createRange();
        range.selectNodeContents(line.firstChild);
        const textRect = range.getBoundingClientRect(), rect = line.getBoundingClientRect();
        const baseline = line.querySelector('[data-phone-baseline]').getBoundingClientRect().top;
        setFill(line, '--phone-fill-left', (textRect.right - rect.left + 12) + 'px');
        setFill(line, '--phone-fill-top', (baseline - letter.actualBoundingBoxAscent - rect.top - stroke / 2) + 'px');
        setFill(line, '--phone-fill-height', (letter.actualBoundingBoxAscent + letter.actualBoundingBoxDescent + stroke) + 'px');
      });
    });
  }

  function measureTypography() {
    typographyFrame = 0;
    if (!enabled || !context) return;
    if (window.GalleryTablet.active) { measureTabletTypography(); return; }
    // Restore the accepted phone baseline before crossing back from portrait tablet.
    pairs.forEach(({card, heading, originalRows}) => {
      const title = card.querySelector('h2'), base = titleBases.get(title);
      if (!base?.tabletMeasured) return;
      heading.replaceChildren(...originalRows);
      for (const [property, value, priority] of [['font-size', base.fontValue, base.fontPriority], ['line-height', base.lineValue, base.linePriority]]) {
        if (value) title.style.setProperty(property, value, priority); else title.style.removeProperty(property);
      }
      delete card.querySelector('.gallery-case-header').dataset.phoneRowsFitted;
      titleBases.delete(title);
    });
    pairs.forEach(({card}) => {
      const header = card.querySelector('.gallery-case-header');
      const title = header.querySelector('h2');
      const lines = [...header.querySelectorAll('.gallery-heading-line')].filter(n => n.textContent.trim());
      if (!header.dataset.phoneRowsFitted && lines.length) {
        const style = getComputedStyle(lines[0]);
        context.font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * 1.1}px ${style.fontFamily}`;
        const tracking = (parseFloat(style.letterSpacing) || 0) * 1.1;
        const limit = title.clientWidth - 15;
        const rows = [];
        for (const line of lines) {
          let row = '';
          for (const word of line.textContent.trim().split(/\s+/)) {
            const next = row ? row + ' ' + word : word;
            const width = context.measureText(next.toLocaleUpperCase('ru-RU')).width + (next.length - 1) * tracking;
            if (row && width > limit) { rows.push(row + ' '); row = word; }
            else row = next;
          }
          if (row) rows.push(row + (/\s$/.test(line.textContent) ? ' ' : ''));
        }
        if (rows.length > lines.length) {
          const parent = lines[0].parentElement;
          parent.replaceChildren(...rows.map(text => {const span=document.createElement('span');span.className='gallery-heading-line';span.textContent=text;return span;}));
          header.dataset.phoneRowsFitted = 'true';
          queueTypography();
          return;
        }
        header.dataset.phoneRowsFitted = 'true';
      }
      let base = titleBases.get(title);
      if (!base) {
        if (!lines.length) return;
        const first = lineInk(lines[0]), second = lines[1] ? lineInk(lines[1]) : null;
        const style = getComputedStyle(lines[0]);
        context.font = fontOf(style);
        base = {size: parseFloat(style.fontSize), gap: second ? second.top - first.bottom : Math.max(0, parseFloat(style.lineHeight) - (first.bottom - first.top)),
          fillGap: (context.measureText('Н').width + (parseFloat(style.letterSpacing) || 0)) / 2,
          fontValue: title.style.getPropertyValue('font-size'), fontPriority: title.style.getPropertyPriority('font-size'),
          lineValue: title.style.getPropertyValue('line-height'), linePriority: title.style.getPropertyPriority('line-height')};
        titleBases.set(title, base);
      }
      title.style.setProperty('font-size', (base.size * 1.1) + 'px', 'important');
      context.font = fontOf(getComputedStyle(lines[0]));
      const firstMetrics = context.measureText(lines[0].textContent.trim().toLocaleUpperCase('ru-RU'));
      const secondMetrics = context.measureText((lines[1] || lines[0]).textContent.trim().toLocaleUpperCase('ru-RU'));
      title.style.setProperty('line-height', (base.gap + firstMetrics.actualBoundingBoxDescent + secondMetrics.actualBoundingBoxAscent + stroke) + 'px', 'important');
      header.dataset.phoneBaseSize = String(base.size);
      header.dataset.phoneBaseLineGap = String(base.gap);
      lines.forEach(line => {
        lineInk(line);
        const style = getComputedStyle(line);
        context.font = fontOf(style);
        const letter = context.measureText('Н');
        const gap = base.fillGap;
        const node = [...line.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
        if (!node) return;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, node.textContent.trimEnd().length);
        const text = range.getBoundingClientRect(), row = line.getBoundingClientRect();
        const baseline = line.querySelector('[data-phone-baseline]').getBoundingClientRect().top;
        line.style.setProperty('--phone-fill-left', (text.right - row.left + gap + stroke / 2) + 'px');
        line.style.setProperty('--phone-fill-top', (baseline - letter.actualBoundingBoxAscent - row.top - stroke / 2) + 'px');
        line.style.setProperty('--phone-fill-height', (letter.actualBoundingBoxAscent + letter.actualBoundingBoxDescent + stroke) + 'px');
        line.dataset.phoneFillGap = String(gap);
      });
      header.dataset.phoneWeight = weight;
    });
  }
  function queueTypography() {
    if (!typographyFrame) typographyFrame = requestAnimationFrame(measureTypography);
  }
  const rails = [];
  function installRails() {
    if (rails.length) return;
    pairs.forEach(({panel, frame, card}) => {
      const originals = [...frame.querySelectorAll('.gallery-photo')];
      if (originals.length < 2) return;
      const rail = document.createElement('div');
      rail.className = 'phone-photo-rail';
      rail.setAttribute('aria-label', panel.getAttribute('aria-label'));
      originals.forEach(source => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'phone-photo-card';
        button.setAttribute('aria-label', 'Увеличить фотографию · ' + source.alt);
        const img = source.cloneNode();
        img.removeAttribute('aria-hidden');
        img.removeAttribute('id');
        img.removeAttribute('style');
        img.className = 'phone-rail-image';
        button.append(img);
        button.addEventListener('click', () => {
          const full = document.querySelector('#gallery-photo-full');
          full.src = source.src; full.alt = source.alt;
          document.querySelector('#gallery-photo-dialog').showModal();
        });
        rail.append(button);
      });
      rail.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        rail.scrollBy({left: (event.key === 'ArrowRight' ? 1 : -1) * rail.firstElementChild.offsetWidth, behavior: 'smooth'});
      });
      frame.before(rail);
      panel.classList.add('has-phone-rail');
      rails.push(rail);
    });
  }
  let enabled = false;
  function sync() {
    if (media.matches === enabled) return;
    enabled = media.matches;
    if (enabled) {
      pairs.forEach(({card, panel, frame, heading}) => {
        if (document.body.dataset.page === 'contacts' && heading.querySelectorAll('.gallery-heading-line').length === 1) {
          const text = heading.textContent, spaces = [...text.matchAll(/\s+/g)];
          if (spaces.length) {
            const split = spaces.reduce((best, match) => Math.abs(match.index - text.length / 2) < Math.abs(best.index - text.length / 2) ? match : best);
            const first = document.createElement('span'), second = document.createElement('span');
            first.className = second.className = 'gallery-heading-line';
            first.textContent = text.slice(0, split.index + split[0].length);
            second.textContent = text.slice(split.index + split[0].length);
            heading.replaceChildren(first, second);
          }
        }
        const rect = frame.getBoundingClientRect();
        const ratio = Number(frame.dataset.frameRatio) || rect.width / Math.max(1, rect.height) || 1;
        frame.style.setProperty('--phone-photo-ratio', String(ratio));
        if (card.dataset.gallerySection === 'artist-2') {
          const photo = frame.querySelector('.gallery-photo');
          const naturalFrame = () => {
            if (photo?.naturalWidth && photo.naturalHeight) frame.style.setProperty('--phone-photo-ratio', String(photo.naturalWidth / photo.naturalHeight));
          };
          photo?.addEventListener('load', naturalFrame);
          naturalFrame();
        }
        card.querySelector('.gallery-case-body').before(panel);
      });
      document.body.classList.add('phone-gallery-flow');
      installRails();
      queueTypography();
    } else {
      document.body.classList.remove('phone-gallery-flow');
      pairs.forEach(({panel, frame, marker, heading, originalRows}) => {
        if (document.body.dataset.page === 'contacts' || titleBases.get(heading.closest('h2'))?.tabletMeasured) heading.replaceChildren(...originalRows);
        marker.after(panel);
        frame.style.removeProperty('--phone-photo-ratio');
      });
      pairs.forEach(({card}) => {
        const title = card.querySelector('h2'), base = titleBases.get(title);
        if (!base) return;
        for (const [property, value, priority] of [['font-size', base.fontValue, base.fontPriority], ['line-height', base.lineValue, base.linePriority]]) {
          if (value) title.style.setProperty(property, value, priority);
          else title.style.removeProperty(property);
        }
        titleBases.delete(title);
      });
    }
    window.GalleryHeaderMotion?.update();
  }
  media.addEventListener('change', sync);
  const titleObserver = new ResizeObserver(queueTypography);
  pairs.forEach(({card}) => titleObserver.observe(card.querySelector('h2')));
  document.fonts?.ready.then(queueTypography);
  let contactObserver = null;
  if (document.body.dataset.page === 'contacts') {
    const groups = [...document.querySelectorAll('.gallery-block-actions')];
    const updateGaps = () => {
      if (!media.matches) return;
      groups.forEach(group => {
        const gap = (parseFloat(group.style.gap) || 11) * 2 / 3;
        const value = gap + 'px';
        if (group.style.getPropertyValue('--phone-contact-gap') !== value) group.style.setProperty('--phone-contact-gap', value);
      });
    };
    const observer = new MutationObserver(updateGaps);
    contactObserver = observer;
    groups.forEach(group => observer.observe(group, {attributes: true, attributeFilter: ['style']}));
    media.addEventListener('change', updateGaps);
    updateGaps();
  }
  const designerTypography = () => { if (window.GalleryTablet.active) queueTypography(); };
  document.addEventListener('vmg:design-rendered', designerTypography);
  layout.phoneLayoutCleanup = () => {
    document.removeEventListener('vmg:design-rendered', designerTypography);
    enabled = false;
    titleObserver.disconnect();
    contactObserver?.disconnect();
    media.removeEventListener('change', sync);
    cancelAnimationFrame(typographyFrame);
  };
  sync();
}
installPhoneContent();
addEventListener('gallery:ready', () => requestAnimationFrame(installPhoneContent));
})();

}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPhoneLayout, {once:true}); else installPhoneLayout();
})();

/* GARDARI_MOBILE_1_1_1: phone menu base matches the accepted responsive type. */

/* GARDARI_MOBILE_1_1_2: cover the real iPhone safe area; keep keyboard focus. */
(() => {
  const root = document.documentElement;
  const media = window.GalleryTablet.compactMedia;
  const viewport = document.querySelector('meta[name="viewport"]');
  const original = viewport?.getAttribute('content');
  function syncViewport() {
    if (!viewport) return;
    viewport.setAttribute('content', media.matches ? original.replace(/,?\s*viewport-fit\s*=\s*[^,]+/g, '') + ', viewport-fit=cover' : original);
  }
  syncViewport();
  media.addEventListener('change', syncViewport);
  const pointer = () => { if (media.matches) root.dataset.phoneInput = 'pointer'; };
  addEventListener('pointerdown', pointer, {capture:true, passive:true});
  addEventListener('touchstart', pointer, {capture:true, passive:true});
  addEventListener('keydown', event => {
    if (media.matches && ['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) root.dataset.phoneInput = 'keyboard';
  }, true);
})();

/* GARDARI_TABLET_1_2_1: native editor overrides retain priority over tablet defaults. */
