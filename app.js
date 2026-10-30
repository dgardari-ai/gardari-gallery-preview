/* Shared Home/Artist orb matrix and full-work panel. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const artist=document.body.dataset.page==='artist',matrix=$ (artist?'#artist-work-matrix':'#work-matrix');
  if(!matrix)return;
  const state = {works: [], visible: [], order: [], columns: 0};
  let mediaMap = {};
  const settings = window.GalleryCustomization;
  const value = settings.value, number = settings.number;
  let editorOrder = null;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const safeHref = (value) => {
    try {
      const url = new URL(mediaMap[value] || value, location.href);
      return ["http:", "https:"].includes(url.protocol) ? esc(url.href) : "#";
    } catch { return "#"; }
  };

  function shuffled(works) {
    const result = [...works];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function renderMatrix(newEntry = false) {
    if (!state.works.length) return;

    if (newEntry || !state.order.length) state.order = editorOrder ? editorOrder.map(id=>state.works.find(w=>w.id===id)).filter(Boolean) : shuffled(state.works);
    const diameter = parseFloat(getComputedStyle(matrix).getPropertyValue("--work-circle-size"));
    const columns = artist?5:Math.max(1, Math.min(
      Math.floor($(".matrix-frame").getBoundingClientRect().width / diameter),
      Math.floor(state.works.length / number("matrix:rows",5))
    ));
    if (!newEntry && columns === state.columns) return;
    state.columns = columns;
    if(!artist)$("#matrix-pack").style.setProperty("--matrix-columns", String(columns));
    state.visible = state.order.slice(0, columns * (artist?2:number("matrix:rows",5)));
    matrix.innerHTML = state.visible.map((work) => `<button type="button" class="work-orb" data-work="${esc(work.id)}" aria-label="Открыть произведение «${esc(work.title)}»">
      <span class="work-orb-viewport"><img src="${safeHref(value(`preview:${work.id}:image`,work.cover))}" alt="" decoding="async"></span>
    </button>`).join("");
    matrix.querySelectorAll("[data-work]").forEach(button=>settings.crop(button.querySelector("img"),button.dataset.work));
    matrix.setAttribute("aria-busy", "false");
    window.dispatchEvent(new CustomEvent("gallery:rendered"));
    matrix.querySelectorAll("[data-work]").forEach((button) => button.addEventListener("click", () => openWork(button.dataset.work)));
    if (newEntry&&!artist) window.GalleryHeaderQuote?.newEntry();
    else window.GalleryHeaderQuote?.refit();
  }

  const openWork=(id,options={})=>window.GalleryArtwork.open(id,{ids:state.visible.map(work=>work.id),...options});
  const dialogContext=()=>window.GalleryArtwork.dialogContext();
  const openForEditor=(id=null,options={})=>window.GalleryArtwork.openForEditor(id,options);


  async function init() {
    try {
      const data=await window.GalleryArtwork.ready;
      state.works=data.works;mediaMap=data.mediaMap;
      if(editorOrder&&(editorOrder.length!==state.works.length||editorOrder.some(id=>!state.works.some(w=>w.id===id))))editorOrder=null;
      renderMatrix(true);
    } catch (error) {
      console.error("Галерея:", error);
      matrix.innerHTML = '<p class="matrix-error">Не удалось загрузить произведения. Обновите страницу.</p>';
      matrix.setAttribute("aria-busy", "false");
    }
    let layoutPending = false;
    new ResizeObserver(() => {
      if ($("#work-dialog").open) { layoutPending = true; return; }
      renderMatrix();
    }).observe(artist?$("#artist-work-gallery"):$(".matrix-frame"));
    $("#work-dialog").addEventListener("close", () => {
      if (!layoutPending) return;
      layoutPending = false;
      renderMatrix();
    });
  }
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !state.works.length) return;
    if ($("#work-dialog").open) $("#work-dialog").close();
    editorOrder=null;state.columns=0;renderMatrix(true);
  });
  window[artist?"GalleryArtistMatrix":"GalleryMatrix"] = {
    openForEditor,
    dialogContext,
    restoreDialog: value=>window.GalleryArtwork.restoreDialog(value),
    order: () => state.order.length?state.order.map(w=>w.id):(artist&&editorOrder?[...editorOrder]:[]),
    revealWork(id) {
      if (state.visible.some(w=>w.id===id)) return;
      const index=state.order.findIndex(w=>w.id===id);
      if(index<0)return;
      [state.order[0],state.order[index]]=[state.order[index],state.order[0]];
      editorOrder=state.order.map(w=>w.id);
      state.columns=0;renderMatrix();
    },
    restoreOrder(ids) {
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return;
      if (state.works.length && (ids.length!==state.works.length || ids.some(id=>!state.works.some(w=>w.id===id)))) return;
      editorOrder=ids;
      if (state.works.length) { state.order=ids.map(id=>state.works.find(w=>w.id===id));state.columns=0;renderMatrix(); }
    }
  };
  init();
})();
