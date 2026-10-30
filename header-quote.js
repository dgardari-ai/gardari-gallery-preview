/* Two stable visual rows; author data is untouched by presentation formatting. */
(() => {
  'use strict';
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ru', {granularity: 'grapheme'}) : null;
  function graphemes(text) {
    if (segmenter) return Array.from(segmenter.segment(text), item => item.segment);
    // Keep combining marks, emoji modifiers and joined emoji intact in older engines.
    const result = [];
    for (const char of Array.from(text)) {
      const last = result.at(-1) || '';
      const regionalPair = /[\u{1F1E6}-\u{1F1FF}]/u.test(char)
        && /^[\u{1F1E6}-\u{1F1FF}]$/u.test(last);
      if (last && (/^[\p{M}\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}\u200D]$/u.test(char)
        || last.endsWith('\u200D') || regionalPair)) result[result.length - 1] += char;
      else result.push(char);
    }
    return result;
  }
  function displayText(source) {
    const text = String(source ?? '').replace(/\s+/gu, ' ').trim();
    if (!text) return '';
    return text.replace(/\p{L}/u, char => char.toLocaleUpperCase('ru'))
      .replace(/[.…]+$/u, '') + '…';
  }
  function twoRows(text, measure) {
    const letters = graphemes(text);
    if (letters.length < 2) return [text, ''];
    const breaks = [];
    // Retain the separating space at the end of row one: no glyph is discarded.
    for (let i = 1; i < letters.length; i++) if (letters[i - 1] === ' ') breaks.push(i);
    if (!breaks.length) for (let i = 1; i < letters.length; i++) breaks.push(i);
    let best = null;
    for (const at of breaks) {
      const rows = [letters.slice(0, at).join(''), letters.slice(at).join('')];
      const widths = rows.map(row => measure(row.trimEnd()));
      const score = [Math.max(...widths), Math.abs(widths[0] - widths[1]), Math.abs(letters.length / 2 - at)];
      if (!best || score[0] < best.score[0] - .01
        || (Math.abs(score[0] - best.score[0]) <= .01 && (score[1] < best.score[1] - .01
        || (Math.abs(score[1] - best.score[1]) <= .01 && score[2] < best.score[2])))) best = {rows, score};
    }
    return best.rows;
  }
  function visibleCount(length, elapsed, delay, speed, reduced) {
    if (reduced || speed <= 0) return length;
    return elapsed < delay ? 0 : Math.min(length, Math.floor((elapsed - delay) / speed) + 1);
  }
  function fontSteps(preferred, fixed) {
    const first = Math.max(7, Number(preferred) || 11);
    if (fixed) return [first];
    const sizes = [first];
    for (let size = first - .5; size > 7; size -= .5) sizes.push(size);
    if (first > 7) sizes.push(7);
    return sizes;
  }
  function fittingChoices(choices, fits) {
    const fitting = choices.filter(phrase => fits(displayText(phrase.text)));
    return fitting.length ? fitting : choices;
  }
  // Node tests exercise exactly the functions used below without a test-only DOM API.
  if (typeof module === 'object' && module.exports) module.exports = {graphemes, displayText, twoRows, visibleCount, fontSteps, fittingChoices};
  if (typeof document === 'undefined') return;

  const box = document.querySelector('#brand-quote');
  if (!box) return;
  const measure = box.querySelector('.quote-measure');
  const typed = box.querySelector('.quote-typed');
  const accessible = document.querySelector('#quote-accessible');
  if (!measure || !typed || !accessible) return;
  const phrases = window.GARDARI_GALLERY_QUOTES || [];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'gardari-gallery.last-quote';
  const {value, number} = window.GalleryCustomization;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let editorPhraseId = null, active = null, text = '', glyphs = [], visible = 0;
  let frame = null, animationStart = null, entry = 0, pending = false, fontsReady = false, lastId = null, layoutKey = '';

  function contentBox(style) {
    return {
      width: Math.max(0, box.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)),
      height: Math.max(0, box.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0))
    };
  }
  function measureWith(style) {
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if ('fontKerning' in context) context.fontKerning = style.fontKerning;
    if ('fontStretch' in context) context.fontStretch = style.fontStretch;
    const spacing = parseFloat(style.letterSpacing) || 0;
    const wordSpacing = parseFloat(style.wordSpacing) || 0;
    return line => context.measureText(line).width
      + Math.max(0, graphemes(line).length - 1) * spacing + (line.match(/ /g) || []).length * wordSpacing;
  }
  function fit() {
    box.style.fontFamily = value('quote:font', '"JetBrains Mono",monospace');
    box.style.fontWeight = value('quote:weight', '400');
    box.style.fontSize = Math.max(7, number('quote:fontSize', 11)) + 'px';
    let style = getComputedStyle(box);
    // CSS from the editor may override fields; measure the actual rendered type.
    const preferred = parseFloat(style.fontSize) || 11;
    const sizes = fontSteps(preferred, value('quote:fit', 'auto') === 'fixed');
    let plan;
    for (const size of sizes) {
      box.style.fontSize = size + 'px';
      style = getComputedStyle(box);
      const space = contentBox(style), width = measureWith(style), rows = twoRows(text, width);
      const rowHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.25;
      const overflowX = rows.some(row => width(row.trimEnd()) > space.width + .25);
      const overflowY = rowHeight * 2 > space.height + .25;
      const fits = !overflowX && !overflowY;
      plan = {rows, fits, overflowX, overflowY, size: style.fontSize, rowHeight};
      if (fits) break;
    }
    box.dataset.quoteFit = plan.fits ? 'fits' : 'overflow';
    box.dataset.quoteOverflowX = String(plan.overflowX);
    box.dataset.quoteOverflowY = String(plan.overflowY);
    box.tabIndex = plan.fits ? -1 : 0;
    box.title = plan.fits ? '' : text + ' · Фразу можно прокрутить';
    box.style.setProperty('--quote-row-height', plan.rowHeight + 'px');
    return plan;
  }
  function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
  function reveal(count) {
    for (let i = visible; i < count; i++) glyphs[i].style.visibility = 'visible';
    visible = count;
    box.dataset.quoteVisible = String(visible);
  }
  function finish() { stop(); reveal(glyphs.length); box.dataset.quoteState = 'complete'; }
  function buildRows(rows, preserved = 0) {
    const fragment = document.createDocumentFragment(), sample = document.createDocumentFragment();
    glyphs = [];
    for (const row of rows) {
      const line = document.createElement('span'); line.className = 'quote-line';
      const measured = document.createElement('span'); measured.className = 'quote-line'; measured.textContent = row;
      for (const letter of graphemes(row)) {
        const span = document.createElement('span'); span.className = 'quote-char';
        span.textContent = letter; span.style.visibility = 'hidden'; line.append(span); glyphs.push(span);
      }
      fragment.append(line); sample.append(measured);
    }
    typed.replaceChildren(fragment); measure.replaceChildren(sample); visible = 0;
    box.dataset.quoteLength = String(glyphs.length);
    reveal(Math.min(preserved, glyphs.length));
  }
  function render() {
    const plan = fit();
    const key = JSON.stringify([plan.rows, plan.size, plan.rowHeight]);
    if (key !== layoutKey) { buildRows(plan.rows, visible); layoutKey = key; }
  }
  function animate() {
    animationStart = null;
    if (motion.matches || number('quote:speed', 45) <= 0) { finish(); return; }
    box.dataset.quoteState = 'typing';
    function step(now) {
      frame = null;
      if (animationStart === null) animationStart = now;
      const count = visibleCount(glyphs.length, now - animationStart,
        Math.max(0, number('quote:delay', 140)), Math.max(0, number('quote:speed', 45)), motion.matches);
      if (count > visible) reveal(count);
      if (visible === glyphs.length) { box.dataset.quoteState = 'complete'; return; }
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }
  function choose() {
    if (!pending || !fontsReady || !box.clientWidth || !box.clientHeight) return;
    const mode = value('quote:mode', 'random');
    let choices = mode === 'custom' ? [{id: 'custom', text: value('quote:custom', ''), sourceUrl: ''}]
      : mode === 'fixed' ? phrases.filter(phrase => phrase.id === value('quote:selected', phrases[0]?.id))
      : editorPhraseId ? phrases.filter(phrase => phrase.id === editorPhraseId) : phrases;
    if (!choices.length) choices = phrases;
    if (!choices.length) return;
    // Keep the chosen type size: a random entry can choose a fitting excerpt
    // instead of making a longer one microscopic. Fixed/custom text stays whole.
    if (mode === 'random' && !editorPhraseId) {
      const style = getComputedStyle(box), space = contentBox(style), width = measureWith(style);
      const rowHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.25;
      choices = fittingChoices(choices, candidate => rowHeight * 2 <= space.height + .25
        && twoRows(candidate, width).every(row => width(row) <= space.width + .25));
    }
    let previous = lastId;
    try { previous = sessionStorage.getItem(storageKey) || previous; } catch {}
    const pool = choices.length > 1 ? choices.filter(phrase => phrase.id !== previous) : choices;
    active = pool[Math.floor(Math.random() * pool.length)];
    text = displayText(active.text); pending = false; lastId = active.id;
    try { sessionStorage.setItem(storageKey, active.id); } catch {}
    accessible.textContent = text;
    box.dataset.quoteId = active.id; box.dataset.quoteSource = active.sourceUrl || '';
    layoutKey = ''; visible = 0; render(); animate();
  }
  function refit() {
    if (active) render(); // Keep the RAF clock and revealed glyph count on resize/scroll.
    else choose();
  }
  function newEntry() {
    const token = ++entry;
    stop(); active = null; pending = true; fontsReady = false; layoutKey = ''; visible = 0;
    typed.replaceChildren(); measure.replaceChildren(); accessible.textContent = '';
    box.dataset.quoteState = 'waiting'; box.dataset.quoteVisible = '0';
    box.style.fontFamily = value('quote:font', '"JetBrains Mono",monospace');
    box.style.fontWeight = value('quote:weight', '400');
    box.style.fontSize = Math.max(7, number('quote:fontSize', 11)) + 'px';
    const style = getComputedStyle(box);
    const ready = document.fonts
      ? document.fonts.load(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, 'Искусство art').then(() => document.fonts.ready)
      : Promise.resolve();
    ready.catch(() => {}).then(() => { if (token !== entry) return; fontsReady = true; choose(); });
  }
  new ResizeObserver(refit).observe(box);
  document.fonts?.addEventListener('loadingdone', refit);
  motion.addEventListener('change', () => { if (motion.matches && active) finish(); });
  window.addEventListener('pagehide', stop);
  window.GalleryHeaderQuote = {newEntry, refit,
    selectForPreview(id) {
      if (value('quote:mode', 'random') !== 'random' || !phrases.some(phrase => phrase.id === id)) return;
      editorPhraseId = id;
      if (active?.id !== id) newEntry();
    }
  };
})();
