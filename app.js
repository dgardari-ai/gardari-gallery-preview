/* Shared Home/Artist orb matrix, with links to the artwork pages. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const artist=document.body.dataset.page==='artist',matrix=$ (artist?'#artist-work-matrix':'#work-matrix');
  if(!matrix)return;
  const state = {works: [], visible: [], order: [], columns: 0, rows: 0, diameter: 0};
  let mediaMap = {};
  const settings = window.GalleryCustomization;
  const value = settings.value, number = settings.number;
  let editorOrder = window.GalleryWorkNavigation?.matrixOrder() || null;
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
    const tablet = !artist && window.GalleryTablet?.active;
    const diameter = tablet ? $(".matrix-frame").getBoundingClientRect().width / 5 : parseFloat(getComputedStyle(matrix).getPropertyValue("--work-circle-size"));
    if (tablet) matrix.style.setProperty('--tablet-orb-size', diameter + 'px');
    const columns = tablet?5:artist?5:Math.max(1, Math.min(
      Math.floor(($(".matrix-frame").getBoundingClientRect().width + .01) / diameter),
      state.works.length ? Math.floor(state.works.length / number("matrix:rows",5)) : Infinity
    ));
    // The menu shares its width with the artwork grid, even when data are unavailable.
    if (!state.works.length) {
      if (!artist) $("#matrix-pack").style.setProperty("--matrix-columns", String(columns));
      return;
    }
    if (newEntry || !state.order.length) state.order = editorOrder ? editorOrder.map(id=>state.works.find(w=>w.id===id)).filter(Boolean) : shuffled(state.works);
    const rows = tablet ? Math.max(1, Math.min(Math.floor(state.works.length / 5), Math.ceil((innerHeight - (matrix.getBoundingClientRect().top + scrollY)) / diameter))) : (artist ? 2 : number("matrix:rows",5));
    if (!newEntry && columns === state.columns && rows === state.rows && Math.abs(diameter-state.diameter) < .01) return;
    state.rows = rows; state.diameter = diameter;
    state.columns = columns;
    if(!artist)$("#matrix-pack").style.setProperty("--matrix-columns", String(columns));
    state.visible = state.order.slice(0, columns * rows);
    const workNavigation = window.GalleryWorkNavigation;
    const linkTarget = workNavigation?.editorCanvas ? ' target="_blank" rel="noopener"' : '';
    matrix.innerHTML = state.visible.map(work => {
      const href = workNavigation?.href(work.id);
      const tag = href ? "a" : "button";
      const source = safeHref(value(`preview:${work.id}:image`,work.cover));
      return `<${tag} ${href ? `href="${esc(href)}"${linkTarget}` : 'type="button"'} class="work-orb" data-work="${esc(work.id)}" aria-label="Открыть произведение «${esc(work.title)}» · ${esc(work.medium)}">
        <span class="work-orb-viewport"><img${window.GalleryImages.attributes(source,"orb")} src="${source}" alt="" decoding="async"></span>
      </${tag}>`;
    }).join("");
    matrix.querySelectorAll("[data-work]").forEach(link=>settings.crop(link.querySelector("img"),link.dataset.work));
    matrix.setAttribute("aria-busy", "false");
    window.dispatchEvent(new CustomEvent("gallery:rendered"));
    matrix.querySelectorAll("button[data-work]").forEach(button => button.addEventListener("click", () => openWork(button.dataset.work)));
    if (newEntry&&!artist) window.GalleryHeaderQuote?.newEntry();
    else window.GalleryHeaderQuote?.refit();
  }

  const openWork=(id,options={})=>window.GalleryArtwork.open(id,{ids:state.visible.map(work=>work.id),...options});
  const dialogContext=()=>window.GalleryArtwork.dialogContext();
  const openForEditor=(id=null,options={})=>window.GalleryArtwork.openForEditor(id,options);


  async function init() {
    renderMatrix();
    let layoutPending = false;
    function updateLayout() {
      if ($("#work-dialog")?.open) { layoutPending = true; return; }
      renderMatrix();
    }
    new ResizeObserver(updateLayout).observe(artist?$("#artist-work-gallery"):$(".matrix-frame"));
    if (!artist) addEventListener("resize", updateLayout);
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
    $("#work-dialog").addEventListener("close", () => {
      if (!layoutPending) return;
      layoutPending = false;
      renderMatrix();
    });
  }
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !state.works.length || window.GalleryWorkNavigation?.isReturn(event)) return;
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
