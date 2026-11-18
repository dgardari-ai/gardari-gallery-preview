/* Full-document navigation keeps native links, including open in a new tab. */
(() => {
  "use strict";
  const site = new URL(".", document.currentScript.src);
  const context = new URLSearchParams(location.search);
  const contextKeys = ["editor_view", "tablet_preview"].filter(name => context.has(name));
  // The author's editor adopts only the seven section routes in its canvas.
  // Open a work as a standalone document from its interactive preview.
  const editorCanvas = context.has("editor_view") && frameElement?.id === "preview"
    && !!frameElement.closest(".device-shell");
  const catalogId = /^#work-([a-z0-9]+)$/.exec(location.hash)?.[1];
  const historyTraversal = performance.getEntriesByType("navigation")[0]?.type === "back_forward";
  const entry = () => history.state?.galleryWorkSource;
  let returning = historyTraversal ? entry() : null;
  let restored = false;

  function contextualLink(value, base) {
    const url = new URL(value, base);
    for (const name of contextKeys) url.searchParams.set(name, context.get(name));
    return url.href;
  }

  function href(id) {
    const path = window.GalleryWorkRoutes.path(id);
    return path ? contextualLink(path, site) : "";
  }

  if (contextKeys.length && document.body.hasAttribute("data-artwork-page")) {
    document.querySelectorAll(".work-return, a[data-related-work]").forEach(link => {
      link.href = contextualLink(link.href, location.href);
    });
  }

  // Explicit visits to a catalog card use the card's fragment. Browser Back
  // uses the actual source link, even when it was a randomly chosen circle.
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[data-work], a[data-related-work]");
    if (!link || link.target && link.target !== "_self") return;
    const id = link.dataset.work || link.dataset.relatedWork;
    if (!href(id) || new URL(link.href).pathname !== new URL(href(id)).pathname) return;
    history.replaceState({...history.state, galleryWorkSource: {
      id,
      offset: link.getBoundingClientRect().top,
      order: (window.GalleryMatrix || window.GalleryArtistMatrix)?.order()
    }}, "");
    restored = false;
  });

  async function restore() {
    const id = returning?.id || catalogId;
    if (!id || restored || document.readyState !== "complete" || !window.GalleryWorkRoutes.path(id)) return;
    const key = CSS.escape(id);
    const link = document.querySelector(`a[data-work="${key}"], a[data-related-work="${key}"]`);
    if (!link || link.closest('[aria-busy="true"]')) return;
    restored = true;
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!link.isConnected) {
      restored = false;
      return restore();
    }
    const header = window.GalleryHeaderMotion?.metrics();
    const artworkMenu = document.querySelector(".artwork-page .matrix-header");
    const menuStyle = artworkMenu && getComputedStyle(artworkMenu);
    const clearance = header?.fixedRail ?? (menuStyle?.position === "sticky"
      ? artworkMenu.offsetHeight + parseFloat(menuStyle.top) + parseFloat(menuStyle.getPropertyValue("--work-sticky-gutter"))
      : 24);
    const offset = returning ? Math.max(clearance, returning.offset) : clearance;
    scrollTo({top: Math.max(0, scrollY + link.getBoundingClientRect().top - offset), behavior: "instant"});
    link.focus({preventScroll:true});
  }

  addEventListener("pageshow", event => {
    if (event.persisted) returning = entry();
    restore();
  });
  for (const type of ["gallery:rendered", "gallery:catalog-rendered", "gallery:catalog-fallback"]) {
    addEventListener(type, restore);
  }

  window.GalleryWorkNavigation = {
    href,
    editorCanvas,
    catalogId,
    isReturn: event => !!(returning || event?.persisted && entry() || catalogId),
    matrixOrder: () => returning?.order
  };
})();
