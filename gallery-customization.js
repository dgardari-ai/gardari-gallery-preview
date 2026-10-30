/* Source-owned settings; the editor changes data, never the original photographs. */
(() => {
  'use strict';
  const fields = window.GARDARI_GALLERY_SETTINGS?.fields || {};
  const value = (key, fallback) => fields[key] ?? fallback;
  const number = (key, fallback) => Number(value(key, fallback));
  const root = document.documentElement.style;
  const dimensions = {
    'header:tileSize': ['--tile-size', 55.066667],
    'header:sideInset': ['--header-side-inset', 8.26],
    'header:partGap': ['--header-part-gap', 8],
    'header:tabGap': ['--header-tab-gap', 4],
    'header:matrixGap': ['--header-gap', 33],
    'header:badgeSize': ['--badge-size', 21.84],
    'header:topOffset': ['--matrix-top-offset', 190],
    'matrix:circleSize': ['--work-circle-size', 107.1225],
    'section:menuTop': ['--section-menu-top', 20],
    'section:columnGap': ['--section-column-gap', 70]
  };
  for (const [key, [property, fallback]] of Object.entries(dimensions))
    root.setProperty(property, number(key, fallback) + 'px');
  root.setProperty('--logo-scale', number('header:logoScale', 42) + '%');
  const sectionShare=number('section:leftShare',50);
  root.setProperty('--section-left-column',sectionShare+'fr');
  root.setProperty('--section-right-column',(100-sectionShare)+'fr');

  function crop(image, workId) {
    const prefix = 'preview:' + workId + ':';
    const viewport = image.closest('.work-orb-viewport') || image.parentElement;
    const fit = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      // Crop against the actual content box: authored padding can make it non-square.
      const frameRatio = viewport.clientWidth / Math.max(1, viewport.clientHeight);
      image.style.width = Math.max(100, ratio / frameRatio * 100) + '%';
      image.style.height = Math.max(100, frameRatio / ratio * 100) + '%';
      image.style.left = (50 + number(prefix + 'x', 0)) + '%';
      image.style.top = (50 + number(prefix + 'y', 0)) + '%';
      image.style.transform = `translate(-50%, -50%) scale(${number(prefix + 'zoom', 100) / 100})`;
    };
    image.addEventListener('load', fit, {once: true});
    const observer = new ResizeObserver(() => {
      if (image.isConnected) fit(); else observer.disconnect();
    });
    observer.observe(viewport);
    fit();
  }
  window.GalleryCustomization = {value, number, crop};
})();
