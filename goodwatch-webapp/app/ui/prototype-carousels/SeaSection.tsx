// PROTOTYPE for "Prototype native-scroll carousels on title pages", sixth round. Throwaway code: not for production.
//
// The related titles section of the sea forms (sea1 to sea6): six different ideas that take the Explorer's look and
// feel and shrink it into a section. See server/prototype-sea-view.server.tsx for the markup and what each form is.
//
// The rule of the third round stays: a tap on a poster never leaves the page, never moves the scroll position, and
// never changes the section's height. It sails in place, before hydration as after it.
//
// Three layers, by weight:
// 1. The server's HTML is a complete, calm picture: the sea as CSS gradients, the islands as SVG outlines (the
//    Explorer's outline formula), posters, names, and the card.
// 2. SEA_SCRIPT, inline: taps. A step, the way back, going to an island, zooming, turning the heading. The camera is a
//    CSS transform of the world with a transition.
// 3. sea-live.ts, loaded when the section comes near the viewport or is first touched: the Explorer's own sea
//    renderer on a canvas under the posters, dragging with momentum, the minimap as a handle, pinch, and the compass
//    as a dial. Nothing of it runs while the page hydrates.
//
// Real: the titles, the levels behind the directions and ranks, every step (one request). Faked: islands have no
// painted surface (the Explorer blurs backdrops into them), no title actions on posters, and a voyage is forgotten
// when the page is left.
import { useNavigate } from "@remix-run/react"
import { useEffect, useRef } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadLive = reloadOnStaleChunk(
	() => import("~/ui/prototype-carousels/sea-live"),
)

export const SEA_SCRIPT = `(function(){
if(window.__gwSea){window.__gwSea.boot();return}
var W=window.__gwSea={cache:{},nav:null,live:null};
function still(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function q(s,x){return s.querySelector(x)}
function qa(s,x){return s.querySelectorAll(x)}
function sec(el){return el&&el.closest?el.closest('[data-sea]'):null}
function low(t){return t?t.charAt(0).toLowerCase()+t.slice(1):''}
function form(s){return s.getAttribute('data-sea')}
function st(s){var k=s.getAttribute('data-sea-root');
if(!s.__w||s.__w.root!==k){var c=q(s,'[data-sea-center]');
s.__w={root:k,busy:false,spot:'',cam:{x:0,y:0,k:1},trail:[{key:k,title:s.getAttribute('data-sea-title'),poster:c?(c.currentSrc||c.src):'',parts:null,spot:'',from:'',via:'',anchor:'',adir:'',px:0,py:0}]}}
return s.__w}
function last(w){return w.trail[w.trail.length-1]}
function names(s){return{here:q(s,'[data-sea-here]'),ui:q(s,'[data-sea-ui]'),card:q(s,'[data-sea-card]')}}
function snap(s){var p=names(s);return{here:p.here.innerHTML,ui:p.ui.innerHTML,card:p.card.innerHTML}}
function put(s,h){var p=names(s);p.here.innerHTML=h.here;p.ui.innerHTML=h.ui;p.card.innerHTML=h.card}
function split(html){var t=document.createElement('div'),o={};t.innerHTML=html;['here','ui','card'].forEach(function(n){var e=t.querySelector('[data-part="'+n+'"]');o[n]=e?e.innerHTML:''});return o}
function url(s,p){var k=p.key.split('-'),m=q(s,'[data-sea-state]');
return '/api/prototype-explore?variant='+form(s)+'&type='+k[0]+'&id='+k[1]+'&root='+s.getAttribute('data-sea-root')+
(m?'&axes='+encodeURIComponent(m.getAttribute('data-axes'))+'&traits='+encodeURIComponent(m.getAttribute('data-traits')||''):'')+
(p.from?'&from='+p.from+'&via='+encodeURIComponent(p.via):'')+(p.anchor?'&anchor='+p.anchor+'&adir='+encodeURIComponent(p.adir):'')}
function load(u){return W.cache[u]||(W.cache[u]=fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.text()}).catch(function(e){delete W.cache[u];throw e}))}
function say(s,t){var y=q(s,'[data-sea-why]');if(y)y.textContent=t}
function mat(w){var t=getComputedStyle(w).transform;if(!t||t==='none'||t.indexOf('3d')>0)return[1,0,0];var p=t.slice(t.indexOf('(')+1,-1).split(',');return[+p[0],+p[4],+p[5]]}
function wp(s,el){var w=q(s,'[data-sea-world]'),a=w.getBoundingClientRect(),b=el.getBoundingClientRect(),k=mat(w)[0]||1;
return{x:(b.left+b.width/2-a.left)/k,y:(b.top+b.height/2-a.top)/k,w:b.width/k}}
function box(s){var m=q(s,'[data-sea-map]').getBoundingClientRect(),c=q(s,'[data-sea-card]').getBoundingClientRect(),side=c.height>m.height*.6;
return{w:side?m.width-c.width-24:m.width,h:side?m.height-36:m.height-c.height-44,mw:m.width,mh:m.height}}
function mini(s){var l=qa(s,'[data-sea-rect]'),w=q(s,'[data-sea-world]'),e=q(s,'[data-sea-unit]');if(!l.length||!w||!e)return;var u=e.getBoundingClientRect().width/100,c=st(s).cam,m=box(s);
for(var i=0;i<l.length;i++){var r=l[i];if(!r.offsetParent)continue;var b=r.parentNode.getAttribute('data-sea-mini').split(','),w0=(b[2]-b[0])*u,h0=(b[3]-b[1])*u;
r.style.left=((c.x-w.offsetLeft/c.k-b[0]*u)/w0*100)+'%';r.style.top=((c.y-w.offsetTop/c.k-b[1]*u)/h0*100)+'%';r.style.width=(m.mw/c.k/w0*100)+'%';r.style.height=(m.mh/c.k/h0*100)+'%'}}
function cam(s,x,y,k,fast){var w=q(s,'[data-sea-world]'),m=q(s,'[data-sea-map]'),v=st(s);v.cam={x:x,y:y,k:k};
if(form(s)==='sea5')return;
var f=fast||still();if(f)w.style.transition='none';
w.style.transform='translate('+(-x*k)+'px,'+(-y*k)+'px) scale('+k+')';m.style.setProperty('--k',k);
if(f){void w.offsetWidth;w.style.transition=''}
mini(s);if(W.live)W.live(s,f)}
function go(s,id,fast){var v=st(s),m=q(s,'[data-sea-map]'),l=qa(s,'[data-dir]'),here=q(s,'[data-sea-here]'),hx=here.offsetLeft,hy=here.offsetTop;
v.spot=id||'';m.setAttribute('data-sea-at',v.spot);
for(var i=0;i<l.length;i++){if(v.spot&&l[i].getAttribute('data-dir')===v.spot)l[i].setAttribute('data-near','');else l[i].removeAttribute('data-near')}
var near=form(s)==='sea3'||form(s)==='sea6',e=v.spot?q(s,'[data-sea-spot="'+v.spot+'"]'):null,f=e||(form(s)==='sea6'?q(s,'[data-sea-spot]'):null);
if(!f){cam(s,hx,hy,1,fast);return}
var w=q(s,'[data-sea-world]'),t=w.style.transition;w.style.transition='none';var o=w.style.transform;w.style.transform='';var p=wp(s,f);w.style.transform=o;void w.offsetWidth;w.style.transition=t;
var k=1;if(near){var b=box(s);k=Math.min(b.w*.96,b.h*.98)/(p.w/1.25)}
if(e)cam(s,p.x,p.y,k,fast);else cam(s,hx,hy,k,fast)}
function set(e,t){if(e)e.textContent=t||''}
function peek(s,b){var m=q(s,'[data-sea-map]');if(!m)return;var o=q(s,'[data-pk]');
if(o&&o!==b)o.removeAttribute('data-pk');
if(!b){m.removeAttribute('data-sea-peek');return}
b.setAttribute('data-pk','');var im=q(b,'img'),d=b.closest('[data-dir]'),back=b.hasAttribute('data-sea-back');
set(q(s,'[data-sea-pk-t]'),b.getAttribute('data-t'));set(q(s,'[data-sea-pk-y]'),b.getAttribute('data-y'));
set(q(s,'[data-sea-pk-where]'),back?'Where you came from':b.getAttribute('data-g'));set(q(s,'[data-sea-pk-why]'),back?'Tap to go back.':b.getAttribute('data-why')+'.');
var di=q(s,'[data-sea-pk-img]');if(di&&im)di.src=im.currentSrc||im.src;
var dot=q(s,'[data-sea-pk-dot]');if(dot&&d)dot.style.background='rgb('+d.style.getPropertyValue('--isl')+')';
m.setAttribute('data-sea-peek','')}
function trail(s){var v=st(s),ol=q(s,'[data-sea-trail]');if(!ol)return;var on=v.trail.length>1;ol.hidden=!on;ol.textContent='';if(!on)return;
v.trail.forEach(function(p,i){if(i===v.trail.length-1)return;var li=document.createElement('li'),b=document.createElement('button'),im=document.createElement('img');
b.type='button';b.setAttribute('data-sea-to',i);b.setAttribute('aria-label','Back to '+p.title);b.title=p.title;im.src=p.poster;im.alt='';b.appendChild(im);li.appendChild(b);ol.appendChild(li)});
ol.scrollLeft=ol.scrollWidth}
function route(s){var r=q(s,'[data-sea-route]'),v=st(s);if(!r)return;r.textContent='';if(form(s)!=='sea4')return;
v.trail.forEach(function(p,i){if(!i)return;var a=v.trail[i-1],dx=p.px-a.px,dy=p.py-a.py,l=document.createElement('i');l.className='sea-leg';
l.style.cssText='left:'+a.px+'px;top:'+a.py+'px;width:'+Math.sqrt(dx*dx+dy*dy)+'px;transform:rotate('+Math.atan2(dy,dx)+'rad)';r.appendChild(l)});
v.trail.forEach(function(p,i){if(i>v.trail.length-3)return;var b=document.createElement('button'),im=document.createElement('img');
b.type='button';b.className='sea-stop';b.setAttribute('data-sea-to',i);b.setAttribute('aria-label','Back to '+p.title);b.style.left=p.px+'px';b.style.top=p.py+'px';
im.src=p.poster;im.alt='';b.appendChild(im);r.appendChild(b)})}
function marks(s,id){var l=qa(s,'[data-dir]'),i;for(i=0;i<l.length;i++){if(l[i].getAttribute('data-dir')===id)l[i].setAttribute('data-on','');else l[i].removeAttribute('data-on')}
var hd=q(s,'[data-dir="'+id+'"]'),h0=hd?+hd.getAttribute('data-h'):0;for(i=0;i<l.length;i++)l[i].setAttribute('data-rel',((Math.round((+l[i].getAttribute('data-h')-h0)/60)%6)+6)%6);
l=qa(s,'.sea-tick');for(i=0;i<l.length;i++)l[i].setAttribute('aria-pressed',l[i].getAttribute('data-sea-head')===id?'true':'false');
var n=q(s,'[data-sea-headname]'),d=q(s,'[data-dir="'+id+'"] [data-sea-label] b');if(n&&d)n.textContent=d.textContent}
function turn(s,deg,fast){var m=q(s,'[data-sea-map]');if(fast||still()){m.style.transition='none'}m.style.setProperty('--sea-rot',deg+'deg');if(fast||still()){void m.offsetWidth;m.style.transition=''}}
function head(s,t){var e=q(s,'.sea-turn');if(!e||!t)return;var id=t.getAttribute('data-sea-head'),to=+t.getAttribute('data-sea-turn'),cur=+e.getAttribute('data-sea-turn'),d=((to-cur)%360+540)%360-180;
e.setAttribute('data-sea-turn',cur+d);e.setAttribute('data-sea-head',id);turn(s,cur+d);marks(s,id)}
function arrive(s,h,o){var v=st(s),here=q(s,'[data-sea-here]'),had=s.contains(document.activeElement),p=last(v);o=o||{};
var vw=q(s,'[data-sea-view]'),fd=form(s)==='sea5'?vw:here;
put(s,h);here.removeAttribute('data-sea-sail');vw.removeAttribute('data-sea-out');
here.style.left=p.px?p.px+'px':'';here.style.top=p.py?p.py+'px':'';
var c=q(s,'[data-sea-center]');if(c&&o.src&&!c.complete)c.style.backgroundImage='url("'+o.src+'")';
var t=q(s,'.sea-turn');if(t)turn(s,+t.getAttribute('data-sea-turn'),true);
var s0=q(s,'[data-sea-state]');route(s);trail(s);go(s,o.spot!=null?o.spot:(s0&&s0.getAttribute('data-start'))||'',true);
if(!still()){fd.removeAttribute('data-sea-in');void fd.offsetWidth;fd.setAttribute('data-sea-in','')}
s.removeAttribute('data-sea-busy');v.busy=false;if(had)s.focus({preventScroll:true});if(W.live)W.live(s,true,true)}
function back(s,i){var v=st(s);if(v.busy||i<0||i>=v.trail.length-1)return;var p=v.trail[i];peek(s,null);v.trail.length=i+1;arrive(s,p.parts,{spot:p.spot})}
function sail(s,b){var h=q(s,'[data-sea-here]');if(still())return 0;
if(form(s)==='sea5'){q(s,'[data-sea-view]').setAttribute('data-sea-out','');return 200}
var c=q(s,'.sea-c'),p=wp(s,b),cw=c?wp(s,c).w:p.w;b.setAttribute('data-to','');h.setAttribute('data-sea-sail','');
cam(s,p.x,p.y,Math.min(4,cw/p.w));return 400}
function step(s,b){var v=st(s);if(v.busy)return;
if(b.hasAttribute('data-sea-back')){back(s,v.trail.length-2);return}
var here=last(v),via=b.getAttribute('data-via'),img=q(b,'img'),src=img?(img.currentSrc||img.src):'',why=b.getAttribute('data-why');
peek(s,null);
var place={key:b.getAttribute('data-sea-step'),title:b.getAttribute('data-t'),poster:src,parts:null,spot:'',from:here.key,via:via,
anchor:here.adir===via&&here.anchor?here.anchor:here.key,adir:via,px:here.px,py:here.py};
if(form(s)==='sea4'){var sl=q(s,'[data-dir="'+via+'"] [data-sea-slot]');if(sl){place.px+=sl.offsetLeft;place.py+=sl.offsetTop}}
here.spot=v.spot;here.parts=snap(s);
var u=url(s,place);v.busy=true;s.setAttribute('data-sea-busy','');
var wait=sail(s,b),t0=Date.now();
load(u).then(function(html){var left=wait-(Date.now()-t0);
setTimeout(function(){if(s.__w!==v)return;v.trail.push(place);arrive(s,split(html),{spot:form(s)==='sea3'?here.spot:form(s)==='sea6'?null:'',src:src});
if(why)say(s,'Next to '+here.title+': '+low(why)+'.')},left>0?left:0)},
function(){if(s.__w!==v)return;arrive(s,here.parts,{spot:here.spot});say(s,'That step could not be loaded. Try again.')})}
document.addEventListener('click',function(e){
var el=e.target&&e.target.closest?e.target:null,s=sec(el);if(!s)return;
if(s.__drag){s.__drag=0;e.preventDefault();e.stopPropagation();return}
var a=el.closest('a[data-sea-nav]');
if(a){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)return;if(W.nav){e.preventDefault();W.nav(a.getAttribute('href'))}return}
var v=st(s),k=el.closest('[data-sea-to]');if(k){back(s,+k.getAttribute('data-sea-to'));return}
var b=el.closest('[data-sea-step]');if(b){step(s,b);return}
if(v.busy)return;
var h=el.closest('button[data-sea-head]');if(h){head(s,h);return}
if(el.closest('[data-sea-zoom]')){var d=q(s,'.sea-d:not([data-end])')||q(s,'.sea-d');if(d)go(s,d.getAttribute('data-dir'));return}
var g=el.closest('[data-sea-go]');if(g){var id=g.getAttribute('data-sea-go');go(s,form(s)==='sea3'&&id===v.spot?'':id);return}
if(form(s)==='sea3'&&v.spot&&el.closest('[data-sea-view]'))go(s,'')},true);
document.addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;var t=e.target;
if(t&&t.matches&&t.matches('svg[data-sea-go]')){e.preventDefault();var s=sec(t);if(s&&!st(s).busy)go(s,t.getAttribute('data-sea-go'))}});
document.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;var b=e.target&&e.target.closest?e.target.closest('[data-sea-step]'):null,s=sec(b);if(!s||b.hasAttribute('data-sea-back'))return;
var v=st(s),here=last(v),via=b.getAttribute('data-via');
load(url(s,{key:b.getAttribute('data-sea-step'),from:here.key,via:via,anchor:here.adir===via&&here.anchor?here.anchor:here.key,adir:via})).catch(function(){})},true);
function over(e){var b=e.target&&e.target.closest?e.target.closest('[data-sea-step]'):null,s=sec(b);if(!s||st(s).busy)return;peek(s,b)}
function out(e){var b=e.target&&e.target.closest?e.target.closest('[data-sea-step]'):null,s=sec(b);if(!s||(e.relatedTarget&&b.contains(e.relatedTarget)))return;if(!s.__hold)peek(s,null)}
document.addEventListener('mouseover',over);document.addEventListener('mouseout',out);
document.addEventListener('focusin',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-sea-step]'):null;if(b&&b.matches(':focus-visible'))over(e)});
document.addEventListener('focusout',out);
W.st=st;W.cam=cam;W.go=go;W.peek=peek;W.head=head;W.turn=turn;W.marks=marks;W.mini=mini;W.box=box;
W.boot=function(){var l=document.querySelectorAll('[data-sea]');for(var i=0;i<l.length;i++)(function(s){var v=st(s),m=q(s,'[data-sea-map]'),s0=q(s,'[data-sea-state]');
if(v.trail.length===1&&!v.started&&s0&&s0.getAttribute('data-start')){v.started=1;go(s,s0.getAttribute('data-start'),true)}else mini(s);
if(m&&m.hasAttribute('data-sea-load')&&!v.loading){v.loading=true;
load(url(s,v.trail[0])).then(function(h){if(s.__w!==v||v.trail.length>1)return;m.removeAttribute('data-sea-load');arrive(s,split(h),{});var c=q(s,'[data-sea-center]');v.trail[0].poster=c?c.src:''},function(){})}})(l[i])};
W.boot()
})()`

export const SEA_CSS = `
@property --sea-rot{syntax:"<angle>";inherits:true;initial-value:0deg}
.sea{position:relative;display:flex;flex-direction:column;gap:.5rem}
.sea:focus{outline:none}
.sea button{cursor:pointer;-webkit-tap-highlight-color:transparent}
.sea-defs{position:absolute}
.sea-map{position:relative;aspect-ratio:100/146;--u:1cqw;--k:1;container-type:inline-size;overflow:hidden;border-radius:18px;isolation:isolate;
background:radial-gradient(60% 45% at 22% 18%,rgba(118,138,190,.14),transparent 70%),radial-gradient(55% 40% at 82% 70%,rgba(118,138,190,.11),transparent 70%),
radial-gradient(40% 30% at 55% 42%,rgba(118,138,190,.07),transparent 70%),linear-gradient(#060a16,#03050c);
color:#eef2ff;font-family:Gabarito,system-ui,sans-serif;touch-action:pan-y;user-select:none;-webkit-user-select:none;
transition:--sea-rot .6s cubic-bezier(.2,.8,.2,1)}
.sea-map::after{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 0 70px 12px rgba(0,0,0,.5)}
.sea-bg{position:absolute;inset:0;z-index:0;opacity:0;transition:opacity .6s}
.sea-map[data-sea-live] .sea-bg{opacity:1}
.sea-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.sea-cv-w{inset:auto;transform:rotateZ(var(--sea-rot));opacity:0;transition:opacity .6s;pointer-events:none;
-webkit-mask-image:radial-gradient(closest-side,#000 70%,transparent);mask-image:radial-gradient(closest-side,#000 70%,transparent)}
.sea-map[data-sea-live] .sea-cv-w{opacity:1}
.sea-view{position:absolute;inset:0;z-index:1;overflow:hidden}
.sea-world{position:absolute;left:50%;top:44%;width:0;height:0;transform-origin:0 0;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.sea-here,.sea-route{position:absolute;left:0;top:0;width:0;height:0}
.sea-here[data-sea-in],.sea-view[data-sea-in]{animation:sea-in .4s ease}
@keyframes sea-in{from{opacity:0}}
.sea-view[data-sea-out]{opacity:0;transition:opacity .2s}
.sea-here[data-sea-sail] :is(.sea-p:not([data-to]),.sea-nm,.sea-c,.sea-ring,.sea-rw){opacity:0;transition:opacity .3s}
.sea-unit{position:absolute;left:0;top:0;width:calc(100*var(--u));height:0;visibility:hidden}
.sea-at{position:absolute;left:calc(var(--x)*var(--u));top:calc(var(--y)*var(--u));width:calc(var(--w)*var(--u));translate:-50% -50%}
.sea-d{display:contents}
.sea-isl{aspect-ratio:1;overflow:visible;pointer-events:none;transition:opacity .6s}
.sea-shore{fill:none;stroke:color-mix(in srgb,rgb(var(--isl)) 45%,#fff);stroke-width:1.6px;filter:drop-shadow(0 0 4px rgb(var(--isl))) drop-shadow(0 0 12px rgba(var(--isl),.6))}
.sea-land{fill:color-mix(in srgb,rgb(var(--isl)) 32%,#070a14)}
.sea-tap use{pointer-events:fill;cursor:pointer}
.sea-tap:focus{outline:none}
.sea-tap:focus-visible{outline:2px solid #fff;outline-offset:-6px;border-radius:50%}
.sea-map[data-sea-live] .sea-isl{opacity:0}
.sea-p{display:block;padding:0;z-index:2;border-radius:6%;transition:scale .15s,opacity .25s,filter .2s}
.sea-p img,.sea-c img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:6%;background:#141a2c center/cover;
box-shadow:0 0 0 1px rgba(255,255,255,.24),0 3px 10px rgba(0,0,0,.6)}
.sea-p:hover img,.sea-p:focus-visible img,.sea-p[data-pk] img{box-shadow:0 0 0 2px #fff,0 0 16px 3px rgba(var(--isl),.95)}
.sea-p:focus-visible{outline:none}
.sea-p:active{scale:.94}
.sea[data-sea-busy] .sea-p{pointer-events:none}
.sea-c{z-index:3;pointer-events:none}
.sea-c img{box-shadow:0 0 0 2.5px #fff,0 0 26px 8px rgba(255,236,205,.3),0 6px 18px rgba(0,0,0,.6)}
.sea-p[data-sea-back] img{opacity:.62;box-shadow:0 0 0 1.5px rgba(255,255,255,.75)}
.sea-bk{position:absolute;left:50%;top:50%;translate:-50% -50%;width:22px;height:22px;border-radius:99px;background:rgba(9,12,23,.82);border:1px solid rgba(255,255,255,.5);
color:#fff;font-size:13px;line-height:20px;text-align:center;pointer-events:none}
.sea-nm{width:max-content;max-width:calc(36*var(--u));z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;line-height:1.05;
text-shadow:0 0 10px rgba(3,6,14,.95),0 1px 3px rgba(3,6,14,.95),0 0 18px rgba(var(--isl),.55)}
.sea-nm b{font-weight:800;font-size:15px;letter-spacing:-.015em;color:#fff}
.sea-nm small{font-size:10.5px;font-weight:500;color:rgba(235,240,255,.78);margin-top:2px}
.sea-nm-s b{font-size:12.5px}
.sea-tl{translate:0 -50%;align-items:flex-start;text-align:left}
.sea-tr{translate:-100% -50%;align-items:flex-end;text-align:right}
.sea-k{scale:calc(1/var(--k))}
.sea-ring{aspect-ratio:1;border:1px dashed rgba(190,205,255,.17);border-radius:50%;pointer-events:none;z-index:0}
.sea-ring i{position:absolute;left:75%;top:6.7%;translate:-50% -50%;font-style:normal;font-size:10px;font-weight:600;letter-spacing:.04em;color:rgba(200,212,255,.6);background:#060a16;padding:0 5px;border-radius:6px;white-space:nowrap}
.sea-map[data-sea-live] .sea-ring i{background:rgba(6,10,22,.7)}
.sea-top{position:absolute;left:0;right:0;top:0;z-index:4;display:flex;align-items:center;gap:10px;height:42px;padding:0 12px 8px;pointer-events:none;
background:linear-gradient(rgba(4,6,13,.85),rgba(4,6,13,.4) 62%,transparent)}
.sea-h{flex:0 1 auto;min-width:0;font-size:16px;line-height:1.2;font-weight:800;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
.sea-trail{flex:0 1 auto;margin-left:auto;display:flex;align-items:center;gap:3px;min-width:0;max-width:62%;overflow-x:auto;scrollbar-width:none;pointer-events:auto;
padding:3px 5px;border-radius:10px;background:rgba(10,14,26,.58);border:1px solid rgba(255,255,255,.1)}
.sea-trail::-webkit-scrollbar{display:none}
.sea-trail[hidden]{display:none}
.sea-trail li{display:flex;align-items:center;gap:3px;flex:none}
.sea-trail li+li::before{content:"›";color:rgba(222,229,255,.5);font-size:12px}
.sea-trail li:last-child::after{content:"›";color:rgba(222,229,255,.5);font-size:12px}
.sea-trail button{display:block;width:17px;padding:0}
.sea-trail img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.3)}
.sea-trail button:hover img{box-shadow:0 0 0 1.5px #fff}
.sea-ui{position:absolute;inset:0;z-index:6;pointer-events:none}
.sea-ui>*{pointer-events:auto}
.sea-card{position:absolute;z-index:5;left:8px;right:8px;bottom:8px;height:88px;border-radius:14px;overflow:hidden;background:rgba(9,12,23,.8);border:1px solid rgba(255,255,255,.12);
-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);box-shadow:0 14px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);user-select:text;-webkit-user-select:text}
.sea-cd{position:absolute;inset:0;padding:9px 12px;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:14px 24px 32px;column-gap:11px;align-content:center}
.sea-cd-peek{display:none}
.sea-map[data-sea-peek] .sea-cd-peek{display:grid}
.sea-map[data-sea-peek] .sea-cd-here{visibility:hidden}
.sea-map[data-sea-peek] .sea-cd-here .sea-open{visibility:visible}
.sea-cd-peek .sea-ti{padding-right:68px}
.sea-wh em{margin-left:auto;padding-left:8px;font-style:normal;font-weight:500;color:rgba(222,229,255,.5)}
.sea-th{grid-row:1/4;width:44px;align-self:center}
.sea-th img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:4px;background:#141a2c}
.sea-wh{display:flex;align-items:center;gap:6px;min-width:0;font-size:11px;line-height:14px;font-weight:600;color:rgba(255,255,255,.78);white-space:nowrap;overflow:hidden}
.sea-dot{width:8px;height:8px;border-radius:99px;flex:none;display:inline-block;background:rgb(var(--isl,159,180,232))}
.sea-ti{display:flex;align-items:center;gap:8px;min-width:0}
.sea-ti b{min-width:0;font-size:17px;line-height:24px;font-weight:800;letter-spacing:-.015em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sea-ti span{flex:none;font-size:12px;color:rgba(222,229,255,.62)}
.sea-ti em{margin-left:auto;flex:none;font-style:normal;font-size:11px;color:rgba(222,229,255,.5)}
.sea-open{margin-left:auto;flex:none;border-radius:9px;background:#fbbf24;color:#000;font-weight:700;font-size:12.5px;line-height:22px;padding:0 12px}
.sea-open:hover{background:#fcd34d}
.sea-why{font-size:12.5px;line-height:16px;color:rgba(232,238,255,.86);overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.sea-more{display:flex;gap:.5rem;height:1.25rem;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;font-size:.8125rem;line-height:1.25rem;color:#9ca3af;
-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.sea-more::-webkit-scrollbar{display:none}
.sea-more a{color:#d1d5db}
.sea-more a:hover{color:#fff;text-decoration:underline}
.sea-more a+a::before{content:"·";margin-right:.5rem;color:#6b7280;display:inline-block}
.sea-more a:last-child{padding-right:3rem}
.sea-glass,.sea-mini,.sea-rail,.sea-edge,.sea-rose,.sea-hd{background:rgba(10,14,26,.6);border:1px solid rgba(255,255,255,.12);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}

.sea-edge{position:absolute;top:44%;translate:0 -50%;display:flex;align-items:center;gap:5px;height:30px;padding:0 9px;border-radius:11px;font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap}
.sea-edge i{font-style:normal;font-size:16px;line-height:1;opacity:.8}
.sea-edge-w{left:6px}
.sea-edge-e{right:6px}
.sea-mini{position:absolute;z-index:2;left:18px;bottom:27px;width:100px;aspect-ratio:2;border-radius:9px;overflow:hidden;touch-action:none}
.sea-m-sea1 .sea-cd{padding-left:128px;grid-template-columns:minmax(0,1fr)}
.sea-m-sea1 .sea-th,.sea-m-sea1 .sea-ti span{display:none}
.sea-mb{position:absolute;width:26%;aspect-ratio:1;translate:-50% -50%;padding:0;border-radius:50%;background:radial-gradient(closest-side,rgba(var(--isl),.95),rgba(var(--isl),.4) 55%,transparent)}
.sea-mh{width:9%;background:#fff;box-shadow:0 0 6px 2px rgba(255,236,205,.7)}
.sea-rect{position:absolute;left:28%;top:-4%;width:44%;height:108%;border:1.25px solid rgba(255,255,255,.9);border-radius:3px;pointer-events:none;box-sizing:border-box}

.sea-m-sea2 .sea-world{top:45.5%}
.sea-m-sea6 .sea-mini{left:8px;bottom:104px;width:104px;border-radius:12px}
.sea-m-sea6 .sea-mini-d{display:none}
.sea-m-sea6 .sea-mb{width:34%}
.sea-m-sea6 .sea-mh{width:10%}
.sea-m-sea6 .sea-near{opacity:1;pointer-events:auto}
.sea-m-sea6 .sea-z .sea-p.sea-r0{translate:-50% calc(-50% - 6.7*var(--u))}
.sea-m-sea6 .sea-z .sea-rw.sea-r0{translate:-100% calc(-50% - 6.7*var(--u))}
.sea-m-sea6 .sea-z .sea-nm{translate:-50% calc(-50% - 4.6*var(--u))}
.sea-near{opacity:0;pointer-events:none;transition:opacity .3s}
.sea-d[data-near] .sea-near{opacity:1;pointer-events:auto}
.sea-d[data-near] .sea-rw{pointer-events:none}
.sea-z .sea-r0,.sea-z .sea-nm{transition:translate .45s cubic-bezier(.2,.8,.2,1),scale .45s,opacity .25s}
.sea-z[data-near] .sea-p.sea-r0{translate:-50% calc(-50% - 6.7*var(--u))}
.sea-z[data-near] .sea-rw.sea-r0{translate:-100% calc(-50% - 6.7*var(--u))}
.sea-z[data-near] .sea-nm{translate:-50% calc(-50% - 4.6*var(--u))}
.sea-z .sea-nm{max-width:calc(27*var(--u))}
.sea-z .sea-nm b{font-size:14px}
.sea-rw{width:max-content;translate:-100% -50%;transform-origin:100% 50%;font-size:10.5px;font-weight:600;color:rgba(235,240,255,.75);white-space:nowrap;z-index:2;text-shadow:0 0 6px #03060e}
.sea-rail{position:absolute;right:8px;bottom:104px;display:flex;flex-direction:column;gap:2px;padding:4px;border-radius:14px}
.sea-zb{width:38px;height:38px;border-radius:10px;color:#fff;font-size:22px;line-height:1;font-weight:400}
.sea-zb:hover{background:rgba(255,255,255,.1)}
.sea-map[data-sea-at=""] .sea-zo{opacity:.35}
.sea-map:not([data-sea-at=""]) [data-sea-zoom]{opacity:.35}

.sea-leg{position:absolute;height:0;border-top:2px dashed rgba(255,255,255,.5);transform-origin:0 0;pointer-events:none}
.sea-stop{position:absolute;width:calc(8.5*var(--u));translate:-50% -50%;padding:0;z-index:1}
.sea-stop img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:6%;opacity:.8;box-shadow:0 0 0 1.5px rgba(255,255,255,.65),0 3px 10px rgba(0,0,0,.6)}
.sea-stop:hover img{opacity:1}
.sea-ghost{aspect-ratio:2/3;visibility:hidden}

.sea-m-sea5 .sea-view{perspective:calc(88*var(--u));perspective-origin:50% 4%}
.sea-m-sea5 .sea-world{top:68%;transform:rotateX(52deg);transform-style:preserve-3d;transition:none}
.sea-m-sea5 .sea-here{transform-style:preserve-3d}
.sea-turn{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;transform:rotateZ(var(--sea-rot))}
.sea-b{width:0!important;height:0;transform-style:preserve-3d;transform:rotateZ(calc(-1*var(--sea-rot))) rotateX(-52deg)}
.sea-up{translate:-50% -100%}
.sea-b .sea-c{pointer-events:none}
.sea-sign{translate:-50% -100%;opacity:.55;transition:opacity .3s}
.sea-d[data-on] .sea-sign{opacity:1}
.sea-sign b{font-size:24px}
.sea-sign small{font-size:15px}
.sea-m-sea5 .sea-view::after{content:"";position:absolute;left:0;right:0;top:0;height:22%;pointer-events:none;background:linear-gradient(#050810 30%,rgba(5,8,16,0))}
.sea-m-sea5 .sea-p,.sea-m-sea5 .sea-sign{transition:opacity .35s,scale .15s}
.sea-m-sea5 .sea-d:not([data-rel="0"]) .sea-p img{filter:brightness(.55) saturate(.7)}
.sea-m-sea5 .sea-d:not([data-rel="0"]) .sea-p:not([data-sea-back]){opacity:0;pointer-events:none}
.sea-m-sea5 .sea-d:is([data-rel="2"],[data-rel="3"],[data-rel="4"]) .sea-sign{opacity:0}
.sea-m-sea5 .sea-p[data-sea-back] img{filter:none;opacity:.8}
.sea-hd{position:absolute;left:8px;bottom:104px;display:flex;flex-direction:column;padding:6px 12px;border-radius:12px;line-height:1.1}
.sea-hd small{font-size:10.5px;font-weight:600;color:rgba(222,229,255,.62);text-transform:uppercase;letter-spacing:.06em}
.sea-hd b{font-size:17px;font-weight:800;color:#fff}
.sea-rose{position:absolute;right:10px;bottom:104px;width:92px;height:92px;border-radius:50%;rotate:var(--sea-rot);touch-action:none;cursor:grab}
.sea-rose::before{content:"";position:absolute;inset:27px;border-radius:50%;border:1px dashed rgba(255,255,255,.22)}
.sea-tick{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;padding:0;border-radius:50%;transform:rotate(var(--a)) translate(31px);display:flex;align-items:center;justify-content:center}
.sea-tick::before{content:"";width:13px;height:13px;border-radius:50%;background:rgb(var(--isl));box-shadow:0 0 8px rgba(var(--isl),.8)}
.sea-tick[aria-pressed="true"]::before{width:18px;height:18px;box-shadow:0 0 0 2px #fff,0 0 10px rgb(var(--isl))}
.sea-needle{position:absolute;right:50px;bottom:199px;width:0;height:0;border:6px solid transparent;border-top:9px solid #fff;background:none;filter:drop-shadow(0 0 4px rgba(255,255,255,.8));pointer-events:none}


@media (min-width:1024px){
.sea-map{aspect-ratio:auto;height:520px;--u:min(5.2px,(100cqw - 296px)/134)}
.sea-m-sea1 .sea-cd{padding-left:18px}
.sea-m-sea6 .sea-mini{left:auto;right:296px;bottom:14px;width:170px}
.sea-m-sea6 .sea-mini-t{display:none}
.sea-m-sea6 .sea-mini-d{display:block}
.sea-m-sea6 .sea-z .sea-p.sea-r0{translate:-50% calc(-50% - 6.9*var(--u))}
.sea-m-sea6 .sea-z .sea-rw.sea-r0{translate:-100% calc(-50% - 6.9*var(--u))}
.sea-m-sea6 .sea-z .sea-nm{translate:-50% calc(-50% - 4.7*var(--u))}
.sea-m-sea1 .sea-th{display:block}
.sea-m-sea1 .sea-ti span{display:inline}
.sea-world{left:calc((100% - 284px)/2);top:51%}
.sea-at{left:calc(var(--X)*var(--u));top:calc(var(--Y)*var(--u));width:calc(var(--W)*var(--u))}
.sea-top{right:284px;height:48px;padding:0 16px 8px}
.sea-h{font-size:20px}
.sea-trail button{width:20px}
.sea-card{left:auto;right:12px;top:12px;bottom:12px;width:260px;height:auto;border-radius:18px}
.sea-cd{padding:18px;grid-template-columns:minmax(0,1fr);grid-template-rows:none;grid-auto-rows:auto;row-gap:8px;align-content:start}
.sea-card{display:flex;flex-direction:column}
.sea-cd{position:static;flex:none}
.sea-map[data-sea-peek] .sea-cd-here{visibility:visible}
.sea-cd-peek{margin:0 18px;padding:14px 0 0;border-top:1px solid rgba(255,255,255,.12)}
.sea-cd-peek .sea-th{display:none}
.sea-cd-peek .sea-ti{padding-right:0}
.sea-cd-peek .sea-ti b{font-size:18px}
.sea-th{grid-row:auto;width:128px;margin-bottom:6px}
.sea-th img{border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.sea-wh{font-size:12px;line-height:16px}
.sea-ti{flex-wrap:wrap;row-gap:6px}
.sea-ti b{font-size:23px;line-height:1.05;white-space:normal;flex:1 1 100%}
.sea-ti span{font-size:13px}
.sea-open{font-size:14px;line-height:30px;padding:0 16px}
.sea-why{font-size:14.5px;line-height:1.4;-webkit-line-clamp:6}
.sea-nm b{font-size:17px}
.sea-nm small{font-size:11.5px}
.sea-nm-s b{font-size:14px}
.sea-tl,.sea-tr{translate:-50% -50%;align-items:center;text-align:center}
.sea-wl{translate:0 -50%;align-items:flex-start;text-align:left}
.sea-wr{translate:-100% -50%;align-items:flex-end;text-align:right}
.sea-ring{aspect-ratio:1.42}
.sea-ring i{left:50%;top:0;font-size:11px}
.sea-edge,.sea-m-sea1 .sea-mini{display:none}
.sea-rail{right:296px;bottom:14px}
.sea-z[data-near] .sea-p.sea-r0{translate:-50% calc(-50% - 6.9*var(--u))}
.sea-z[data-near] .sea-rw.sea-r0{translate:-100% calc(-50% - 6.9*var(--u))}
.sea-z[data-near] .sea-nm{translate:-50% calc(-50% - 4.7*var(--u))}
.sea-rw{font-size:12px}
.sea-m-sea2 .sea-world{top:50%}
.sea-m-sea5 .sea-world{top:72%}
.sea-m-sea5 .sea-view{perspective:calc(150*var(--u));perspective-origin:calc((100% - 284px)/2) 8%}
.sea-hd{left:14px;bottom:14px}
.sea-rose{right:300px;bottom:14px;width:108px;height:108px}
.sea-rose::before{inset:32px}
.sea-tick{transform:rotate(var(--a)) translate(38px)}
.sea-needle{right:348px;bottom:124px}
}
@media (prefers-reduced-motion:reduce){
.sea-world,.sea-map,.sea-p,.sea-bg,.sea-isl,.sea-near,.sea-z .sea-r0,.sea-z .sea-nm{transition:none}
.sea-here[data-sea-in]{animation:none}
}
`

interface SeaWindow {
	__gwSea?: { boot: () => void; nav: ((href: string) => void) | null }
}

export default function SeaSection({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const prototype = useCarouselPrototype()
	const navigate = useNavigate()
	const section = useRef<HTMLElement>(null)
	const html = prototype?.sea?.html
	const rootKey = `${media.mediaType}-${media.details.tmdb_id}`
	useEffect(() => {
		const w = window as SeaWindow
		// A page opened by a navigation inside the app gets no inline script run by the parser: start it here.
		if (!w.__gwSea) {
			const script = document.createElement("script")
			script.text = SEA_SCRIPT
			document.head.appendChild(script)
		}
		w.__gwSea?.boot()
		// "Open" and the text links navigate inside the app once it runs. Before that they are plain links.
		if (w.__gwSea) w.__gwSea.nav = (href) => navigate(href)
		return () => {
			if (w.__gwSea) w.__gwSea.nav = null
		}
	}, [navigate, rootKey])

	// The live sea wakes when the section comes near the viewport, or on the first touch of it, whichever is first.
	useEffect(() => {
		const el = section.current
		if (!el || !html) return
		let stop: (() => void) | undefined
		let gone = false
		let woke = false
		const wake = () => {
			if (woke) return
			woke = true
			observer.disconnect()
			el.removeEventListener("pointerdown", wake)
			loadLive().then(
				(live) => {
					if (!gone) stop = live.attach(el)
				},
				() => {},
			)
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) wake()
			},
			{ rootMargin: "500px 0px" },
		)
		observer.observe(el)
		el.addEventListener("pointerdown", wake)
		return () => {
			gone = true
			observer.disconnect()
			el.removeEventListener("pointerdown", wake)
			stop?.()
		}
	}, [html, rootKey])

	if (!html || !prototype) return null
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: SEA_CSS }} />
			<section
				ref={section}
				className={`sea sea-${prototype.variant}`}
				data-sea={prototype.variant}
				data-sea-root={rootKey}
				data-sea-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup rendered by server/prototype-sea-view.server.tsx.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{/* After the section, so that it finds it while the document is parsed. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<script dangerouslySetInnerHTML={{ __html: SEA_SCRIPT }} />
		</>
	)
}
