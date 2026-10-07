// PROTOTYPE for "Prototype native-scroll carousels on title pages", fifth round. Throwaway code: not for production.
//
// The related titles section of the ring variants (ring1 to ring9). The rule of the third round stays: a tap on a
// poster never leaves the page, never moves the scroll position, and never changes the section's height. It walks
// in place, before hydration as after it, through one inline script with delegated listeners. "Open" is its own link.
//
// What this round changes after the owner tried the fourth (see ring-model.ts for the scheme):
// - three titles per direction at rest where the layout has room.
// - a dive has its own way out that says what it does: a chip "All directions", and the middle title, which gets a
//   close mark. The dived direction's own word still toggles. Nobody has to tap a word that says something else.
// - in a dive, "a bit" is nearest to the middle title and "much" is farthest, in every direction.
// - dials: several ways to choose what the axes are about (the words themselves, presets, the title's own traits,
//   a list), and forms with one axis or three.
// - two forms have no dive mode: their directions are strips that scroll outward and load further titles in place.
//
// Real: the titles, the levels behind the directions, every step, dive, and turn of a dial (one request each).
// Faked: no title actions on posters, and a walk is forgotten when the page is left.
import { useNavigate } from "@remix-run/react"
import { useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { WALK_CSS } from "~/ui/prototype-carousels/WalkSection"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"

export const RING_SCRIPT = `(function(){
if(window.__gwRing){window.__gwRing.boot();return}
var W=window.__gwRing={cache:{},nav:null};
function still(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function q(s,x){return s.querySelector(x)}
function sec(el){return el&&el.closest?el.closest('[data-ring]'):null}
function hit(e,x){var t=e.target;return t&&t.closest?t.closest(x):null}
function low(t){return t?t.charAt(0).toLowerCase()+t.slice(1):''}
function opp(d){return d.slice(0,-1)+(d.slice(-1)==='+'?'-':'+')}
function attr(s,n){var m=q(s,'[data-rg-map]');return m?m.getAttribute(n)||'':''}
function state(s){var k=s.getAttribute('data-rg-root');
if(!s.__w||s.__w.root!==k){var c=q(s,'[data-rg-center]');
s.__w={root:k,busy:false,trail:[{key:k,title:s.getAttribute('data-rg-title'),poster:c?(c.currentSrc||c.src):'',html:null,rest:null,from:'',via:'',anchor:'',adir:''}]}}
return s.__w}
function last(w){return w.trail[w.trail.length-1]}
function url(s,p,lock,o){o=o||{};var k=p.key.split('-'),m=q(s,'[data-rg-map]');
return '/api/prototype-explore?variant='+s.getAttribute('data-ring')+'&type='+k[0]+'&id='+k[1]+'&root='+s.getAttribute('data-rg-root')+
(m?'&axes='+encodeURIComponent(o.axes||m.getAttribute('data-axes'))+'&traits='+encodeURIComponent(m.getAttribute('data-traits')||''):'')+
(lock?'&lock='+encodeURIComponent(lock):'')+(p.from?'&from='+p.from+'&via='+encodeURIComponent(p.via):'')+
(p.anchor?'&anchor='+p.anchor+'&adir='+encodeURIComponent(p.adir):'')+(o.x||'')}
function load(u){return W.cache[u]||(W.cache[u]=fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.text()}).catch(function(e){delete W.cache[u];throw e}))}
function say(s,t){var y=q(s,'[data-rg-why]');if(y){y.__d=null;y.textContent=t}}
function crumbs(s){var w=state(s),ol=q(s,'[data-rg-crumbs]'),hint=q(s,'[data-rg-hint]');if(!ol)return;
var on=w.trail.length>1;ol.hidden=!on;if(hint)hint.hidden=on;ol.textContent='';if(!on)return;
w.trail.forEach(function(p,i){var end=i===w.trail.length-1,li=document.createElement('li'),b=document.createElement(end?'span':'button');
if(end)b.setAttribute('aria-current','step');else{b.type='button';b.setAttribute('data-rg-to',i);b.setAttribute('aria-label','Back to '+p.title)}
var t=document.createElement('span');t.textContent=p.title;b.appendChild(t);li.appendChild(b);ol.appendChild(li)});
ol.scrollLeft=ol.scrollWidth}
function drop(f){for(var i=0;f&&i<f.length;i++)if(f[i].parentNode)f[i].parentNode.removeChild(f[i])}
function show(s,html,flies,had){var w=state(s),stage=q(s,'[data-rg-stage]');had=had||s.contains(document.activeElement);
stage.innerHTML=html;stage.removeAttribute('data-rg-load');crumbs(s);s.removeAttribute('data-rg-busy');w.busy=false;
if(!still()){stage.removeAttribute('data-rg-in');void stage.offsetWidth;stage.setAttribute('data-rg-in',flies&&flies.length?'fly':'')}
if(had)s.focus({preventScroll:true});
var c=q(s,'[data-rg-center]');
function off(){drop(flies);flies=null}
if(flies&&flies.length){if(c&&!c.complete){c.addEventListener('load',off);c.addEventListener('error',off);setTimeout(off,2000)}else off()}}
function fly(s,img,to,flies,top){if(!img||!to)return;var a=img.getBoundingClientRect(),z=to.getBoundingClientRect(),o=s.getBoundingClientRect();
if(!a.width||!z.width)return;var f=document.createElement('img');f.src=img.currentSrc||img.src;f.alt='';f.className='wk-fly';
f.style.cssText='left:'+(a.left-o.left-s.clientLeft)+'px;top:'+(a.top-o.top-s.clientTop)+'px;width:'+a.width+'px;height:'+a.height+'px;z-index:'+(top?7:6);
s.appendChild(f);flies.push(f);
return function(){f.style.transform='translate('+(z.left-a.left)+'px,'+(z.top-a.top)+'px) scale('+(z.width/a.width)+','+(z.height/a.height)+')'}}
function flights(s,b,flies){if(still())return 0;var c=q(s,'[data-rg-center]'),img=q(b,'img'),
t=q(s,'[data-dir="'+opp(b.getAttribute('data-via'))+'"] [data-rg-slot]');
var out=fly(s,c,t&&(q(t,'img')||t),flies,0),inn=fly(s,img,c,flies,1);if(!flies.length)return 0;
b.style.visibility='hidden';if(c)c.style.visibility='hidden';void s.offsetWidth;if(out)out();if(inn)inn();return 300}
function peek(s,b){var y=q(s,'[data-rg-why]');if(!y)return;
if(b){if(y.__d==null)y.__d=y.textContent;y.textContent=b.getAttribute('data-t')+' ('+b.getAttribute('data-y')+'): '+low(b.getAttribute('data-why'))+'.'}
else if(y.__d!=null){y.textContent=y.__d;y.__d=null}}
function menus(s,slot){var l=s.querySelectorAll('[data-rg-menu]');for(var i=0;i<l.length;i++)l[i].hidden=!(slot!=null&&l[i].getAttribute('data-rg-menu')===String(slot)&&l[i].hidden)}
function back(s,i,b){var w=state(s);if(w.busy||i<0||i>=w.trail.length-1)return;var p=w.trail[i],flies=[],wait=0;
peek(s,null);if(b){wait=flights(s,b,flies);w.busy=true;s.setAttribute('data-rg-busy','')}
setTimeout(function(){if(s.__w!==w)return;w.trail.length=i+1;show(s,p.html,flies)},wait)}
function step(s,b){var w=state(s);if(w.busy)return;
if(b.hasAttribute('data-rg-back')){back(s,w.trail.length-2,b);return}
var key=b.getAttribute('data-rg-step'),stage=q(s,'[data-rg-stage]'),img=q(b,'img'),here=last(w),via=b.getAttribute('data-via');
var title=b.getAttribute('data-t'),why=b.getAttribute('data-why'),had=s.contains(document.activeElement),lock=attr(s,'data-lock');
peek(s,null);menus(s,null);here.html=stage.innerHTML;
var place={key:key,title:title,poster:img?(img.currentSrc||img.src):'',html:null,rest:null,from:here.key,via:via,
anchor:here.adir===via&&here.anchor?here.anchor:here.key,adir:via};
var u=url(s,place,lock),flies=[],wait=flights(s,b,flies);
w.busy=true;s.setAttribute('data-rg-busy','');
var t=q(s,'[data-rg-here]');if(t)t.textContent=title;
var m=q(s,'[data-rg-meta]');if(m)m.textContent=b.getAttribute('data-y')||'';
var started=Date.now();
load(u).then(function(html){var left=wait-(Date.now()-started);
setTimeout(function(){if(s.__w!==w)return;w.trail.push(place);show(s,html,flies,had);
if(why)say(s,'Next to '+here.title+': '+low(why)+'.')},left>0?left:0)},
function(){if(s.__w!==w)return;drop(flies);stage.innerHTML=here.html;s.removeAttribute('data-rg-busy');w.busy=false;
say(s,'That step could not be loaded. Try again.')})}
function go(s,u){var w=state(s),had=s.contains(document.activeElement);peek(s,null);menus(s,null);w.busy=true;s.setAttribute('data-rg-busy','');
load(u).then(function(html){if(s.__w!==w)return;show(s,html,null,had)},
function(){if(s.__w!==w)return;s.removeAttribute('data-rg-busy');w.busy=false;say(s,'That could not be loaded. Try again.')})}
function lock(s,id){var w=state(s);if(w.busy)return;var here=last(w),cur=attr(s,'data-lock'),next=cur===id?'':id,axes=attr(s,'data-axes'),stage=q(s,'[data-rg-stage]');
if(!cur&&next){peek(s,null);menus(s,null);here.rest={axes:axes,html:stage.innerHTML}}
if(!next&&here.rest&&here.rest.axes===axes){peek(s,null);show(s,here.rest.html,null);return}
go(s,url(s,here,next))}
function turn(s,axes,x){var w=state(s);if(w.busy)return;var here=last(w);
if(!x&&axes===attr(s,'data-axes')){menus(s,null);return}
here.rest=null;go(s,url(s,here,attr(s,'data-lock'),{axes:axes,x:x}))}
function more(s,strip){if(!s||!strip||!strip.hasAttribute('data-rg-more')||strip.__m)return;var w=state(s);
strip.__m=1;load(url(s,last(w),'',{x:'&more='+encodeURIComponent(strip.getAttribute('data-rg-strip'))})).then(function(h){
if(!strip.isConnected)return;var b=q(strip,'[data-rg-load]');if(b)b.parentNode.removeChild(b);strip.removeAttribute('data-rg-more');strip.insertAdjacentHTML('beforeend',h)},
function(){strip.__m=0})}
document.addEventListener('scroll',function(e){var t=e.target;if(!t||!t.hasAttribute||!t.hasAttribute('data-rg-more'))return;
if(t.scrollWidth-t.clientWidth-Math.abs(t.scrollLeft)<90)more(sec(t),t)},true);
document.addEventListener('click',function(e){
var el=e.target&&e.target.closest?e.target:null,s=sec(el);if(!s)return;
var a=el.closest('a[data-rg-nav]');
if(a){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)return;if(W.nav){e.preventDefault();W.nav(a.getAttribute('href'))}return}
var k=el.closest('[data-rg-to]');if(k){back(s,+k.getAttribute('data-rg-to'));return}
if(el.closest('[data-rg-close]')){menus(s,null);return}
var d=el.closest('[data-rg-choose]');if(d){menus(s,d.getAttribute('data-rg-choose'));return}
d=el.closest('[data-rg-set]');if(d){var v=d.getAttribute('data-rg-set').split(':'),l=attr(s,'data-axes').split(',');l[+v[0]]=v[1];turn(s,l.join(','),'');return}
d=el.closest('[data-rg-axes]');if(d){turn(s,d.getAttribute('data-rg-axes'),'');return}
d=el.closest('[data-rg-pick]');if(d){turn(s,attr(s,'data-axes'),'&pick='+d.getAttribute('data-rg-pick'));return}
d=el.closest('[data-rg-preset]');if(d){turn(s,attr(s,'data-axes'),'&preset='+d.getAttribute('data-rg-preset'));return}
d=el.closest('[data-rg-load]');if(d){more(s,d.closest('[data-rg-strip]'));return}
var b=el.closest('[data-rg-step]');if(b){step(s,b);return}
if(el.closest('[data-rg-exit]')){var c=attr(s,'data-lock');if(c)lock(s,c);return}
var x=el.closest('[data-rg-end]');if(x){say(s,x.getAttribute('data-rg-end'));return}
var n=el.closest('[data-rg-lock]');if(n){lock(s,n.getAttribute('data-rg-lock'));return}
if(!el.closest('[data-rg-menu]'))menus(s,null)});
document.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;var b=hit(e,'[data-rg-step],[data-rg-lock]'),s=sec(b);if(!s)return;
var w=state(s),here=last(w);
if(b.hasAttribute('data-rg-back'))return;
if(b.hasAttribute('data-rg-lock')){var id=b.getAttribute('data-rg-lock');if(attr(s,'data-lock')!==id)load(url(s,here,id)).catch(function(){});return}
var via=b.getAttribute('data-via');
load(url(s,{key:b.getAttribute('data-rg-step'),from:here.key,via:via,anchor:here.adir===via&&here.anchor?here.anchor:here.key,adir:via},attr(s,'data-lock'))).catch(function(){})},true);
function over(e){var b=hit(e,'[data-rg-step]'),s=sec(b);if(!s||state(s).busy)return;peek(s,b)}
function out(e){var b=hit(e,'[data-rg-step]'),s=sec(b);if(!s||(e.relatedTarget&&b.contains(e.relatedTarget)))return;peek(s,null)}
document.addEventListener('mouseover',over);document.addEventListener('mouseout',out);
document.addEventListener('focusin',function(e){var b=hit(e,'[data-rg-step]');if(b&&b.matches(':focus-visible'))over(e)});
document.addEventListener('focusout',out);
W.boot=function(){var l=document.querySelectorAll('[data-ring]');for(var i=0;i<l.length;i++)(function(s){var w=state(s),stage=q(s,'[data-rg-stage]');
if(stage&&stage.hasAttribute('data-rg-load')&&!w.loading){w.loading=true;
load(url(s,w.trail[0],'')).then(function(h){if(s.__w!==w||w.trail.length>1)return;show(s,h,null);var c=q(s,'[data-rg-center]');w.trail[0].poster=c?c.src:''},function(){})}})(l[i])};
W.boot()
})()`

export const RING_CSS = `
.wk[data-rg-busy] .wk-p{opacity:.25;pointer-events:none}
.wk[data-rg-busy] .wk-open,.wk[data-rg-busy] .rg-lb,.wk[data-rg-busy] .rg-dial,.wk[data-rg-busy] .rg-list,.wk[data-rg-busy] .rg-x,.wk[data-rg-busy] .rg-c{opacity:.4;pointer-events:none}
.rg-stage[data-rg-in] .wk-p:not([data-rg-back]){animation:wk-in .28s ease both}
.rg-stage[data-rg-in=""] .wk-p[data-rg-back]{animation:wk-in .28s ease both}
.rg-map{position:relative;width:100%;max-width:346px;margin:0 auto;container-type:inline-size}
.rg-ring,.rg-star,.rg-glass{aspect-ratio:100/107.5}
.rg-bow{aspect-ratio:100/96}
.rg-map svg{position:absolute;inset:0;width:100%;height:100%}
.rg-map line{stroke:rgba(255,255,255,.12);stroke-width:1;stroke-dasharray:3 5;vector-effect:non-scaling-stroke}
.rg-d{display:contents}
.rg-pl>.rg-c,.rg-pl .rg-p,.rg-pl .rg-g,.rg-pl .rg-lb,.rg-rk,.rg-x{position:absolute;left:calc(50% + var(--x) * 1cqw);top:calc(50% + var(--y) * 1cqw);translate:-50% -50%}
.rg-pl>.rg-c,.rg-pl .rg-p,.rg-pl .rg-g{width:calc(var(--w) * 1cqw)}
.rg-pl .rg-al,.rg-rk.rg-al,.rg-x.rg-al{translate:0 -50%}
.rg-pl .rg-ar,.rg-rk.rg-ar,.rg-x.rg-ar{translate:-100% -50%}
.rg-c{display:block;padding:0;z-index:2}
.rg-p{z-index:1}
.rg-map[data-lock] .rg-p[data-rg-back]{z-index:0}
.rg-map[data-lock] .rg-c{cursor:pointer}
.rg-map[data-lock] .rg-c::after{content:"✕";position:absolute;right:-7px;top:-7px;width:20px;height:20px;border-radius:9999px;background:#fff;color:#000;
font-size:.75rem;font-weight:700;line-height:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.6)}
.rg-map[data-lock] .rg-c:hover .wk-i,.rg-map[data-lock] .rg-c:focus-visible .wk-i{outline-color:#fbbf24}
.rg-g{display:block;aspect-ratio:2/3;visibility:hidden;border-radius:.375rem}
[data-end]>.rg-g,[data-end] .rg-strip>.rg-g{visibility:visible;border:1px dashed rgba(255,255,255,.14)}
.rg-lb{display:flex;align-items:center;gap:4px;z-index:3;white-space:nowrap}
.rg-l{font-size:.8125rem;font-weight:800;line-height:1.125rem;color:#fde68a;border-radius:.625rem;padding:1px 8px;
background:rgba(253,230,138,.08);border:1px solid rgba(253,230,138,.28);transition:background .15s}
.rg-l i{font-style:normal;font-weight:400;opacity:.7}
.rg-l em{font-style:normal;font-weight:400;font-size:.6875rem}
.rg-l u{text-decoration:none;font-weight:400;margin-left:4px;opacity:.8}
button.rg-l:hover{background:rgba(253,230,138,.2)}
.rg-l:focus-visible,.rg-fu:focus-visible,.rg-x:focus-visible{outline:2px solid #fff;outline-offset:1px}
.rg-l[aria-pressed="true"]{background:#fbbf24;color:#000;border-color:#fbbf24}
.rg-l[data-rg-end],[data-rg-ended] .rg-ch{color:#9ca3af;background:none;border:1px dashed rgba(255,255,255,.2)}
.rg-l[data-rg-end] b,[data-rg-ended] .rg-ch b{font-weight:600}
.rg-plain{background:none;border-color:transparent;padding-inline:0}
.rg-sm .rg-l{font-size:.75rem;padding:0 6px;opacity:.75}
.rg-fu{font-size:.6875rem;line-height:1.125rem;border-radius:9999px;padding:0 6px;color:#e5e7eb;background:rgba(255,255,255,.12)}
.rg-fu:hover{background:rgba(255,255,255,.22)}
.rg-fe{background:none;color:#9ca3af}
.rg-x{z-index:4;white-space:nowrap;border-radius:9999px;background:#fff;color:#000;font-weight:700;font-size:.75rem;line-height:1.375rem;padding:0 9px;box-shadow:0 1px 6px rgba(0,0,0,.5)}
.rg-x:hover{background:#fde68a}
.rg-rk{font-size:.6875rem;line-height:1rem;color:#9ca3af;white-space:nowrap;pointer-events:none}
.rg-bk{position:absolute;left:50%;top:50%;translate:-50% -50%;border-radius:9999px;background:rgba(0,0,0,.8);padding:0 .375rem;
color:#fff;font-size:.6875rem;font-weight:700;line-height:1.125rem;border:1px solid rgba(255,255,255,.55);pointer-events:none}
.wk-p[data-rg-back] .wk-i{outline:2px dashed rgba(255,255,255,.6)}
.wk-p[data-rg-back] img{opacity:.55}
.wk-p[data-rg-back]:hover .wk-i,.wk-p[data-rg-back]:focus-visible .wk-i{outline-color:#fbbf24}
.rg-map[data-lockpos="e"] .rg-bk{left:28%}
.rg-map[data-lockpos="w"] .rg-bk{left:72%}
.rg-map[data-lockpos="n"] .rg-bk{top:auto;bottom:-2px;translate:-50% 0}
.rg-map[data-lockpos="s"] .rg-bk{top:-2px;translate:-50% 0}
.rg-map[data-lockpos="ne"] .rg-bk,.rg-map[data-lockpos="se"] .rg-bk{left:30%}
.rg-map[data-lockpos="nw"] .rg-bk,.rg-map[data-lockpos="sw"] .rg-bk{left:70%}
.rg-map[data-lockpos="ne"] .rg-bk,.rg-map[data-lockpos="nw"] .rg-bk{top:74%}
.rg-map[data-lockpos="se"] .rg-bk,.rg-map[data-lockpos="sw"] .rg-bk{top:26%}

.rg-pl .rg-ar{justify-content:flex-end;text-align:right}
.rg-ring:not([data-lock]) .rg-lb{flex-wrap:wrap;white-space:normal;max-width:28cqw;gap:1px 4px}
.rg-ring:not([data-lock]) .rg-l{line-height:1rem;padding-block:0}
.rg-ring:not([data-lock]) .rg-fu{line-height:.9375rem}
.rg-ring:not([data-lock]) [data-rg-label="n"]{translate:-50% 0;justify-content:center;text-align:center;max-width:43cqw}
.rg-ring:not([data-lock]) [data-rg-label="s"]{translate:-50% -100%;justify-content:center;max-width:none;white-space:nowrap}
.rg-ring:not([data-lock]) [data-rg-label="w"]{translate:0 0}
.rg-ring:not([data-lock]) [data-rg-label="e"]{translate:-100% 0}
.rg-star:not([data-lock]) [data-rg-label="e"],.rg-star:not([data-lock]) [data-rg-label="w"]{flex-wrap:wrap;white-space:normal;max-width:26cqw}
.rg-map[data-lock] .rg-sm{white-space:normal;max-width:37cqw}
.rg-map[data-lock] .rg-sm .rg-fu{display:none}
.wk-ring2 .rg-ring .rg-l{font-size:.75rem}
.wk-ring2 .rg-ring:not([data-lock]) .rg-lb{flex-direction:column;flex-wrap:nowrap;align-items:center}
.wk-ring2 .rg-ring:not([data-lock]) [data-rg-label="w"]{max-width:23.5cqw;align-items:flex-start}
.wk-ring2 .rg-ring:not([data-lock]) [data-rg-label="e"]{max-width:23.5cqw;align-items:flex-end}
.wk-ring4 .rg-ring:not([data-lock]) [data-rg-label="n"]{max-width:50cqw}
.wk-ring4 .rg-ring:not([data-lock]) [data-rg-label="w"],.wk-ring4 .rg-ring:not([data-lock]) [data-rg-label="e"]{max-width:25cqw}
.wk-ring3 .rg-ring:not([data-lock]) .rg-l,.wk-ring4 .rg-ring:not([data-lock]) .rg-l{font-size:.75rem;line-height:.9375rem}
.wk-ring3 .rg-ring:not([data-lock]) [data-rg-label="w"],.wk-ring3 .rg-ring:not([data-lock]) [data-rg-label="e"]{max-width:23.5cqw}
[data-on] .rg-ch{background:#fbbf24;color:#000;border-color:#fbbf24}
.rg-star[data-lock] .rg-sm{white-space:nowrap;max-width:none}
.rg-glass .rg-lb{max-width:38cqw;white-space:normal}
.rg-bow .rg-lb{max-width:47cqw;white-space:normal}
.rg-bow .rg-l{line-height:1rem}
.rg-bow [data-rg-label="w"]{translate:0 0}
.rg-bow [data-rg-label="e"]{translate:-100% 0}

.rg-menu{position:absolute;z-index:8;left:50%;top:50%;translate:-50% -50%;width:min(94%,304px);max-height:100%;overflow-y:auto;display:flex;flex-direction:column;gap:4px;
padding:10px;border-radius:.75rem;background:rgba(17,24,39,.97);border:1px solid rgba(255,255,255,.22);box-shadow:0 10px 30px rgba(0,0,0,.7)}
.rg-menu[hidden]{display:none}
.rg-menu p{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.8125rem;line-height:1.25rem;color:#d1d5db;font-weight:700}
.rg-menu p button{flex:none;width:1.5rem;height:1.5rem;padding:0;border-radius:9999px;text-align:center}
.rg-menu>*{flex:none}
.rg-menu button,.rg-list button{border-radius:.5rem;padding:2px 10px;text-align:left;font-size:.8125rem;line-height:1.375rem;color:#e5e7eb;background:rgba(255,255,255,.07);
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-menu button:hover,.rg-list button:hover,.rg-dial button:hover{background:rgba(255,255,255,.16)}
.rg-menu button[aria-pressed="true"],.rg-list button[aria-pressed="true"],.rg-dial button[aria-pressed="true"]{background:#fbbf24;color:#000;font-weight:700}
.rg-menu .rg-su,.rg-list .rg-su,.rg-dial .rg-su{background:none;border:1px dashed rgba(253,230,138,.5);color:#fde68a}
.rg-dial{display:flex;align-items:center;gap:6px;height:26px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;font-size:.75rem;color:#9ca3af}
.rg-dial::-webkit-scrollbar{display:none}
.wk-ring3 .rg-dial{-webkit-mask-image:linear-gradient(90deg,#000 90%,transparent);mask-image:linear-gradient(90deg,#000 90%,transparent);padding-right:24px}
.rg-dial button{flex:none;border-radius:9999px;padding:0 9px;line-height:1.375rem;color:#d1d5db;background:rgba(255,255,255,.07)}
.rg-dial small{font-size:.625rem;opacity:.8}
.wk-ring3 .rg-map,.wk-ring4 .rg-map{max-width:312px}
.rg-list{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px;margin-top:14px}
.rg-list button{font-size:.75rem;padding:2px 8px}

.rg-rows{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);column-gap:8px;row-gap:10px;align-items:end}
.rg-rows .rg-c{grid-column:2;grid-row:1/span var(--rows);align-self:center;position:relative;width:84px}
.rg-arm{display:flex;flex-direction:column;gap:4px;min-width:0}
.rg-west{grid-column:1;align-items:flex-end}
.rg-east{grid-column:3;align-items:flex-start}
.rg-arm .rg-lb{max-width:100%;height:2.25rem;overflow:hidden;align-items:flex-end;white-space:normal}
.rg-arm .rg-l{line-height:1rem;font-size:.75rem}
.rg-west .rg-l{text-align:right}
.rg-strip{align-self:stretch;display:flex;gap:6px;min-width:0;padding:3px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;
-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.rg-west .rg-strip{-webkit-mask-image:linear-gradient(270deg,#000 88%,transparent);mask-image:linear-gradient(270deg,#000 88%,transparent)}
.rg-strip::-webkit-scrollbar{display:none}
.rg-strip .rg-p,.rg-strip .rg-g{position:relative;flex:none;width:54px}
.rg-line .rg-strip .rg-p,.rg-line .rg-strip .rg-g{width:60px}
.rg-line .rg-rows .rg-c{width:92px}
.rg-gr{display:block;margin-top:2px;font-size:.625rem;line-height:.75rem;color:#9ca3af;text-align:center;white-space:nowrap}
.rg-strip .rg-g{margin-bottom:14px}
.rg-strip .rg-bk{top:calc(50% - 7px)}
.rg-mo{flex:none;align-self:flex-start;width:26px;aspect-ratio:26/81;border-radius:.375rem;border:1px dashed rgba(253,230,138,.45);color:#fde68a;font-size:1.125rem;line-height:1}
.rg-line .rg-mo{aspect-ratio:26/90}
.rg-mo:hover{background:rgba(253,230,138,.15)}
.rg-en{flex:none;align-self:center;padding:0 14px 14px 4px;font-size:.6875rem;color:#6b7280;white-space:nowrap}
.rg-west .rg-en{padding:0 4px 14px 14px}

@media (min-width:1024px){
.rg-map{max-width:391px}
.wk-ring3 .rg-map,.wk-ring4 .rg-map{max-width:357px}
.rg-line,.rg-arms{max-width:540px}
.rg-dial{grid-column:1/-1;height:28px;font-size:.8125rem}
.rg-dial button{padding:0 12px;line-height:1.5rem}
.rg-l{font-size:.875rem}
.rg-strip .rg-p,.rg-strip .rg-g{width:64px}
.rg-line .rg-strip .rg-p,.rg-line .rg-strip .rg-g{width:72px}
.rg-rows .rg-c{width:104px}
.rg-line .rg-rows .rg-c{width:112px}
.rg-mo{aspect-ratio:26/96}
.rg-line .rg-mo{aspect-ratio:26/108}
}
@media (prefers-reduced-motion:reduce){
.rg-l{transition:none}
.rg-stage[data-rg-in] .wk-p{animation:none}
}
`

interface RingWindow {
	__gwRing?: { boot: () => void; nav: ((href: string) => void) | null }
}

export default function RingSection({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const prototype = useCarouselPrototype()
	const navigate = useNavigate()
	const html = prototype?.ring?.html
	const rootKey = `${media.mediaType}-${media.details.tmdb_id}`
	useEffect(() => {
		const w = window as RingWindow
		// A page opened by a navigation inside the app gets no inline script run by the parser: start it here.
		if (!w.__gwRing) {
			const script = document.createElement("script")
			script.text = RING_SCRIPT
			document.head.appendChild(script)
		}
		w.__gwRing?.boot()
		// "Open" and the text links navigate inside the app once it runs. Before that they are plain links.
		if (w.__gwRing) w.__gwRing.nav = (href) => navigate(href)
		return () => {
			if (w.__gwRing) w.__gwRing.nav = null
		}
	}, [navigate, rootKey])
	if (!html || !prototype) return null
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: constants of this file and of WalkSection. */}
			<style dangerouslySetInnerHTML={{ __html: WALK_CSS + RING_CSS }} />
			<section
				className={`wk wk-${prototype.variant}`}
				data-ring={prototype.variant}
				data-rg-root={rootKey}
				data-rg-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup rendered by server/prototype-ring-view.server.tsx.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{/* After the section, so that it finds it while the document is parsed. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<script dangerouslySetInnerHTML={{ __html: RING_SCRIPT }} />
		</>
	)
}
