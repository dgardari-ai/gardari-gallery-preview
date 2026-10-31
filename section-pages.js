/* New sections use the Gallery intro renderer and the shared artwork drawer. */
(() => {
  'use strict';
  const MEDIA = {painting:'Живопись/графика',digital:'Digital',glass:'Стекло'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  function cardMetadata(work) {
    return [work.series].filter(value => value !== undefined && value !== null && String(value).trim()).map(String).join(' · ');
  }
  function chronology(work) {
    const publication=String(work.sourceDate || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    const year=String(work.year || '').match(/\b(\d{4})\b/);
    return {year:Number(year?.[1] || publication?.[1] || 0),publication:publication?Number(publication.slice(1).map(part=>part || '00').join('')):0};
  }
  function newestFirst(a,b) {
    const left=chronology(a),right=chronology(b);
    return right.year-left.year || right.publication-left.publication;
  }
  const PAINTING_ORDER=["8v2kpnezb1","x6nzcikfm1","2e7yenidc1","hs9lbp61h1","ydpp232ud1","mhdg7b4u11","4cnesafnt1","4oiaxe0i41","b9r2yoz1f1","6xsrtcc4e1","2j7ccv69g1","v06tb8rn01","okk93jjk01","bpjs3c0vb1","j82gnrdcj1","v7kehrcfx1","bvgoitm0i1","dtijeim4i1","7i5c09lto1","04e74o3lc1","bhdo0leni1","ux3yk4ct91","md61mn1pb1","yblsftiaz1","ndvkv44y71","0smycy7i41"];
  function worksForPage(works,page,series='all') {
    const rows=works.filter(work=>work.medium===MEDIA[page]&&(series==='all'||work.series===series)).sort(newestFirst);
    if(page!=='painting')return rows;
    const accepted=new Set(PAINTING_ORDER),byId=new Map(rows.map(work=>[work.id,work]));
    return [...rows.filter(work=>!accepted.has(work.id)),...PAINTING_ORDER.map(id=>byId.get(id)).filter(Boolean)];
  }
  function localHref(href) {
    const source=String(href ?? '');
    if(!source.trim())return '';
    if (/^(?:index|gallery|painting|digital|glass|artist)\.html(?:[?#].*)?$/.test(source) || /^#[A-Za-zА-Яа-яЁё0-9_-]+$/.test(source)) return source;
    const routes={'/':'index.html','/gallery':'gallery.html','/art_gardari':'painting.html','/digital_art':'digital.html','/glass_art':'glass.html','/obo-mne':'artist.html'};
    try {
      const url=new URL(source,'https://gardari.art/');
      if (!['http:','https:','mailto:','tel:'].includes(url.protocol)) return '';
      if (['gardari.art','www.gardari.art'].includes(url.hostname) && routes[url.pathname.replace(/\/$/,'') || '/']) return routes[url.pathname.replace(/\/$/,'') || '/']+url.hash;
      return source.startsWith('https://') || source.startsWith('http://') || source.startsWith('mailto:') || source.startsWith('tel:') ? source : url.href;
    } catch { return ''; }
  }
  if (typeof module === 'object' && module.exports) module.exports={MEDIA,PAINTING_ORDER,cardMetadata,chronology,newestFirst,worksForPage,localHref,esc};
  if (typeof document === 'undefined') return;
  const page=document.body.dataset.page;
  const data=window.GARDARI_SECTION_PAGES?.[page];
  if (!data?.slides?.length) {
    document.querySelector('#gallery-layout').innerHTML='<p class="section-error" role="status">Материалы раздела пока недоступны.</p>';
    return;
  }
  const {value,crop}=window.GalleryCustomization;
  window.GARDARI_GALLERY_SECTION={...data,slides:data.slides};
  const title=document.querySelector('#page-title');
  title.textContent=value(`gallery:${data.slides[0].id}:title`,data.title);
  document.querySelector('.matrix-frame').setAttribute('aria-label',data.title);

  // Reuse the current Gallery's authored typography without rewriting its fields.
  const styles=window.GARDARI_GALLERY_SETTINGS?.styles || {};
  const heading=styles['gallery-title-space']?.all || {};
  const inherited={'font-family':'--section-heading-font','font-size':'--section-heading-size','font-weight':'--section-heading-weight','line-height':'--section-heading-line','letter-spacing':'--section-heading-tracking'};
  for(const [property,variable] of Object.entries(inherited)) if(heading[property]) document.body.style.setProperty(variable,heading[property]);

  const details=document.querySelector('#section-details');
  details.innerHTML=(data.details || []).filter(item=>!(page==='digital' && item.id==='digital-technology')).map((item,index)=>{
    const id=item.id || String(index),prefix=`page:${page}:detail:${id}:`;
    return `<details class="section-disclosure" data-detail="${esc(id)}"><summary>${esc(value(prefix+'title',item.title))}</summary><div>${item.heading?`<h3>${esc(value(prefix+'heading',item.heading))}</h3>`:''}${value(prefix+'paragraphs',item.paragraphs || []).map(text=>`<p>${esc(text)}</p>`).join('')}</div></details>`;
  }).join('');
  details.hidden=!details.childElementCount;

  const books=document.querySelector('#artist-books');
  const bookItems=data.booksHidden?[]:(data.books || []);
  books.innerHTML=(bookItems.length?`<h2 class="section-block-title" id="artist-books-title">${esc(value('page:artist:booksTitle',data.booksTitle || ''))}</h2>`:'')+bookItems.map((book,index)=>{
    const id=book.id || String(index),prefix=`page:artist:book:${id}:`,image=book.image || {};
    const name=value(prefix+'title',book.title),href=localHref(value(prefix+'href',book.href || book.url)),label=value(prefix+'linkLabel',book.linkLabel || book.title);
    const paragraphs=value(prefix+'paragraphs',book.paragraphs || (book.description ? [book.description] : []));
    const source=value(prefix+'image',image.src || ''),alt=value(prefix+'alt',image.alt || name);
    return `<article class="artist-book" data-book="${esc(id)}"><figure class="artist-book-cover">${source?`<img src="${esc(source)}" alt="${esc(alt)}" loading="lazy" decoding="async"${image.width?` width="${image.width}" height="${image.height}"`:''}>`:''}</figure><div class="artist-book-copy"><h3>${esc(name)}</h3>${paragraphs.map(text=>`<p>${esc(text)}</p>`).join('')}${href?`<a class="filter-btn artist-book-link" href="${esc(href)}"${/^https?:\/\//.test(href)?' target="_blank" rel="noopener noreferrer"':''}>${esc(label)}</a>`:''}</div></article>`;
  }).join('');
  books.hidden=!books.childElementCount;
  const links=document.querySelector('#artist-links');
  links.innerHTML=(data.links || []).map((link,index)=>{
    if(link.hidden)return '';
    const prefix=`page:artist:link:${index}:`,href=localHref(value(prefix+'href',link.href || link.url));
    return href?`<a class="filter-btn" data-artist-link="${index}" href="${esc(href)}"${/^https?:\/\//.test(href)?' target="_blank" rel="noopener noreferrer"':''}>${esc(value(prefix+'label',link.label))}</a>`:'';
  }).join('');
  links.hidden=!links.childElementCount;

  const catalog=document.querySelector('#section-catalog');
  catalog.hidden=!Object.hasOwn(MEDIA,page);
  const artistGallery=document.querySelector('#artist-work-gallery'),selection=data.workGallery;
  artistGallery.hidden=!(page==='artist' && selection);
  if(page==='artist'&&selection){artistGallery.innerHTML='<div class="work-matrix artist-orb-matrix section-orb-matrix" id="artist-work-matrix" aria-label="'+esc(data.title)+'" aria-busy="true"></div>';links.replaceChildren();links.hidden=true;return;}
  if(catalog.hidden && artistGallery.hidden)return;
  const grid=document.querySelector('#works-grid'),filters=document.querySelector('#series-filters');
  let activeSeries='all',works=[];
  function renderCards(host,selected) {
    const ids=selected.map(work=>work.id);
    host.replaceChildren();
    for(const work of selected) {
      const button=document.createElement('button');button.type='button';button.className='work-card';button.dataset.work=work.id;
      button.setAttribute('aria-label',`Открыть произведение «${work.title}»`);
      const preview=value(`preview:${work.id}:image`,work.cover || work.images?.[0]?.url || '');
      const metadata=cardMetadata(work);
      button.innerHTML=`<span class="work-card-visual"><img src="${esc(window.GalleryArtwork.resolveMedia(preview))}" alt="${esc(work.title)}" loading="lazy" decoding="async"></span><span class="work-card-copy"><span class="work-card-title">${esc(work.title)}</span>${metadata?`<span class="work-card-label">${esc(metadata)}</span>`:''}</span>`;
      button.addEventListener('click',()=>window.GalleryArtwork.open(work.id,{ids}));
      host.append(button);crop(button.querySelector('img'),work.id);
    }
    host.setAttribute('aria-busy','false');
    host.dataset.workCount=String(selected.length);
    return ids;
  }
  function render() {
    const selected=worksForPage(works,page,activeSeries),ids=renderCards(grid,selected);
    dispatchEvent(new CustomEvent('gallery:catalog-rendered',{detail:{page,series:activeSeries,ids}}));
  }
  window.GalleryArtwork.ready.then(result=>{
    works=result.works;
    if(!catalog.hidden) {
      filters.closest('.catalog-tools').hidden=true;
      filters.replaceChildren();
      render();
    }
  }).catch(()=>{const host=catalog.hidden?artistGallery:grid;host.innerHTML='<p class="section-error" role="status">Не удалось загрузить произведения. Обновите страницу.</p>';host.setAttribute('aria-busy','false');});
})();
