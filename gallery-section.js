/* Shared fully open text/photo pairs with reversible native scroll layering. */
(() => {
  'use strict';
  const $=selector=>document.querySelector(selector),data=window.GARDARI_GALLERY_SECTION;
  if(!data?.slides?.length)return;
  const {value,number}=window.GalleryCustomization;
  const knownImages=new Map(data.slides.flatMap(slide=>slide.images).map(image=>[image.src,image]));
  const slides=data.slides.map(slide=>({...slide,
    title:value(`gallery:${slide.id}:title`,slide.title),
    paragraphs:value(`gallery:${slide.id}:paragraphs`,slide.paragraphs),
    images:value(`gallery:${slide.id}:photoOrder`,slide.images.map((_,index)=>index)).map(slot=>{
      const image=slide.images[slot]||slide.images[0]||{src:'',alt:'',width:1,height:1};
      const src=value(`gallery:${slide.id}:image:${slot}`,image.src),chosen=knownImages.get(src)||image;
      return {...image,...chosen,slot,src,alt:value(`gallery:${slide.id}:alt:${slot}`,image.alt),
        crop:{zoom:number(`gallery:${slide.id}:zoom:${slot}`,image.crop?.zoom??100),x:number(`gallery:${slide.id}:x:${slot}`,image.crop?.x??0),y:number(`gallery:${slide.id}:y:${slot}`,image.crop?.y??0),aspect:value(`gallery:${slide.id}:aspect:${slot}`,image.aspect||'original')},
        frame:{width:number(`gallery:${slide.id}:frameWidth:0`,0),height:number(`gallery:${slide.id}:frameHeight:0`,0),x:number(`gallery:${slide.id}:frameX:0`,0),y:number(`gallery:${slide.id}:frameY:0`,0)}};
    })}));
  const layout=$('#gallery-layout'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const esc=text=>String(text??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  let active=0,photoIndex=slides.map(()=>0);
  let mode='flow',scrollFrame=0,layoutFrame=0,desired=null,desiredTimer=null,editing=false,restored=false,configuring=false;
  const previews=new Map(),headerOffsets=[],rowHeights=[];let pendingMatrixOrder=null;
  const arrow=direction=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${direction<0?'M14 6 8 12 14 18':'M10 6 16 12 10 18'}"></path></svg>`;
  function paragraphMarkup(slide,paragraph,index){
    const text=String(paragraph ?? ''),lines=text.split(/\r?\n/);
    const sizeLine=/^\s*(?:[-\u2013\u2014]+\s*)?\d+\s*[x\u0445\u00d7]\s*\d+\s*\u0441\u043c\s*$/i;
    const first=slide.id==='digital-2'?lines.findIndex(line=>sizeLine.test(line)):-1;
    const format=first>0&&lines.slice(first).filter(line=>line.trim()).every(line=>sizeLine.test(line));
    const html=format?`<span class="gallery-format-label">${esc(lines.slice(0,first).join('\n'))}</span>\n<span class="gallery-format-values">${lines.slice(first).map(line=>{const bullet=line.match(/^(\s*[-\u2013\u2014]+\s*)(.*)$/);const value=bullet?`<span class="gallery-format-bullet">${esc(bullet[1])}</span>${esc(bullet[2])}`:esc(line);return line.trim()?`<span class="gallery-format-choice">${value}</span>`:value;}).join('\n')}</span>`:(text.trim()?esc(text):'');
    return `<p data-gallery-paragraph="${index}"${format?' class="gallery-format-note"':''}>${html}</p>`;
  }
  function actionMarkup(slide){
    const contacts=document.body.dataset.page==='contacts';
    const links=(slide.actions||[]).map((action,index)=>{
      if(!contacts){try{const url=new URL(action.href,location.href);if(!['https:','http:'].includes(url.protocol))return '';return `<a class="gallery-action-button" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(action.label)}</a>`;}catch{return '';}}
      const prefix=`page:contacts:action:${slide.id}:${index}:`,label=value(prefix+'label',action.label),href=value(prefix+'href',action.href||''),attr=`data-contact-action="${esc(slide.id)}-${index}"`;
      if(action.type==='photo')return `<button type="button" class="gallery-action-button contacts-route" ${attr} data-contact-photo="${esc(action.image)}" data-contact-alt="${esc(action.alt)}">${esc(label)}</button>`;
      if(!href)return `<button type="button" class="gallery-action-button" ${attr} aria-disabled="true">${esc(label)}</button>`;
      try{const url=new URL(href,location.href);if(!['https:','http:','mailto:'].includes(url.protocol))return '';return `<a class="${action.type==='email'?'contacts-email':'gallery-action-button'}" ${attr} href="${esc(url.href)}"${url.protocol==='mailto:'?'':' target="_blank" rel="noopener noreferrer"'}>${esc(label)}</a>`;}catch{return '';}
    }).join('');
    return links?`<div class="gallery-block-actions">${links}</div>`:'';
  }
  function headingRows(title){
    const text=String(title);if(document.body.dataset.page==='contacts')return [text];const words=Array.from(text.matchAll(/\s+/gu));
    if(!words.length)return [text,''];
    const conjunction=text.match(/^(.+?\s+и)(\s+)(.+)$/iu);
    const split=conjunction?conjunction[1].length+conjunction[2].length
      :words.reduce((best,word)=>Math.abs(word.index+word[0].length-text.length/2)<Math.abs(best-text.length/2)?word.index+word[0].length:best,words[0].index+words[0][0].length);
    return [text.slice(0,split),text.slice(split)];
  }

  $('#gallery-stack').innerHTML=slides.map((slide,index)=>`<article class="gallery-case${index===active?' is-active':''}" id="gallery-${slide.id}" data-gallery-section="${slide.id}" style="--gallery-index:${index}">
    <header class="gallery-case-header" data-title-empty="${!slide.title.trim()}"><span class="gallery-rule" id="gallery-line-${slide.id}-top" aria-hidden="true"></span><h2${slide.title.trim()?'':' aria-hidden="true"'}><button type="button" class="gallery-case-heading" data-gallery-select="${index}" aria-label="${esc(slide.title || (data.title || 'Раздел')+' · '+(index+1))}"${slide.title.trim()?'':' tabindex="-1"'} aria-pressed="${index===active}" aria-controls="gallery-${slide.id}-body"><span>${headingRows(slide.title).map(row=>`<span class="gallery-heading-line">${esc(row)}</span>`).join('')}</span></button></h2></header>
    <div class="gallery-case-body" id="gallery-${slide.id}-body">${slide.paragraphs.map((paragraph,i)=>paragraphMarkup(slide,paragraph,i)).join('')}${actionMarkup(slide)}</div>
    <span class="gallery-row-spacer" data-gallery-spacer="${slide.id}" aria-hidden="true"></span>
  </article>`).join('');
  $('#gallery-visual').innerHTML=slides.map((slide,index)=>`<section class="gallery-media-panel${index===active?' is-active':''}" data-gallery-panel="${slide.id}" aria-label="${esc(slide.title)} · фотографии" style="--gallery-index:${index}">
    <div class="gallery-media-block" data-gallery-media="${slide.id}">
      <div class="gallery-photo-stack" data-gallery-frame="${slide.id}" data-gallery-section="${slide.id}" data-gallery-photo="0">
        <div class="gallery-photo-viewport" data-gallery-viewport="${slide.id}">
          <button type="button" class="gallery-photo-open" data-gallery-photo-open="${slide.id}" aria-label="Увеличить фотографию · ${esc(slide.title)}"${slide.images.length?'':' disabled'}>
            ${slide.images.map((image,i)=>`<img class="gallery-photo" src="${esc(image.src)}" alt="${esc(image.alt)}" data-slide="${index}" data-photo="${image.slot}" data-gallery-section="${slide.id}" aria-hidden="${i!==0}" loading="eager" decoding="${i===0?'sync':'async'}">`).join('')}
            ${slide.images.length?'':'<span class="gallery-photo-missing" role="status">Изображение недоступно</span>'}
          </button>
          <div class="gallery-photo-controls" data-gallery-controls="${slide.id}"${slide.images.length<2?' hidden':''}>
            <button type="button" class="gallery-small-button gallery-photo-prev" data-gallery-prev="${slide.id}" data-gallery-section="${slide.id}" aria-label="Предыдущая фотография · ${esc(slide.title)}">${arrow(-1)}</button>
            <button type="button" class="gallery-small-button gallery-photo-next" data-gallery-next="${slide.id}" data-gallery-section="${slide.id}" aria-label="Следующая фотография · ${esc(slide.title)}">${arrow(1)}</button>
          </div>
        </div>
      </div>
    </div>
  </section><span class="gallery-media-row-spacer" data-gallery-media-spacer="${slide.id}" aria-hidden="true"></span>`).join('');
  // A single closing edge belongs to the complete text/photo composition.
  const closingRule=document.createElement('span');
  closingRule.className='gallery-rule gallery-rule--bottom';closingRule.id=document.body.dataset.page==='gallery'?'gallery-line-bottom':'gallery-line-'+document.body.dataset.page+'-bottom';closingRule.setAttribute('aria-hidden','true');layout.append(closingRule);
  const inlineDetails=$('#section-details');
  if(inlineDetails?.childElementCount){
    inlineDetails.hidden=false;inlineDetails.classList.add('section-details--inline');
    $('#gallery-'+slides[0].id+'-body').append(inlineDetails);
  }
  const cards=Array.from(document.querySelectorAll('.gallery-case'));
  const headers=cards.map(card=>card.querySelector('.gallery-case-header'));
  const bodies=cards.map(card=>card.querySelector('.gallery-case-body'));
  const spacers=cards.map(card=>card.querySelector('.gallery-row-spacer'));
  const headings=cards.map(card=>card.querySelector('.gallery-case-heading'));
  const panels=Array.from(document.querySelectorAll('.gallery-media-panel'));
  const mediaSpacers=Array.from(document.querySelectorAll('.gallery-media-row-spacer'));
  const frames=panels.map(panel=>panel.querySelector('[data-gallery-frame]'));
  const blocks=panels.map(panel=>panel.querySelector('[data-gallery-media]'));
  const viewports=panels.map(panel=>panel.querySelector('[data-gallery-viewport]'));
  const imageNodes=panels.map(panel=>Array.from(panel.querySelectorAll('.gallery-photo')));
  const px=value=>parseFloat(value)||0;
  const sectionIndex=id=>typeof id==='number'?id:slides.findIndex(slide=>slide.id===id);
  function photoSlot(index,position=photoIndex[index]){return slides[index].images[position]?.slot??0;}
  function photoPosition(index,slot){return !slides[index].images.length&&slot===0?0:slides[index].images.findIndex(image=>image.slot===slot);}
  function context(){return {section:slides[active].id,photo:photoSlot(active),photoIndex:photoSlot(active),photos:Object.fromEntries(slides.map((slide,index)=>[slide.id,photoSlot(index)])),scroll:{x:scrollX,y:scrollY},details:Array.from(inlineDetails?.querySelectorAll('details[open]')||[]).map(node=>node.dataset.detail),matrixOrder:window.GalleryArtistMatrix?.order()||window.GalleryPhotoMatrix?.order()||[]};}
  function reportContext(){dispatchEvent(new CustomEvent('gallery:context',{detail:context()}));}
  function headerMetrics(){return window.GalleryHeaderMotion?.metrics()||{rail:$('.matrix-header').getBoundingClientRect().bottom+number('header:matrixGap',33),fixedRail:number('section:menuTop',20)+number('header:tileSize',55.066667)+number('header:matrixGap',33)};}
  function railTop(){return headerMetrics().rail;}
  function fixedRail(){return headerMetrics().fixedRail;}
  function imageRatio(node,image){const width=node?.naturalWidth||image?.width,height=node?.naturalHeight||image?.height;return width>0&&height>0?width/height:1;}
  function currentFrame(index,photo=photoIndex[index]){
    const anchor=slides[index].images[0],preview=previews.get(slides[index].id);
    const prefix=`gallery:${slides[index].id}:`;
    const fallback=anchor?.frame||{width:number(prefix+'frameWidth:0',0),height:number(prefix+'frameHeight:0',0),x:number(prefix+'frameX:0',0),y:number(prefix+'frameY:0',0)};
    return {...fallback,aspect:value(`gallery:${slides[index].id}:aspect:0`,anchor?.aspect||'original'),...(preview?preview.values:{})};
  }
  function edges(frame){const style=getComputedStyle(frame);return {horizontal:px(style.paddingLeft)+px(style.paddingRight)+px(style.borderLeftWidth)+px(style.borderRightWidth),vertical:px(style.paddingTop)+px(style.paddingBottom)+px(style.borderTopWidth)+px(style.borderBottomWidth),marginTop:px(style.marginTop),marginBottom:px(style.marginBottom),marginLeft:px(style.marginLeft),marginRight:px(style.marginRight)};}
  function availableWidth(index){const style=getComputedStyle(panels[index]);return Math.max(1,panels[index].clientWidth-px(style.paddingLeft)-px(style.paddingRight));}
  function frameGeometry(sourceRatio,index,values,edge){
    let ratio=values.aspect==='original'?sourceRatio:Number(values.aspect);
    const available=Math.max(1,availableWidth(index)-edge.marginLeft-edge.marginRight);
    if(values.aspect==='free'){
      const basisWidth=values.width>0?values.width:available,basisHeight=values.height>0?values.height:basisWidth/sourceRatio;
      ratio=basisWidth/Math.max(1,basisHeight);
    }
    if(!(ratio>0))ratio=sourceRatio;
    const explicit=values.width>0||values.height>0;
    const maxWidth=innerWidth<=1024?available:Math.max(available,layout.clientWidth-edge.marginLeft-edge.marginRight);
    let width=Math.min(values.width>0?values.width:available,maxWidth),height;
    if(values.aspect==='free')height=width/ratio;
    else height=Math.max(1,width-edge.horizontal)/ratio+edge.vertical;
    // Content pages keep the full column width; the document scrolls naturally.
    // The original Gallery still fits automatic frames to its viewport.
    if(!explicit&&!document.body.classList.contains('section-page')){
      const availableHeight=Math.max(80,innerHeight-fixedRail()-24);
      if(height>availableHeight){height=availableHeight;width=Math.max(1,(height-edge.vertical)*ratio+edge.horizontal);}
    }
    return {width:Math.max(1,width),height:Math.max(1,height),ratio,containerWidth:available};
  }
  function paintFrame(index,photo=photoIndex[index]){
    const frame=frames[index],block=blocks[index],viewport=viewports[index],image=slides[index].images[0],node=imageNodes[index][0],values=currentFrame(index);
    frame.dataset.galleryPhoto=String(photoSlot(index,photo));
    // Shared frame decoration and geometry belong to slot zero. The active image
    // retains its own crop, but cannot resize the carousel during navigation.
    frame.dataset.galleryFrameStyle='0';
    const edge=edges(frame),geometry=frameGeometry(imageRatio(node,image),index,values,edge);
    // Center the complete margin box. Each horizontal margin changes the visible
    // composition while an explicit authored frame width remains unchanged.
    block.style.width=Math.max(1,geometry.width+edge.marginLeft+edge.marginRight)+'px';
    block.style.transform=`${document.body.classList.contains('section-page')?'':'translateX(-50%) '}translate(${values.x}px, ${values.y}px)`;
    frame.style.width=geometry.width+'px';frame.style.height=geometry.height+'px';frame.style.maxWidth='none';frame.style.aspectRatio='auto';
    const frameRatio=viewport.clientWidth>0&&viewport.clientHeight>0?viewport.clientWidth/viewport.clientHeight:geometry.ratio;
    frame.dataset.frameRatio=String(frameRatio);
    imageNodes[index].forEach((imageNode,i)=>{
      const sourceImage=slides[index].images[i],sourceRatio=imageRatio(imageNode,sourceImage),crop=sourceImage.crop;
      Object.assign(imageNode.style,{width:Math.max(100,sourceRatio/frameRatio*100)+'%',height:Math.max(100,frameRatio/sourceRatio*100)+'%',left:(50+crop.x)+'%',top:(50+crop.y)+'%',transform:`translate(-50%, -50%) scale(${crop.zoom/100})`});
    });
    return geometry;
  }
  function aliasActive(){
    const aliases=[['gallery-photos',frames],['gallery-media-block',blocks],['gallery-photo-open',panels.map(panel=>panel.querySelector('.gallery-photo-open'))],['gallery-photo-controls',panels.map(panel=>panel.querySelector('.gallery-photo-controls'))],['gallery-photo-prev',panels.map(panel=>panel.querySelector('.gallery-photo-prev'))],['gallery-photo-next',panels.map(panel=>panel.querySelector('.gallery-photo-next'))]];
    for(const [id,nodes]of aliases){for(const node of nodes)if(node.id===id)node.removeAttribute('id');nodes[active].id=id;}
  }
  function renderPhoto(index){
    const slide=slides[index],current=photoIndex[index];
    imageNodes[index].forEach((node,i)=>node.setAttribute('aria-hidden',String(i!==current)));
    panels[index].querySelector('.gallery-photo-controls').hidden=slide.images.length<2;
    panels[index].querySelector('.gallery-photo-open').setAttribute('aria-label',(slide.id==='directions'?'Увеличить схему проезда':'Увеличить фотографию')+' · '+slide.title);
    paintFrame(index,current);
  }
  function setActive(index,updateHash=true){
    if(index<0||index>=slides.length)return false;
    active=index;
    cards.forEach((card,i)=>card.classList.toggle('is-active',i===active));panels.forEach((panel,i)=>panel.classList.toggle('is-active',i===active));
    headings.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===active)));
    layout.dataset.activeSection=slides[active].id;layout.dataset.activePhoto=String(photoSlot(active));aliasActive();
    if(updateHash&&location.hash!=='#'+slides[active].id)history.replaceState(null,'','#'+slides[active].id);
    reportContext();return true;
  }
  function fitWidth(){const diameter=number('matrix:circleSize',107.1225),rows=number('matrix:rows',5);const columns=Math.max(1,Math.min(Math.floor(($('.matrix-frame').getBoundingClientRect().width+.01)/diameter),Math.floor(60/rows)));$('#matrix-pack').style.setProperty('--matrix-columns',String(columns));window.GalleryHeaderMotion?.update();window.GalleryHeaderQuote?.refit();}
  function outerHeight(node){const style=getComputedStyle(node);return node.getBoundingClientRect().height+px(style.marginTop)+px(style.marginBottom);}
  const textMeasure=document.createElement('canvas').getContext('2d');
  function textBox(node){
    const range=document.createRange();range.selectNodeContents(node);
    const rects=Array.from(range.getClientRects()).filter(rect=>rect.width>0&&rect.height>0);
    if(!rects.length)return node.getBoundingClientRect();
    const first=rects.reduce((a,b)=>a.top<b.top?a:b),last=rects.reduce((a,b)=>a.top>b.top?a:b);
    if(!textMeasure)return {top:first.top,bottom:last.bottom};
    const leading=[],trailing=[],walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    let text;
    while((text=walker.nextNode()))for(const word of text.textContent.matchAll(/\S+/g)){
      range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);
      const lines=Array.from(range.getClientRects());
      const starts=lines.some(rect=>Math.abs(rect.top-first.top)<.5),ends=lines.some(rect=>Math.abs(rect.top-last.top)<.5);
      if(lines.length>1&&(starts||ends)){
        let head='',tail='';
        for(let i=0;i<word[0].length;i++){range.setStart(text,word.index+i);range.setEnd(text,word.index+i+1);const part=range.getBoundingClientRect();if(Math.abs(part.top-first.top)<.5)head+=word[0][i];if(Math.abs(part.top-last.top)<.5)tail+=word[0][i];}
        if(head)leading.push(head);if(tail)trailing.push(tail);
      }else{if(starts)leading.push(word[0]);if(ends)trailing.push(word[0]);}
    }
    const style=getComputedStyle(node);textMeasure.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const start=textMeasure.measureText(leading.join(' ')),end=textMeasure.measureText(trailing.join(' '));
    if(!Number.isFinite(start.fontBoundingBoxDescent)||!Number.isFinite(end.fontBoundingBoxDescent))return {top:first.top,bottom:last.bottom};
    return {top:first.bottom-start.fontBoundingBoxDescent-start.actualBoundingBoxAscent,bottom:last.bottom-end.fontBoundingBoxDescent+end.actualBoundingBoxDescent};
  }
  function actionRhythm(body){
    const group=body.querySelector(':scope > .section-details--inline,:scope > .gallery-block-actions');
    if(!group)return false;
    group.style.setProperty('--gallery-action-before','0px');group.style.setProperty('--gallery-action-after','0px');
    group.style.setProperty('--gallery-action-follow-adjust','0px');
    const paragraphs=Array.from(body.children).filter(node=>node.matches('p')&&node.textContent.trim()&&node.getBoundingClientRect().height>0&&getComputedStyle(node).display!=='none');
    const previous=paragraphs.at(-1),before=paragraphs.at(-2),button=group.querySelector('summary,.gallery-action-button');
    if(!previous||!button)return false;
    const previousBox=textBox(previous),box=previous.getBoundingClientRect();
    // Paragraph margins omit the font's leading. Measure the first/last
    // printed lines, then give the button that same visible clearance.
    const gap=Math.max(0,before?previousBox.top-textBox(before).bottom:px(getComputedStyle(previous).marginBottom)+previousBox.top-box.top+box.bottom-previousBox.bottom);
    if(document.body.dataset.page==='contacts')group.style.gap=gap+'px';
    group.style.setProperty('--gallery-action-before',Math.max(0,gap-(button.getBoundingClientRect().top-previousBox.bottom))+'px');
    const expanded=group.querySelector('details[open] > div');
    if(expanded){
      const next=Array.from(expanded.children).find(node=>node.textContent.trim()&&node.getBoundingClientRect().height>0&&getComputedStyle(node).display!=='none');
      if(next){const padding=px(getComputedStyle(expanded).paddingTop);group.style.setProperty('--gallery-action-follow-adjust',Math.max(-padding,gap-(textBox(next).top-button.getBoundingClientRect().bottom))+'px');}
    }else group.style.setProperty('--gallery-action-after',gap+'px');
    return !expanded;
  }
  function naturalCardHeight(index){
    const body=bodies[index],box=body.getBoundingClientRect();
    const contentBottom=Math.max(box.bottom,...Array.from(body.querySelectorAll('p')).filter(node=>!node.closest('details:not([open])')&&node.getBoundingClientRect().height>0).map(node=>node.getBoundingClientRect().bottom+px(getComputedStyle(node).marginBottom)));
    return outerHeight(headers[index])+outerHeight(body)+Math.max(0,contentBottom-box.bottom);
  }
  function configure(){
    if(configuring)return;configuring=true;
    try{
      fitWidth();
      layout.style.setProperty('--gallery-composition-width',layout.getBoundingClientRect().width+'px');
      const color=getComputedStyle(document.body).backgroundColor,channels=color.match(/[\d.]+/g)?.map(Number)||[255,255,255],alpha=channels.length>3?channels[3]:1;
      layout.style.setProperty('--gallery-page-background','rgb('+channels.slice(0,3).map(c=>Math.round(c*alpha+255*(1-alpha))).join(',')+')');
      layout.dataset.stackMode='measure';layout.style.setProperty('--gallery-tail-space','0px');
      cards.forEach(card=>{card.style.removeProperty('--gallery-row-height');card.style.removeProperty('--gallery-case-span');card.style.removeProperty('--gallery-case-overlap');});spacers.forEach(spacer=>spacer.style.height='0px');mediaSpacers.forEach(spacer=>spacer.style.height='0px');panels.forEach(panel=>{panel.style.removeProperty('--gallery-row-height');panel.style.minHeight='0px';});
      bodies.forEach(body=>{
        const visible=Array.from(body.children).filter(node=>node.getBoundingClientRect().height>0&&getComputedStyle(node).display!=='none');
        const last=visible.at(-1);
        body.querySelectorAll(':scope > p').forEach(node=>node.classList.toggle('is-final-text',node===last));
      });
      inlineDetails?.querySelectorAll('summary').forEach(button=>{
        button.style.width='max-content';const natural=button.getBoundingClientRect().width;
        button.dataset.baseWidth=String(natural);
        button.style.width=Math.min(natural*1.2,bodies[0].clientWidth)+'px';
      });
      const actionEnds=bodies.map(actionRhythm);
      const blockGap=px(getComputedStyle(layout).getPropertyValue('--gallery-block-gap'));
      const stroke=px(getComputedStyle(layout).getPropertyValue('--gallery-stroke'));
      headers.forEach(header=>{const title=header.querySelector('h2');title.tabIndex=title.scrollWidth>title.clientWidth+1?0:-1;});
      let offset=0;
      const heights=headers.map(outerHeight);
      const allHeaders=heights.reduce((sum,height)=>sum+height,0);
      mode=fixedRail()+allHeaders+100<innerHeight?'stack':'flow';
      slides.forEach((slide,index)=>{
        const textHeight=naturalCardHeight(index);
        renderPhoto(index);
        const box=frames[index].getBoundingClientRect(),edge=edges(frames[index]),values=currentFrame(index);
        const photoHeight=Math.max(0,values.y)+box.height+Math.max(0,edge.marginTop)+Math.max(0,edge.marginBottom);
        const row=Math.max(textHeight+(actionEnds[index]?0:blockGap),photoHeight+(document.body.dataset.page==='contacts'&&index===slides.length-1?0:blockGap))+(index===slides.length-1?stroke:0);
        headerOffsets[index]=offset;rowHeights[index]=row;
        cards[index].style.setProperty('--gallery-header-offset',offset+'px');cards[index].style.setProperty('--gallery-body-offset',(offset+heights[index])+'px');cards[index].style.setProperty('--gallery-row-height',row+'px');
        // Prose always follows native document scroll, regardless of its length.
        bodies[index].dataset.canStick='false';
        spacers[index].style.height=Math.max(0,row-outerHeight(headers[index])-outerHeight(bodies[index]))+'px';
        panels[index].style.setProperty('--gallery-row-height',row+'px');
        panels[index].style.minHeight=photoHeight+'px';
        mediaSpacers[index].style.height=Math.max(0,row-photoHeight)+'px';
        panels[index].dataset.canStick='true';
        panels[index].style.setProperty('--gallery-media-height',photoHeight+'px');
        offset+=heights[index];
      });
      // Different static parent ends keep the complete title stack together
      // when the closing rule pushes it out. No per-scroll transforms needed.
      const totalRows=rowHeights.reduce((sum,height)=>sum+height,0);
      let rowStart=0;
      cards.forEach((card,index)=>{
        const remaining=allHeaders-headerOffsets[index]-heights[index];
        const span=totalRows-rowStart-remaining-stroke;
        card.style.setProperty('--gallery-case-span',span+'px');
        card.style.setProperty('--gallery-case-overlap',(span-rowHeights[index])+'px');
        rowStart+=rowHeights[index];
      });
      layout.dataset.stackMode=mode;
      const shellBottom=px(getComputedStyle($('.matrix-shell')).paddingBottom);
      const lastPhotoHeight=frames.at(-1).getBoundingClientRect().height;
      const lastPhotoBottom=Math.min(fixedRail(),innerHeight-lastPhotoHeight-24)+lastPhotoHeight;
      const exitTarget=Math.min(fixedRail()+(mode==='stack'?allHeaders:0)+24,lastPhotoBottom-48);
      const exitSpace=(document.body.classList.contains('section-page')&&document.body.dataset.page!=='contacts'||photoMatrix)?0:Math.max(0,innerHeight-exitTarget-shellBottom);
      layout.style.setProperty('--gallery-tail-space','0px');
      layout.style.setProperty('--gallery-exit-space',exitSpace+'px');
      setActive(active,false);paintLayering();paintClosingRule();
    }finally{configuring=false;}
  }
  function paintClosingRule(){
    const frame=frames.at(-1),photo=frame.getBoundingClientRect(),rule=closingRule.getBoundingClientRect();
    frame.classList.toggle('is-bottom-joined',Math.abs(photo.bottom-rule.bottom)<.1);
  }
  function paintLayering(){
    // Visual occlusion belongs to CSS. Only keyboard availability is derived here.
    panels.forEach((panel,index)=>{
      const box=panel.getBoundingClientRect(),next=panels[index+1]?.getBoundingClientRect();
      panel.inert=!editing&&!!next&&next.top<=box.top+.01;
    });
  }
  function update(){
    scrollFrame=0;paintLayering();paintClosingRule();if(editing)return;
    if(desired!==null){
      const top=railTop()+(mode==='stack'?headerOffsets[desired]:0),rect=headers[desired].getBoundingClientRect();
      if(Math.abs(rect.top-top)>3&&scrollY+innerHeight<document.documentElement.scrollHeight-3)return;
      desired=null;clearTimeout(desiredTimer);
    }
    let current=0;
    headers.forEach((header,index)=>{const top=railTop()+(mode==='stack'?headerOffsets[index]:0);if(header.getBoundingClientRect().top<=top+6)current=index;});
    if(scrollY+innerHeight>=document.documentElement.scrollHeight-3)current=slides.length-1;
    if(current!==active)setActive(current);
  }
  const queueScroll=()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(update);};
  function releaseDesired(){desired=null;clearTimeout(desiredTimer);queueScroll();}
  function goTo(index,focus=false,instant=false,updateHash=true,scroll=true){
    if(!setActive(index,updateHash))return false;
    if(focus)headings[index].focus({preventScroll:true});if(!scroll)return true;
    const saved=layout.dataset.stackMode;layout.dataset.stackMode='measure-position';
    const naturalTop=headers[index].getBoundingClientRect().top+scrollY;layout.dataset.stackMode=saved;
    const target=Math.max(0,naturalTop-fixedRail()-(mode==='stack'?headerOffsets[index]:0)+1);
    desired=index;clearTimeout(desiredTimer);layout.dataset.scrollTarget=String(target);
    scrollTo({top:target,behavior:instant||reduced.matches?'instant':'smooth'});desiredTimer=setTimeout(releaseDesired,instant||reduced.matches?60:1800);return true;
  }
  headings.forEach((button,index)=>button.addEventListener('click',()=>goTo(index)));
  $('#gallery-stack').addEventListener('keydown',event=>{if(!event.target.closest('.gallery-case-heading'))return;const next={'ArrowLeft':active-1,'ArrowUp':active-1,'ArrowRight':active+1,'ArrowDown':active+1,Home:0,End:slides.length-1}[event.key];if(next===undefined)return;event.preventDefault();goTo(Math.max(0,Math.min(slides.length-1,next)),true);});
  function nextPhoto(index,direction){if(slides[index].images.length<2)return;previews.delete(slides[index].id);photoIndex[index]=(photoIndex[index]+direction+slides[index].images.length)%slides[index].images.length;renderPhoto(index);setActive(index,false);queueLayout();}
  const dialog=$('#gallery-photo-dialog');
  document.querySelectorAll('[data-contact-photo]').forEach(button=>button.addEventListener('click',()=>{const full=$('#gallery-photo-full');full.src=button.dataset.contactPhoto;full.alt=button.dataset.contactAlt;dialog.showModal();}));
  slides.forEach((slide,index)=>{
    panels[index].querySelector('.gallery-photo-prev').addEventListener('click',()=>nextPhoto(index,-1));
    panels[index].querySelector('.gallery-photo-next').addEventListener('click',()=>nextPhoto(index,1));
    const open=panels[index].querySelector('.gallery-photo-open');
    open.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();nextPhoto(index,event.key==='ArrowLeft'?-1:1);});
    open.addEventListener('click',()=>{const image=slide.images[photoIndex[index]];if(!image)return;setActive(index,false);const full=$('#gallery-photo-full');full.src=image.src;full.alt=image.alt;dialog.showModal();});
    imageNodes[index].forEach(node=>{const warm=()=>node.decode?.().catch(()=>{});if(node.complete)warm();node.addEventListener('load',()=>{warm();renderPhoto(index);queueLayout();});});
  });
  const photoMatrix=$('#gallery-photo-matrix'),matrixPhotos=data.photoMatrix||[];
  if(photoMatrix&&matrixPhotos.length){
    let order=[];
    const render=ids=>{
      order=ids||matrixPhotos.map(image=>image.id);
      if(!ids)for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      photoMatrix.innerHTML=order.map(id=>{const image=matrixPhotos.find(photo=>photo.id===id);return `<button type="button" class="work-orb" id="${esc(id)}" aria-label="Увеличить фотографию · ${esc(image.alt)}"><span class="work-orb-viewport"><img src="${esc(image.src)}" alt="${esc(image.alt)}" decoding="async" loading="lazy"></span></button>`;}).join('');
      order.forEach(id=>photoMatrix.querySelector('#'+id).addEventListener('click',()=>{const image=matrixPhotos.find(photo=>photo.id===id),full=$('#gallery-photo-full');full.src=image.src;full.alt=image.alt;dialog.showModal();}));
    };
    window.GalleryPhotoMatrix={order:()=>[...order],restoreOrder(ids){if(!Array.isArray(ids)||ids.length!==matrixPhotos.length||new Set(ids).size!==ids.length||ids.some(id=>!matrixPhotos.some(photo=>photo.id===id)))return false;render(ids);return true;},reset:()=>render()};
    render();
  }
  $('#gallery-photo-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  addEventListener('scroll',()=>{queueScroll();if(editing)reportContext();},{passive:true});
  addEventListener('gallery:header-motion',queueScroll);
  addEventListener('wheel',()=>{if(desired!==null)releaseDesired();},{passive:true});addEventListener('touchstart',()=>{if(desired!==null)releaseDesired();},{passive:true});
  addEventListener('hashchange',()=>{if(editing)return;const index=sectionIndex(location.hash.slice(1));if(index>=0)goTo(index);});
  function queueLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;configure();});}
  addEventListener('resize',queueLayout);
  inlineDetails?.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',queueLayout));
  // Observing width only avoids feedback from measured row heights.
  let previousWidth=0;new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(Math.abs(width-previousWidth)>.25){previousWidth=width;queueLayout();}}).observe($('.matrix-frame'));
  const contentSizes=new WeakMap(),contentObserver=new ResizeObserver(entries=>{
    let changed=false;for(const entry of entries){const key=entry.contentRect.width+':'+entry.contentRect.height;if(contentSizes.get(entry.target)!==key){contentSizes.set(entry.target,key);changed=true;}}
    if(changed)queueLayout();
  });[...headers,...bodies,...frames].forEach(node=>contentObserver.observe(node));
  addEventListener('gallery:rendered',()=>{if(pendingMatrixOrder&&window.GalleryArtistMatrix){const ids=pendingMatrixOrder;pendingMatrixOrder=null;window.GalleryArtistMatrix.restoreOrder(ids);}reportContext();});
  window.GallerySection={
    select(id,photoOrOptions=null,options={}){
      const index=sectionIndex(id);if(index<0||index>=slides.length)return false;
      const config=photoOrOptions&&typeof photoOrOptions==='object'?photoOrOptions:options,photo=typeof photoOrOptions==='number'?photoOrOptions:config.photo??config.photoIndex;
      if(Number.isInteger(photo)){const position=photoPosition(index,photo);if(position<0)return false;previews.delete(slides[index].id);photoIndex[index]=position;renderPhoto(index);queueLayout();}
      return goTo(index,!!config.focus,config.instant!==false,config.updateHash===true,config.scroll===true);
    },context,
    getFrameMetrics(id){
      const index=id===undefined?active:sectionIndex(id);if(index<0)return null;
      const frame=frames[index],rect=frame.getBoundingClientRect(),container=panels[index].getBoundingClientRect(),values=currentFrame(index);
      return {width:rect.width,height:rect.height,containerWidth:availableWidth(index),containerHeight:container.height,x:values.x,y:values.y,logicalWidth:values.width,logicalHeight:values.height,aspect:values.aspect,frameRatio:Number(frame.dataset.frameRatio)||rect.width/Math.max(1,rect.height),section:slides[index].id,photo:photoSlot(index),previewActive:previews.has(slides[index].id)};
    },
    applyFramePreview(values,id){
      const index=id===undefined?active:sectionIndex(id);if(index<0)return null;const current=currentFrame(index),next={...current};
      for(const key of ['width','height','x','y'])if(Number.isFinite(Number(values?.[key])))next[key]=Number(values[key]);
      next.width=Math.max(0,Math.min(3000,next.width));next.height=Math.max(0,Math.min(3000,next.height));next.x=Math.max(-2000,Math.min(2000,next.x));next.y=Math.max(-2000,Math.min(2000,next.y));
      if(values?.aspect)next.aspect=values.aspect;else if(next.width>0&&next.height>0)next.aspect='free';
      previews.set(slides[index].id,{photo:photoIndex[index],values:next});renderPhoto(index);queueLayout();return this.getFrameMetrics(slides[index].id);
    },
    clearFramePreview(id){const index=id===undefined?active:sectionIndex(id);if(index<0)return null;previews.delete(slides[index].id);renderPhoto(index);queueLayout();return this.getFrameMetrics(slides[index].id);},
    restore(value){
      const state=value?.gallerySection||value;if(!state)return;restored=true;
      if(Array.isArray(state.details))inlineDetails?.querySelectorAll('details').forEach(node=>node.open=state.details.includes(node.dataset.detail));
      if(Array.isArray(state.matrixOrder)&&state.matrixOrder.length){if(window.GalleryArtistMatrix)window.GalleryArtistMatrix.restoreOrder(state.matrixOrder);else if(window.GalleryPhotoMatrix)window.GalleryPhotoMatrix.restoreOrder(state.matrixOrder);else pendingMatrixOrder=state.matrixOrder;}
      if(state.photos&&typeof state.photos==='object')slides.forEach((slide,index)=>{const photo=state.photos[slide.id],position=photoPosition(index,photo);if(Number.isInteger(photo)&&position>=0)photoIndex[index]=position;});
      slides.forEach((_,index)=>renderPhoto(index));const index=sectionIndex(state.section);
      if(index>=0)this.select(state.section,{photo:state.photoIndex??state.photo,scroll:false,updateHash:false});
      if(state.scroll)scrollTo({left:state.scroll.x||0,top:state.scroll.y||0,behavior:'instant'});
      window.GalleryHeaderMotion?.update();
    },
    resetEntry(){inlineDetails?.querySelectorAll('details[open]').forEach(node=>node.open=false);window.GalleryPhotoMatrix?.reset();photoIndex=slides.map(()=>0);previews.clear();slides.forEach((_,index)=>renderPhoto(index));setActive(0,false);scrollTo({left:0,top:0,behavior:'instant'});window.GalleryHeaderMotion?.update();queueScroll();},
    setEditing(value){editing=!!value;layout.dataset.editing=String(editing);if(editing){desired=null;clearTimeout(desiredTimer);}queueScroll();}
  };
  slides.forEach((_,index)=>renderPhoto(index));setActive(active,false);configure();window.GalleryHeaderQuote?.newEntry();
  dispatchEvent(new CustomEvent('gallery:ready',{detail:context()}));
  (document.fonts?.ready||Promise.resolve()).then(configure);
})();
