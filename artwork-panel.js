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

  function openWork(id, options = {}) {
    if (Array.isArray(options.ids)) state.visible = options.ids.map(id => state.works.find(work => work.id === id)).filter(Boolean);
    const w = state.works.find((v) => v.id === id);
    if (!w) return false;
    currentWorkId = w.id;
    const currentList = state.visible.some((v) => v.id === id)
      ? state.visible : state.works.filter((v) => v.medium === w.medium);
    const index = currentList.findIndex((v) => v.id === id) + 1;
    $("#work-counter").textContent = String(index).padStart(2,"0") + "/" + String(currentList.length).padStart(2,"0");
    const fields = [
      ["НАПРАВЛЕНИЕ", w.medium], ["СЕРИЯ", w.series], ["ГОД", w.year],
      ["ТЕХНИКА", w.technique], ["РАЗМЕР", w.dimensions],
      ["ТИРАЖ", w.edition], ["РАЗМЕР / ЦЕНА", w.sizePrices],
      ["ЦЕНА", w.historicalPrice]
    ].filter((entry) => entry[1]);
    const galleryImages = (w.images || []).filter(isArtworkImage);
    const coverUrl = w.cover || galleryImages[0]?.url || "";
    const additionalImages = galleryImages.filter((img) => img.url !== coverUrl);
    const description = workNarrative(w);
    const recommendations = currentList.filter((item) => item.id !== w.id);
    const otherWorks = recommendations.length ? recommendations : state.works.filter((item) => item.medium === w.medium && item.id !== w.id);
    const next = otherWorks[Math.floor(Math.random() * otherWorks.length)];
    $("#drawer-content").innerHTML = `
      <img class="drawer-cover" src="${safeHref(coverUrl)}" alt="${esc(w.title)}"${imageDimensions(galleryImages.find(image=>image.url===coverUrl))}>
      <h2 class="drawer-title" id="work-title">${esc(w.title)}</h2>
      <div class="drawer-kicker">${esc(w.series || w.medium)}</div>
      <div class="drawer-meta-wrap"><span class="work-facts-rule" id="work-facts-top" aria-hidden="true"></span><dl class="drawer-meta">${fields.map(([label, value])=>`<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join("")}</dl><span class="work-facts-rule work-facts-rule--bottom" id="work-facts-bottom" aria-hidden="true"></span></div>
      ${description ? `<div class="drawer-story">${narrativeMarkup(description)}</div>` : ""}
      ${additionalImages.length ? `<div class="drawer-gallery">${additionalImages.map((img)=>`<img loading="lazy" decoding="async" src="${safeHref(img.url)}" alt="${esc(w.title)} — дополнительное изображение"${imageDimensions(img)}>`).join("")}</div>` : ""}
      ${next ? `<button class="drawer-next" type="button" data-next-work="${esc(next.id)}" aria-label="Открыть другую работу: ${esc(next.title)}"><span>ДРУГАЯ РАБОТА · ${esc(next.title)}</span><span aria-hidden="true">↗</span></button>` : ""}`;
    $("#drawer-content [data-next-work]")?.addEventListener("click", () => openWork(next.id));
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
  const SERIES_NAMES={"БАЖОВСКИЕ СКАЗЫ":"СКАЗЫ БОЖОВА","СКАЗЫ БАЖОВА":"СКАЗЫ БОЖОВА","РУССКАЯ":"РУССКАЯ ДУША","БОЖОВСКИЕ СКАЗЫ":"СКАЗЫ БОЖОВА","СКАЗЫ БОЖОВА":"СКАЗЫ БОЖОВА","РУССКАЯ ДУША":"РУССКАЯ ДУША"};
  function canonicalSeries(series){return SERIES_NAMES[String(series||'').trim().toUpperCase()]||series;}
  function correctedMetadata(text){
    return String(text||'').replace(/\u0411[\u0410\u041e]\u0416\u041e\u0412\u0421\u041a\u0418\u0415 \u0421\u041a\u0410\u0417\u042b|\u0421\u041a\u0410\u0417\u042b \u0411[\u0410\u041e]\u0416\u041e\u0412\u0410/giu,name=>canonicalSeries(name))
      .replace(/(\u0441\u0435\u0440\u0438\u044f\s+)\u0420\u0423\u0421\u0421\u041a\u0410\u042f(?!\s+\u0414\u0423\u0428\u0410)/giu,(_,prefix)=>prefix+canonicalSeries('\u0420\u0423\u0421\u0421\u041a\u0410\u042f'));
  }
  function canonicalWork(work){return {...work,series:canonicalSeries(work.series),short:correctedMetadata(work.short),fullText:String(work.fullText||'').split('\n').map((line,index)=>index===0?correctedMetadata(line):line).join('\n')};}
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
  if(typeof module==='object'&&module.exports)module.exports={workNarrative,narrativeMarkup,isArtworkImage,canonicalSeries,canonicalWork};
  if(typeof document==='undefined')return;
  const ready=init();
  ready.catch(error=>{console.error("Галерея:",error);dispatchEvent(new CustomEvent("gallery:works-error"));});
  window.GalleryArtwork={ready,open:openWork,openForEditor,dialogContext,restoreDialog,resolveMedia};
})();
