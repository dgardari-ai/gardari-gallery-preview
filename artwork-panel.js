/* One full-work panel shared by the matrix and all artwork collections. */
(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const state = {works: [], visible: []};
  let mediaMap = {}, currentWorkId = null, pendingEditorOpen = null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const resolveMedia = value => {
    try { const url = new URL(mediaMap[value] || value, location.href); return ["http:","https:"].includes(url.protocol) ? url.href : ""; }
    catch { return ""; }
  };
  const safeHref = value => esc(resolveMedia(value));
  const story = text => esc(text || "").replace(/([.!?…])(?=[А-ЯЁ])/g,"$1 ").replace(/\r?\n/g,"<br>");
  const isArtworkImage = image => image?.url
    && image.url !== 'https://static.tildacdn.com/ffb6456b-781b-40e8-9517-ffb5225e8bcd/imgfish.jpg';
  const imageDimensions = image => image?.width>0 && image?.height>0
    ? ` width="${Math.round(image.width)}" height="${Math.round(image.height)}"` : '';
  function ensureDialog() {
    if (!$("#work-dialog")) {
      const dialog = document.createElement("dialog"); dialog.className="work-dialog"; dialog.id="work-dialog"; dialog.setAttribute("aria-labelledby","work-title");
      dialog.innerHTML='<div class="drawer-head"><span>ГАЛЕРЕЯ ГАРДАРИ <span id="work-counter"></span></span><button type="button" class="drawer-close" id="drawer-close" aria-label="Закрыть карточку произведения">×</button></div><div class="drawer-scroll" id="drawer-content"></div>';
      document.body.append(dialog);
    }
    if (!$("#work-head-bottom")) { const rule=document.createElement("span"); rule.id="work-head-bottom";rule.className="work-head-rule";rule.setAttribute("aria-hidden","true");$(".drawer-head").append(rule); }
  }
  // All 60 historical records begin with a title and a fact block. The
  // repeated fields end at the final labeled line (or "ПРИОБРЕСТИ" in
  // Digital). Keep the complete authorial narrative after that boundary.
  function workNarrative(w) {
    if (w.authorText?.trim()) return w.authorText.trim();
    const lines = String(w.fullText || "").split(/\r?\n/).map((line) => line.trim());
    if (!lines.length) return "";
    let boundary = 0;
    for (let i = 1; i < lines.length; i++) {
      if (/^(?:ТЕХНИКА|ГОД|РАЗМЕР(?:\s*\/\s*ЦЕНА)?|ЦЕНА|КОМПЛЕКТ|ТИРАЖ)\s*:/i.test(lines[i]) || /^ПРИОБРЕСТИ\s*$/i.test(lines[i])) {
        boundary = i;
      }
    }
    return lines.slice(boundary + 1).join("\n").trim();
  }

  // Extracted Tilda line breaks separate prose paragraphs; consecutive short
  // poetic lines remain a single stanza with tighter internal leading.
  function narrativeMarkup(raw) {
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const groups = [];
    let stanza = [];
    const short = (s) => s.length < 110;
    const flush = () => { if (stanza.length) groups.push(stanza.splice(0)); };
    lines.forEach((line, i) => {
      if (short(line) && (stanza.length || short(lines[i+1] || "") && i+1 < lines.length)) stanza.push(line);
      else { flush(); groups.push([line]); }
    });
    flush();
    return groups.map((group) => `<p>${group.map(story).join("<br>")}</p>`).join("");
  }

  // Preview recommendation model: series, recurring themes and narrative vocabulary.
  const themeRoots = [
    ['сказ','бажов','хозяйк','мастер','камень','камен','ураль','малахит','цветок'],
    ['дух','душ','мудр','свят','монах','суфи','волхв','бог','молит','вер'],
    ['люб','женщ','женск','матер','матуш','дев','красот','маргарит'],
    ['природ','лес','птиц','солн','свет','огн','земл','цвет','дерев'],
    ['разум','мысл','созн','человек','цивилиз','эволюц','мир','времен'],
    ['твор','искусств','худож','музык','танц','игр','театр','поэт','писат'],
    ['пут','дорог','движ','свобод','выбор','судьб','жизн','смерт']
  ];
  const workText = w => [w.title,w.series,workNarrative(w)].join(' ').toLowerCase();
  const words = w => new Set((workText(w).match(/[а-яёa-z]{5,}/g)||[]).map(x=>x.slice(0,6)));
  function relatedWorks(w) {
    const text=workText(w), own=words(w);
    const themes=themeRoots.map(roots=>roots.some(root=>text.includes(root)));
    return state.works.filter(other=>other.id!==w.id).map(other=>{
      const ot=workText(other), ow=words(other);
      const shared=[...own].filter(x=>ow.has(x)).length;
      const themesScore=themeRoots.reduce((n,roots,i)=>n+(themes[i]&&roots.some(root=>ot.includes(root))?4:0),0);
      const titleScore=other.title===w.title?100:0;
      const seriesScore=w.series&&other.series===w.series?28:0;
      return {other,score:titleScore+seriesScore+themesScore+12*shared/Math.max(1,Math.sqrt(own.size*ow.size))};
    }).sort((a,b)=>b.score-a.score||a.other.id.localeCompare(b.other.id)).slice(0,2).map(x=>x.other);
  }
  function relatedMarkup(w) {
    return `<section class="drawer-related" aria-label="Близкие работы"><span class="drawer-related-rule" aria-hidden="true"></span><div class="drawer-related-grid">${relatedWorks(w).map(other=>`<button type="button" class="work-card" data-related-work="${esc(other.id)}" aria-label="Открыть: ${esc(other.title)}"><span class="work-card-visual"><img loading="lazy" decoding="async" src="${safeHref(other.cover||(other.images||[]).find(isArtworkImage)?.url||'')}" alt="${esc(other.title)}"></span><span class="work-card-copy"><span class="work-card-title">${esc(other.title)}</span>${other.series?`<span class="work-card-label">${esc(other.series)}</span>`:''}</span></button>`).join('')}</div></section>`;
  }

  let purchaseDialog=null;
  function ensurePurchaseDialog(){
    if(purchaseDialog)return purchaseDialog;
 const purchase=document.createElement('dialog');purchase.className='purchase-dialog';purchase.setAttribute('aria-label','Согласовать покупку работы');
 purchase.innerHTML=`<button type="button" class="purchase-close" aria-label="Закрыть окно покупки">×</button><img class="purchase-portrait" src="vmg-designer-assets/83849c1ddd3e7ef0813d536f55d56f459f357cc2d066d36c23589704554ede3a.jpg" alt="Денис Гардари"><p class="purchase-message">Чтобы согласовать покупку этой работы, свяжитесь со мной в удобном вам мессенджере.</p><div class="purchase-contacts"><button type="button" class="gallery-action-button" aria-disabled="true">НАПИСАТЬ В TELEGRAM</button><button type="button" class="gallery-action-button" aria-disabled="true">НАПИСАТЬ В ВК МЕССЕНДЖЕРЕ</button><button type="button" class="gallery-action-button" aria-disabled="true">НАПИСАТЬ В МАКС</button></div>`;
 document.body.append(purchase);
 purchase.querySelector('.purchase-close').onclick=()=>purchase.close();
 purchase.addEventListener('click',event=>{if(event.target!==purchase)return;const r=purchase.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)purchase.close();});
 purchaseDialog=purchase;return purchase;

  }

  function openWork(id, options = {}) {
    if (Array.isArray(options.ids)) state.visible = options.ids.map(id => state.works.find(work => work.id === id)).filter(Boolean);
    const w = state.works.find((v) => v.id === id);
    if (!w) return false;
    currentWorkId = w.id;
    const currentList = state.visible.some((v) => v.id === id)
      ? state.visible : state.works.filter((v) => v.medium === w.medium);
    const index = currentList.findIndex((v) => v.id === id) + 1;
    $("#work-counter").textContent = String(index).padStart(2,"0") + "/" + String(currentList.length).padStart(2,"0");
    const price=w.currentPrice ?? w.historicalPrice;
    const saleState=options.saleState || w.saleStatus || (/не прода[её]тся/i.test(price||'') ? 'not-for-sale' : /продан/i.test(price||'') ? 'sold' : 'price');
    const displayPrice=saleState==='sold'?(w.saleLabel||'ПРОДАНО'):saleState==='not-for-sale'?'НЕ ПРОДАЁТСЯ':price;
    const canBuy=saleState==='price' && !!(price || w.sizePrices) && !/продан|не прода[её]тся/i.test(price||'');
    const factText = value => String(value).replace(/(?<!\d)\.|\.(?!\d)/g, "");
    const fields = [
      ["НАПРАВЛЕНИЕ", w.medium], ["СЕРИЯ", w.series], ["ГОД", w.year || "2020"],
      ["ТЕХНИКА", w.technique], ["РАЗМЕР", w.dimensions],
      ["ТИРАЖ", w.edition], ["РАЗМЕР / ЦЕНА", saleState==='price' ? String(w.sizePrices||'').split(' | ').join('\n') : ''],
      ["ЦЕНА", displayPrice]
    ].filter((entry) => entry[1]);
    const galleryImages = (w.images || []).filter(isArtworkImage);
    const coverUrl = w.cover || galleryImages[0]?.url || "";
    const additionalImages = galleryImages.filter((img) => img.url !== coverUrl);
    const description = workNarrative(w);
    $("#drawer-content").innerHTML = `
      <img class="drawer-cover" src="${safeHref(coverUrl)}" alt="${esc(w.title)}"${imageDimensions(galleryImages.find(image=>image.url===coverUrl))}>
      <h2 class="drawer-title" id="work-title">${esc(w.title)}</h2>
      <div class="drawer-kicker">${esc(w.series || w.medium)}</div>
      <div class="drawer-meta-wrap${canBuy ? " has-purchase" : ""}${w.sizePrices ? " has-size-prices" : ""}"><span class="work-facts-rule" id="work-facts-top" aria-hidden="true"></span><dl class="drawer-meta">${fields.map(([label, value])=>`<dt>${esc(label)}</dt><dd>${esc(factText(value))}</dd>`).join("")}</dl><div class="drawer-facts-footer"><span class="work-facts-rule work-facts-rule--bottom" id="work-facts-bottom" aria-hidden="true"></span>${canBuy?`<button type="button" class="gallery-action-button drawer-buy">КУПИТЬ ЭТУ РАБОТУ</button>`:""}</div></div>
      ${description ? `<div class="drawer-story">${narrativeMarkup(description)}</div>` : ""}
      ${additionalImages.length ? `<div class="drawer-gallery">${additionalImages.map((img)=>`<img loading="lazy" decoding="async" src="${safeHref(img.url)}" alt="${esc(w.title)} — дополнительное изображение"${imageDimensions(img)}>`).join("")}</div>` : ""}
      ${relatedMarkup(w)}`;
    document.querySelectorAll('[data-related-work]').forEach(button=>button.addEventListener('click',()=>openWork(button.dataset.relatedWork)));
    document.querySelector('.drawer-buy')?.addEventListener('click',()=>{
      const popup=ensurePurchaseDialog();if(!popup.open)popup.showModal();
    });
    const dialog = $("#work-dialog");
    if (!dialog.open) dialog.showModal();
    $("#drawer-content").scrollTop = Math.max(0, Number(options.scrollTop)||0);
    dispatchEvent(new CustomEvent('gallery:work-ready',{detail:dialogContext()}));
    return true;
  }
  function dialogContext(){
    return {open:!!$("#work-dialog").open,workId:currentWorkId,scrollTop:$("#drawer-content").scrollTop};
  }
  function openForEditor(id=null,options={}){
    if(!state.works.length){pendingEditorOpen={id,options};return false;}
    const requested=state.works.some(work=>work.id===id)?id:currentWorkId||state.visible[0]?.id||state.works[0]?.id;
    if(!requested)return false;
    if($("#work-dialog").open&&currentWorkId===requested){
      if(Object.hasOwn(options,'scrollTop'))$("#drawer-content").scrollTop=Math.max(0,Number(options.scrollTop)||0);
      return true;
    }
    return openWork(requested,options);
  }

  function restoreDialog(value) {
    if(!value)return false;
    if(value.open)return openForEditor(value.workId,{scrollTop:value.scrollTop});
    pendingEditorOpen=null;if($("#work-dialog").open)$("#work-dialog").close();return true;
  }
  // Current prices/statuses dictated by Denis on 2026-10-31.
  // Keep historical donor data and author narratives unchanged.
  const AUTHOR_CONFIRMED_OFFERS = {
    "8v2kpnezb1": {
      "status": "not-for-sale",
      "label": "НЕ ПРОДАЁТСЯ"
    },
    "6xsrtcc4e1": {
      "status": "not-for-sale",
      "label": "НЕ ПРОДАЁТСЯ"
    },
    "2j7ccv69g1": {
      "status": "not-for-sale",
      "label": "НЕ ПРОДАЁТСЯ"
    },
    "v06tb8rn01": {
      "status": "not-for-sale",
      "label": "НЕ ПРОДАЁТСЯ"
    },
    "bpjs3c0vb1": {
      "status": "not-for-sale",
      "label": "НЕ ПРОДАЁТСЯ"
    },
    "j82gnrdcj1": {
      "status": "price",
      "price": "1 200 000 рублей"
    },
    "v7kehrcfx1": {
      "status": "price",
      "price": "1 200 000 рублей"
    },
    "bvgoitm0i1": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "dtijeim4i1": {
      "status": "sold",
      "label": "ПРОДАНА"
    },
    "04e74o3lc1": {
      "status": "price",
      "price": "1 200 000 рублей"
    },
    "yblsftiaz1": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "ndvkv44y71": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "0smycy7i41": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "x6nzcikfm1": {
      "status": "price",
      "price": "800 000 рублей"
    },
    "2e7yenidc1": {
      "status": "price",
      "price": "800 000 рублей"
    },
    "hs9lbp61h1": {
      "status": "price",
      "price": "800 000 рублей"
    },
    "ydpp232ud1": {
      "status": "price",
      "price": "800 000 рублей"
    },
    "mhdg7b4u11": {
      "status": "price",
      "price": "800 000 рублей"
    },
    "av64o84vs1": {
      "status": "price",
      "price": "1 000 000 рублей"
    },
    "9ln144o3g1": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "k0hxly5461": {
      "status": "not-for-sale",
      "label": "НЕ ПРОДАЁТСЯ"
    },
    "ra800122k1": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "culoz13ez1": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "7fmo5g4k61": {
      "status": "price",
      "price": "600 000 рублей"
    },
    "371ti0ens1": {
      "status": "price",
      "price": "600 000 рублей"
    }
  };
  const SERIES_NAMES={"БАЖОВСКИЕ СКАЗЫ":"СКАЗЫ БОЖОВА","СКАЗЫ БАЖОВА":"СКАЗЫ БОЖОВА","РУССКАЯ":"РУССКАЯ ДУША","БОЖОВСКИЕ СКАЗЫ":"СКАЗЫ БОЖОВА","СКАЗЫ БОЖОВА":"СКАЗЫ БОЖОВА","РУССКАЯ ДУША":"РУССКАЯ ДУША"};
  function canonicalSeries(series){return SERIES_NAMES[String(series||'').trim().toUpperCase()]||series;}
  function correctedMetadata(text){
    return String(text||'').replace(/\u0411[\u0410\u041e]\u0416\u041e\u0412\u0421\u041a\u0418\u0415 \u0421\u041a\u0410\u0417\u042b|\u0421\u041a\u0410\u0417\u042b \u0411[\u0410\u041e]\u0416\u041e\u0412\u0410/giu,name=>canonicalSeries(name))
      .replace(/(\u0441\u0435\u0440\u0438\u044f\s+)\u0420\u0423\u0421\u0421\u041a\u0410\u042f(?!\s+\u0414\u0423\u0428\u0410)/giu,(_,prefix)=>prefix+canonicalSeries('\u0420\u0423\u0421\u0421\u041a\u0410\u042f'));
  }
  function canonicalWork(work){const offer=AUTHOR_CONFIRMED_OFFERS[work.id];return {...work,...(offer?{currentPrice:offer.price||'',saleStatus:offer.status,saleLabel:offer.label||'',offerConfirmedAt:'2026-10-31'}:{}),series:canonicalSeries(work.series),short:correctedMetadata(work.short),fullText:String(work.fullText||'').split('\n').map((line,index)=>index===0?correctedMetadata(line):line).join('\n')};}
  async function init() {
    ensureDialog();
    $("#drawer-content").addEventListener("scroll",()=>dispatchEvent(new CustomEvent("gallery:work-context",{detail:dialogContext()})),{passive:true});
    $("#work-dialog").addEventListener("close",()=>dispatchEvent(new CustomEvent("gallery:work-context",{detail:dialogContext()})));
    $("#drawer-close").addEventListener("click",()=>$("#work-dialog").close());
    $("#work-dialog").addEventListener("click",event=>{if(event.target===$("#work-dialog"))$("#work-dialog").close();});
    const responses=await Promise.all([fetch("works.json"),fetch("media-map.json")]);
    if(responses.some(response=>!response.ok))throw new Error("Gallery data unavailable");
    [state.works,mediaMap]=await Promise.all(responses.map(response=>response.json()));
    state.works=state.works.map(canonicalWork);
    if(pendingEditorOpen){const request=pendingEditorOpen;pendingEditorOpen=null;openForEditor(request.id,request.options);}
    return {works:state.works,mediaMap};
  }
  function snapFactRules(){
   const dpr=window.devicePixelRatio||1;
   document.querySelectorAll('.drawer-meta-wrap .work-facts-rule').forEach(rule=>{
    rule.style.transform='none';const y=rule.getBoundingClientRect().top;
    rule.style.transform=`translateY(${Math.round(y*dpr)/dpr-y}px)`;
   });
  }
  if(typeof window!=='undefined')window.addEventListener('gallery:work-ready',()=>requestAnimationFrame(snapFactRules));
  if(typeof window!=='undefined')window.addEventListener('resize',()=>requestAnimationFrame(snapFactRules));
  if(typeof document!=='undefined')document.fonts.ready.then(()=>requestAnimationFrame(snapFactRules));
  
  if(typeof module==='object'&&module.exports)module.exports={workNarrative,narrativeMarkup,isArtworkImage,canonicalSeries,canonicalWork};
  if(typeof document==='undefined')return;
  const ready=init();
  ready.catch(error=>{console.error("Галерея:",error);dispatchEvent(new CustomEvent("gallery:works-error"));});
  window.GalleryArtwork={ready,open:openWork,openForEditor,dialogContext,restoreDialog,resolveMedia};
})();
