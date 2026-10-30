/* VMG Designer document renderer. Shared by standalone sites and editor previews. */
(function () {
  'use strict';
  if (window.VMGDesignerRuntime) return;
  const ownScript=document.currentScript;
  const publicBase=new URL(ownScript?.dataset.vmgSiteRoot||'.', ownScript?.dataset.vmgSiteRoot?location.href:ownScript?.src||location.href);
  const empty = () => ({schema:1,overrides:{},nodes:[],moves:[],removed:[],assets:[],sharedStyles:{},components:{}});
  const allowedTags = new Set('div span p h1 h2 h3 h4 h5 h6 section article aside header footer main nav figure figcaption img picture source a button ul ol li dl dt dd blockquote pre code strong em b i u s small sub sup br hr table thead tbody tfoot tr th td details summary dialog video audio svg g path rect circle ellipse line polyline polygon'.split(' '));
  const svgTags=new Set('svg g path rect circle ellipse line polyline polygon'.split(' '));
  const fingerprint=el=>{let h=2166136261;for(const c of (el.textContent||'').replace(/\s+/g,' ').trim()){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return el.localName+':'+(h>>>0).toString(16).padStart(8,'0');};
  const denied = new Set(['script','style','iframe','object','embed','form','input','textarea','select','link','meta','base']);
  const bindings = new Map(), originals = new Map(), anchors = new Map(), refFailures=new Map(), bindingContexts=new Map(), styleBindings=new Map();
  let data=empty(), applying=false, observer, scheduled=false, forceState='', errors=[], sheet;
  const cssEscape = value => window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  function page() {
    let path=decodeURIComponent(location.pathname);
    if(path.startsWith(publicBase.pathname))path=path.slice(publicBase.pathname.length);
    return path || 'index.html';
  }
  function onPage(route) { return !route || route==='*' || route===page(); }
  function safeURL(value) {
    if(typeof value!=='string'||/[\u0000-\u0020]/.test(value))return false;
    return !/^(?:javascript|vbscript|data|file|blob):/i.test(value) && !/^\/\//.test(value);
  }

  function captureContext(el,ref){
    const contexts=[];
    for(const match of (ref?.selector||'').matchAll(/\[(data-[\w-]+)\s*(?:[~|^$*]?=)\s*["']([^"']*)["']\]/g)){
      for(let owner=el;owner;owner=owner.parentElement){if(owner.hasAttribute?.(match[1])){contexts.push({owner,name:match[1],value:owner.getAttribute(match[1])});break;}}
    }
    return contexts;
  }
  function releaseBinding(id,el){
    const anchor=anchors.get(el);
    if(anchor){if(anchor.isConnected)anchor.replaceWith(el);else el.remove();anchors.delete(el);}
    const original=originals.get(el);
    if(original){for(const [key,value]of original.applied||[]){if(el.getAttribute(key)===value){const before=original.attrs.get(key);if(before===null||before===undefined)el.removeAttribute(key);else el.setAttribute(key,before);}}
      if(el.dataset.vmgHidden==='true'&&el.style.getPropertyValue('display')==='none'&&el.style.getPropertyPriority('display')==='important'){if(original.display)el.style.setProperty('display',original.display,original.displayPriority);else el.style.removeProperty('display');}}
    if(el.dataset.vmgObject===id){delete el.dataset.vmgObject;delete el.dataset.vmgName;delete el.dataset.vmgHidden;delete el.dataset.vmgLocked;delete el.dataset.vmgAction;delete el.dataset.vmgForceState;}
    const owner=styleBindings.get(id);if(owner){const ids=(owner.dataset.vmgStyleObject||'').split(' ').filter(key=>key&&key!==id);if(ids.length)owner.dataset.vmgStyleObject=ids.join(' ');else delete owner.dataset.vmgStyleObject;}
    styleBindings.delete(id);bindings.delete(id);bindingContexts.delete(id);originals.delete(el);
  }
  function resolve(ref) {
    if(!ref||!onPage(ref.route))return null;
    if(typeof ref==='string')ref={id:ref};
    if(ref.id){const bound=bindings.get(ref.id);if(bound&&!bound.isConnected){bindings.delete(ref.id);bindingContexts.delete(ref.id);styleBindings.delete(ref.id);originals.delete(bound);const anchor=anchors.get(bound);anchor?.remove();anchors.delete(bound);}if(bound?.isConnected){const context=bindingContexts.get(ref.id)||[];if(context.every(item=>item.owner.isConnected&&item.owner.getAttribute(item.name)===item.value))return bound;releaseBinding(ref.id,bound);}const found=document.querySelector('[data-vmg-object="'+cssEscape(ref.id)+'"]');if(found)return found;}
    if(ref.selector){try{const candidate=document.querySelectorAll(ref.selector)[Number(ref.index)||0]||null;if(candidate&&ref.guard&&fingerprint(candidate)!==ref.guard){refFailures.set(JSON.stringify(ref),'guard');return null;}refFailures.delete(JSON.stringify(ref));return candidate;}catch{return null;}}
    return null;
  }
  function remember(el) {
    if(originals.has(el))return;
    originals.set(el,{html:null,children:[...el.childNodes],contentChanged:false,attrs:new Map(),applied:new Map(),display:el.style.getPropertyValue('display'),displayPriority:el.style.getPropertyPriority('display')});
  }
  function attr(el,key,value) {
    if(/^on/i.test(key)||['srcdoc'].includes(key))return;
    if(!/^(?:viewbox|d|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|points|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|fill-rule|clip-rule|xmlns|style|id|class|title|href|target|rel|alt|src|width|height|role|type|tabindex|disabled|hidden|autoplay|preload|decoding|colspan|rowspan|scope|aria-[\w-]+|data-[\w-]+|loading|controls|loop|muted|poster|open)$/.test(key))return;
    if(['href','src','poster'].includes(key)&&value&&!safeURL(String(value)))return;
    if((key==='style'||key==='fill'||key==='stroke')&&/(?:url\s*\(|expression\s*\(|@import|[<>])/i.test(String(value)))return;
    if(key==='viewbox')key='viewBox';
    remember(el);const saved=originals.get(el).attrs;if(!saved.has(key))saved.set(key,el.getAttribute(key));originals.get(el).applied.set(key,value===null||value===false?null:value===true?'':String(value));
    if(value===null||value===false){if(el.hasAttribute(key))el.removeAttribute(key);}else{const next=value===true?'':String(value);if(el.getAttribute(key)!==next)el.setAttribute(key,next);}

  }
  function cleanHTML(html) {
    const template=document.createElement('template');template.innerHTML=String(html||'');
    for(const el of [...template.content.querySelectorAll('*')]){
      if(denied.has(el.localName)){el.remove();continue;}
      if(!allowedTags.has(el.localName)){el.replaceWith(...el.childNodes);continue;}
      for(const a of [...el.attributes]){
        if(/^on/i.test(a.name)||['srcdoc'].includes(a.name)||(['style','fill','stroke'].includes(a.name)&&/(?:url\s*\(|expression\s*\(|@import|[<>])/i.test(a.value))||(['src','href','poster'].includes(a.name)&&!safeURL(a.value)))el.removeAttribute(a.name);
      }
    }
    return template.innerHTML;
  }
  function applyObject(el,obj,id) {
    if(!el)return;
    remember(el);if(id){el.dataset.vmgObject=id;bindings.set(id,el);}
    if(obj.name)el.dataset.vmgName=obj.name;
    if(obj.html!==undefined){const original=originals.get(el);if(original.html===null)original.html=el.innerHTML;original.contentChanged=true;const html=cleanHTML(obj.html);if(el.innerHTML!==html)el.innerHTML=html;}
    if(obj.text!==undefined){const original=originals.get(el);if(original.html===null)original.html=el.innerHTML;original.contentChanged=true;if(el.textContent!==String(obj.text))el.textContent=String(obj.text);}
    for(const [key,value]of Object.entries(obj.attrs||{}))attr(el,key,value);
    if(obj.assetId){const asset=(data.assets||[]).find(a=>a.id===obj.assetId);if(asset)attr(el,'src',new URL(asset.path,publicBase).href);}
    if(obj.hidden){if(el.style.display!=='none')el.style.setProperty('display','none','important');el.dataset.vmgHidden='true';}
    if(obj.locked)el.dataset.vmgLocked='true';else delete el.dataset.vmgLocked;
    if(obj.action)el.dataset.vmgAction=id;
  }
  function createNode(node) {
    if(!allowedTags.has(node.tag||'div'))return null;
    const el=svgTags.has(node.tag)?document.createElementNS('http://www.w3.org/2000/svg',node.tag):document.createElement(node.tag||'div');el.dataset.vmgCreated='true';
    applyObject(el,node,node.id);
    if(node.tag==='button'&&!el.hasAttribute('type'))el.type='button';
    for(const child of node.children||[]){if(!canContain(node.tag,child.tag)){errors.push({type:'structure',id:child.id,message:'Недопустимая вложенность объектов'});continue;}const next=createNode(child);if(next)el.append(next);}
    return el;
  }
  function objects() { const list=[];function add(node){list.push([node.id,node]);for(const child of node.children||[])add(child);}for(const node of data.nodes||[])add(node);list.push(...Object.entries(data.overrides||{}));return list; }
  function rulesFor(id,obj) {
    const baseSelector=obj.styleRef?'[data-vmg-style-object~="'+cssEscape(id)+'"]':'[data-vmg-object="'+cssEscape(id)+'"]';const selector=':is(#__vmg_rule_a,'+baseSelector+'):is(#__vmg_rule_b,'+baseSelector+'):is(#__vmg_rule_c,'+baseSelector+')';let css='';
    const shared=data.sharedStyles?.[obj.sharedStyle]?.styles||{};
    const styles={};for(const key of new Set([...Object.keys(shared),...Object.keys(obj.styles||{})]))styles[key]={...(shared[key]||{}),...(obj.styles?.[key]||{})};
    for(const [scope,properties]of Object.entries(styles).sort(([a],[b])=>{const rank=k=>({all:0,tablet:100,mobile:200}[k.split(':')[0]]??0)+(k.includes(':')?1:0);return rank(a)-rank(b)||a.localeCompare(b);})){
      const [mode,state]=scope.split(':');let select=selector;
      if(state){const pseudo=state==='current'?'[aria-current="page"]':state==='disabled'?':disabled':':'+state;select+=pseudo;select+=','+selector+'[data-vmg-force-state="'+state+'"][data-vmg-object]';}
      const body=Object.entries(properties).filter(([key,value])=>/^(?:--[a-z][a-z0-9-]*|[a-z][a-z0-9-]*)$/.test(key)&&typeof value==='string'&&!/[{};<>]/.test(value)&&!/(?:url\s*\(|expression\s*\(|@import)/i.test(value)).map(([key,value])=>key+':'+value+'!important').join(';');
      if(!body)continue;
      const rule=select+'{'+body+'}';
      if(mode==='all')css+=rule;
      else if(document.documentElement.hasAttribute('data-hub-layout')){
        const prefix=mode==='mobile'?'html[data-hub-layout="phone"]':'html[data-hub-layout^="tablet-"]';css+=select.split(',').map(s=>prefix+' '+s).join(',')+'{'+body+'}';
      }else if(mode==='tablet'||mode==='mobile')css+='@media(max-width:'+(mode==='mobile'?700:1024)+'px){'+rule+'}';
    }
    return css;
  }
  function renderStyles() {
    if(!sheet?.isConnected){sheet=document.createElement('style');sheet.dataset.vmgRuntime='styles';document.head.append(sheet);}
    const css='[data-vmg-slide][hidden]{display:none!important}dialog[data-vmg-created]:not([open]){display:none!important}\n'+objects().map(([id,obj])=>rulesFor(id,obj)).join('\n');if(sheet.textContent!==css)sheet.textContent=css;
  }
  // Container grammar mirrors design-operations.js for source DOM destinations.
const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const phrasing = new Set('a abbr audio b bdi bdo br button canvas cite code data del dfn em i img input ins kbd label mark meter noscript object output picture progress q ruby s samp select small span strong sub sup svg textarea time u var video wbr'.split(' '));
const phraseParents = new Set('p h1 h2 h3 h4 h5 h6 span strong em b i u s small sub sup code label button'.split(' '));
const svgChildren = new Set('svg g path rect circle ellipse line polyline polygon'.split(' '));
function canContain(parentTag, childTag) {
  const parent = String(parentTag).toLowerCase(), child = String(childTag).toLowerCase();
  if (!parent || !child || voids.has(parent)) return false;
  if (['a', 'button'].includes(parent) && ['a', 'button'].includes(child)) return false;
  if (parent === 'svg' || parent === 'g') return svgChildren.has(child);
  if (svgChildren.has(parent)) return false;
  if (['ul', 'ol', 'menu'].includes(parent)) return child === 'li';
  if (child === 'li') return false;
  if (parent === 'table') return ['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr'].includes(child);
  if (['thead', 'tbody', 'tfoot'].includes(parent)) return child === 'tr';
  if (parent === 'tr') return ['td', 'th'].includes(child);
  if (parent === 'colgroup') return child === 'col';
  if (['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'col'].includes(child)) return false;
  if (parent === 'dl') return ['dt', 'dd', 'div'].includes(child);
  if (['dt', 'dd'].includes(child)) return false;
  if (parent === 'picture') return ['source', 'img'].includes(child);
  if (child === 'source' || child === 'track') return ['audio', 'video'].includes(parent);
  if (parent === 'summary') return phrasing.has(child) || /^h[1-6]$/.test(child);
  if (phraseParents.has(parent)) return phrasing.has(child);
  return !['html', 'head', 'body'].includes(child);
}

  function position(el,parent,before) {
    if(!parent||el===parent||el.contains(parent)||!canContain(parent.localName,el.localName)){errors.push({type:'structure',message:'Недопустимый контейнер',id:el.dataset.vmgObject});return;}
    if(before&&before.parentNode!==parent)before=null;
    if(el.parentNode===parent&&((before&&el.nextSibling===before)||(!before&&el===parent.lastElementChild)))return;
    if(!el.dataset.vmgCreated&&!anchors.has(el)){const anchor=document.createComment('vmg-position');el.before(anchor);anchors.set(el,anchor);}
    parent.insertBefore(el,before||null);
  }
  function applyMissing() {
    if(applying||!document.body)return;applying=true;errors=[];observer?.disconnect();
    try{
      const resolved=new Map(),styled=new Map();for(const [id,obj]of Object.entries(data.overrides||{})){if(!onPage(obj.ref?.route))continue;const el=resolve({id})||resolve(obj.ref);if(el){remember(el);resolved.set(id,el);if(!bindingContexts.has(id))bindingContexts.set(id,captureContext(el,obj.ref));}if(obj.styleRef){const owner=resolve(obj.styleRef);if(owner){remember(owner);styled.set(id,owner);}}}
      for(const [id,obj]of Object.entries(data.overrides||{})){
        if(!onPage(obj.ref?.route))continue;
        const el=resolved.get(id);if(el){applyObject(el,obj,id);if(obj.styleRef){const owner=styled.get(id);if(owner){const ids=new Set((owner.dataset.vmgStyleObject||'').split(' ').filter(Boolean));ids.add(id);owner.dataset.vmgStyleObject=[...ids].join(' ');styleBindings.set(id,owner);}else errors.push({type:refFailures.get(JSON.stringify(obj.styleRef))||'missing-style',id,message:'Не найдена область оформления объекта'});}}else{const failed=refFailures.get(JSON.stringify(obj.ref))==='guard';errors.push({type:failed?'guard':'missing',id,message:failed?'Структура или текст источника изменились: нужна проверка привязки':'Объект не найден в этом состоянии страницы'});}
      }
      for(const node of data.nodes||[]){
        if(!onPage(node.route||node.parent?.route))continue;
        let el=resolve({id:node.id});if(!el){const parent=resolve(node.parent);if(!parent){errors.push({type:'missing-parent',id:node.id,message:'Контейнер нового объекта не найден'});continue;}el=createNode(node);if(el)position(el,parent,resolve(node.before));}
      }
      for(const move of data.moves||[]){if(!onPage(move.route||move.target?.route))continue;const el=resolve(move.target),parent=resolve(move.parent);if(el&&parent)position(el,parent,resolve(move.before));else errors.push({type:'move',message:'Не найдена цель перестановки'});}
      for(const ref of data.removed||[]){const el=resolve(ref);if(el){remember(el);el.style.setProperty('display','none','important');el.dataset.vmgHidden='true';}}
      renderStyles();
    }finally{applying=false;observer?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','style','hidden','data-direction','data-view','data-tool','data-gallery-photo','data-gallery-section']});}
    document.dispatchEvent(new CustomEvent('vmg:design-rendered',{detail:{errors:[...errors]}}));
  }
  function restore() {
    observer?.disconnect();
    for(const [el,anchor]of [...anchors].reverse()){if(anchor.isConnected){anchor.replaceWith(el);}}
    anchors.clear();
    for(const [el,original]of originals)if(original.contentChanged)el.replaceChildren(...original.children);
    for(const [el,original]of originals){
      if(!el.isConnected)continue;
      for(const [key,value]of original.attrs){if(value===null)el.removeAttribute(key);else el.setAttribute(key,value);}
      if(original.display)el.style.setProperty('display',original.display,original.displayPriority);else el.style.removeProperty('display');
      for(const key of ['vmgObject','vmgName','vmgHidden','vmgLocked','vmgAction','vmgForceState','vmgStyleObject'])delete el.dataset[key];
    }
    document.querySelectorAll('[data-vmg-created]').forEach(el=>el.remove());
    originals.clear();bindings.clear();refFailures.clear();bindingContexts.clear();styleBindings.clear();
  }
  function apply(next) {applying=true;restore();data=next&&next.schema===1?next:empty();applying=false;applyMissing();}
  function actionObject(id){return objects().find(([key])=>key===id)?.[1];}
  let performingAction=false;
  document.addEventListener('click',event=>{
    const el=event.target.closest?.('[data-vmg-action]');if(!el||window.__VMG_DESIGN_EDITING__||performingAction)return;
    const action=actionObject(el.dataset.vmgAction)?.action;if(!action)return;
    let target;try{target=resolve({id:action.target})||document.querySelector(action.target);}catch{}
    if(action.type==='navigate'){if(safeURL(action.target)){event.preventDefault();location.href=action.target;}return;}
    if(!target)return;event.preventDefault();event.stopImmediatePropagation();
    if(action.type==='scroll')target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    else if(action.type==='open'||action.type==='close'||action.type==='toggle'){
      const open=action.type==='open'||action.type==='toggle'&&(target.hidden||['DETAILS','DIALOG'].includes(target.tagName)&&!target.open);
      if(target.tagName==='DIALOG'){if(open){target.hidden=false;if(!target.open)target.showModal();}else if(target.open)target.close();}else if(target.tagName==='DETAILS')target.open=open;else{target.hidden=!open;target.setAttribute('aria-hidden',String(!open));}
      el.setAttribute('aria-expanded',String(open));
    }else if(action.type==='next'||action.type==='previous'){
      const slides=[...target.querySelectorAll(':scope > [data-vmg-slide]')];if(slides.length){const at=Number(target.dataset.vmgSlideIndex||0),next=(at+(action.type==='next'?1:-1)+slides.length)%slides.length;target.dataset.vmgSlideIndex=String(next);slides.forEach((slide,index)=>{slide.hidden=index!==next;});}else{const button=target.querySelector(action.type==='next'?'[data-next],.next,[aria-label*="Следующ"]':'[data-prev],.previous,[aria-label*="Предыдущ"]');if(button&&button!==el){performingAction=true;try{button.click();}finally{performingAction=false;}}}
    }
  },true);
  function init(){observer=new MutationObserver(records=>{if(applying||scheduled||!records.some(r=>!r.target.closest?.('[data-vmg-editor-ui]')&&(r.type==='attributes'||r.addedNodes.length||r.removedNodes.length)))return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;applyMissing();});});apply(window.__VMG_DESIGN__||empty());}
  window.VMGDesignerRuntime={apply,resolve,cleanHTML,empty,document:()=>data,errors:()=>[...errors],fingerprint,assetURL:path=>new URL(path,publicBase).href,page,objects,refresh:applyMissing,setForceState:(id,state)=>{forceState=state;const el=resolve({id});if(el){if(state)el.dataset.vmgForceState=state;else delete el.dataset.vmgForceState;}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
