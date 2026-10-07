// PROTOTYPE for "Prototype native-scroll carousels on title pages", fourth round. Throwaway code: not for production.
//
// The related titles section of the four dive variants (dive1 to dive4). The third round's rule stays: a tap on a
// poster never leaves the page, never moves the scroll position, and never changes the section's height. It walks
// in place, before hydration as after it, through one inline script with delegated listeners. "Open" is its own link.
//
// What this round adds (see dive-model.ts for the scheme):
// - the four directions of a walk keep their words and their places, on every step.
// - after a step, the title you came from sits in the opposite direction, and both posters fly: the tapped one to
//   the center, the old center out to the opposite side. A tap on it steps back.
// - a tap on a direction's word dives into it: the stage shows a longer run that way, from a bit to much, and stays
//   in that mode while you step. Another tap on the word leaves the dive. A dive is one request, made on demand.
//
// Real: the titles, the levels behind the directions, every step, and every dive (one request each).
// Faked: no title actions on posters, and a walk is forgotten when the page is left.
import { useNavigate } from "@remix-run/react"
import { useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { WALK_CSS } from "~/ui/prototype-carousels/WalkSection"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"

export const DIVE_SCRIPT = `(function(){
if(window.__gwDive){window.__gwDive.boot();return}
var W=window.__gwDive={cache:{},nav:null};
function still(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function q(s,x){return s.querySelector(x)}
function sec(el){return el&&el.closest?el.closest('[data-dive]'):null}
function hit(e,x){var t=e.target;return t&&t.closest?t.closest(x):null}
function low(t){return t?t.charAt(0).toLowerCase()+t.slice(1):''}
function opp(d){return d.slice(0,-1)+(d.slice(-1)==='+'?'-':'+')}
function state(s){var k=s.getAttribute('data-dive-root');
if(!s.__w||s.__w.root!==k){var c=q(s,'[data-dive-center]');
s.__w={root:k,busy:false,trail:[{key:k,title:s.getAttribute('data-dive-title'),poster:c?(c.currentSrc||c.src):'',html:null,from:'',via:''}]}}
return s.__w}
function lockOf(s){var m=q(s,'[data-dive-map]');return m?m.getAttribute('data-lock')||'':''}
function url(s,p,lock){var k=p.key.split('-'),m=q(s,'[data-dive-map]'),a=m?m.getAttribute('data-axis'):'';
return '/api/prototype-explore?variant='+s.getAttribute('data-dive')+'&type='+k[0]+'&id='+k[1]+'&root='+s.getAttribute('data-dive-root')+
(a?'&axis='+a:'')+(lock?'&lock='+encodeURIComponent(lock):'')+(p.from?'&from='+p.from+'&via='+encodeURIComponent(p.via):'')}
function load(u){return W.cache[u]||(W.cache[u]=fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.text()}).catch(function(e){delete W.cache[u];throw e}))}
function say(s,t){var y=q(s,'[data-dive-why]');if(y){y.__d=null;y.textContent=t}}
function crumbs(s){var w=state(s),ol=q(s,'[data-dive-crumbs]'),hint=q(s,'[data-dive-hint]');if(!ol)return;
var on=w.trail.length>1;ol.hidden=!on;if(hint)hint.hidden=on;ol.textContent='';if(!on)return;
w.trail.forEach(function(p,i){var last=i===w.trail.length-1,li=document.createElement('li'),b=document.createElement(last?'span':'button');
if(last)b.setAttribute('aria-current','step');else{b.type='button';b.setAttribute('data-dive-to',i);b.setAttribute('aria-label','Back to '+p.title)}
if(p.poster){var m=document.createElement('img');m.src=p.poster;m.alt='';m.width=32;m.height=48;b.appendChild(m)}
var t=document.createElement('span');t.textContent=p.title;b.appendChild(t);li.appendChild(b);ol.appendChild(li)});
ol.scrollLeft=ol.scrollWidth}
function drop(f){for(var i=0;f&&i<f.length;i++)if(f[i].parentNode)f[i].parentNode.removeChild(f[i])}
function show(s,html,flies,had){var w=state(s),stage=q(s,'[data-dive-stage]');had=had||s.contains(document.activeElement);
stage.innerHTML=html;stage.removeAttribute('data-dive-load');crumbs(s);s.removeAttribute('data-dive-busy');w.busy=false;
if(!still()){stage.removeAttribute('data-dive-in');void stage.offsetWidth;stage.setAttribute('data-dive-in',flies&&flies.length?'fly':'')}
if(had)s.focus({preventScroll:true});
var c=q(s,'[data-dive-center]');
function off(){drop(flies);flies=null}
if(flies&&flies.length){if(c&&!c.complete){c.addEventListener('load',off);c.addEventListener('error',off);setTimeout(off,2000)}else off()}}
function fly(s,img,to,flies,top){if(!img||!to)return;var a=img.getBoundingClientRect(),z=to.getBoundingClientRect(),o=s.getBoundingClientRect();
if(!a.width||!z.width)return;var f=document.createElement('img');f.src=img.currentSrc||img.src;f.alt='';f.className='wk-fly';
f.style.cssText='left:'+(a.left-o.left-s.clientLeft)+'px;top:'+(a.top-o.top-s.clientTop)+'px;width:'+a.width+'px;height:'+a.height+'px;z-index:'+(top?7:6);
s.appendChild(f);flies.push(f);
return function(){f.style.transform='translate('+(z.left-a.left)+'px,'+(z.top-a.top)+'px) scale('+(z.width/a.width)+','+(z.height/a.height)+')'}}
function flights(s,b,flies){if(still())return 0;var c=q(s,'[data-dive-center]'),img=q(b,'img'),
t=q(s,'[data-dir="'+opp(b.getAttribute('data-via'))+'"] [data-dive-slot]');
var out=fly(s,c,t&&(q(t,'img')||t),flies,0),inn=fly(s,img,c,flies,1);if(!flies.length)return 0;
b.style.visibility='hidden';if(c)c.style.visibility='hidden';void s.offsetWidth;if(out)out();if(inn)inn();return 300}
function peek(s,b){var y=q(s,'[data-dive-why]');if(!y)return;
if(b){if(y.__d==null)y.__d=y.textContent;y.textContent=b.getAttribute('data-t')+' ('+b.getAttribute('data-y')+'): '+low(b.getAttribute('data-why'))+'.'}
else if(y.__d!=null){y.textContent=y.__d;y.__d=null}}
function back(s,i,b){var w=state(s);if(w.busy||i<0||i>=w.trail.length-1)return;var p=w.trail[i],flies=[],wait=0;
peek(s,null);if(b){wait=flights(s,b,flies);w.busy=true;s.setAttribute('data-dive-busy','')}
setTimeout(function(){if(s.__w!==w)return;w.trail.length=i+1;show(s,p.html,flies)},wait)}
function step(s,b){var w=state(s);if(w.busy)return;
if(b.hasAttribute('data-dive-back')){back(s,w.trail.length-2,b);return}
var key=b.getAttribute('data-dive-step'),stage=q(s,'[data-dive-stage]'),img=q(b,'img'),here=w.trail[w.trail.length-1];
var title=b.getAttribute('data-t'),why=b.getAttribute('data-why'),had=s.contains(document.activeElement),lock=lockOf(s);
peek(s,null);here.html=stage.innerHTML;
var place={key:key,title:title,poster:img?(img.currentSrc||img.src):'',html:null,from:here.key,via:b.getAttribute('data-via')};
var u=url(s,place,lock),flies=[],wait=flights(s,b,flies);
w.busy=true;s.setAttribute('data-dive-busy','');
var t=q(s,'[data-dive-here]');if(t)t.textContent=title;
var m=q(s,'[data-dive-meta]');if(m)m.textContent=b.getAttribute('data-y')||'';
var started=Date.now();
load(u).then(function(html){var left=wait-(Date.now()-started);
setTimeout(function(){if(s.__w!==w)return;w.trail.push(place);show(s,html,flies,had);
if(why)say(s,'Next to '+here.title+': '+low(why)+'.')},left>0?left:0)},
function(){if(s.__w!==w)return;drop(flies);stage.innerHTML=here.html;s.removeAttribute('data-dive-busy');w.busy=false;
say(s,'That step could not be loaded. Try again.')})}
function dial(s,a){var w=state(s),m=q(s,'[data-dive-map]');if(w.busy||!m||m.getAttribute('data-axis')===a)return;
var here=w.trail[w.trail.length-1],keep=here.via.indexOf('tone')===0,l=lockOf(s),had=s.contains(document.activeElement);
m.setAttribute('data-axis',a);peek(s,null);w.busy=true;s.setAttribute('data-dive-busy','');
load(url(s,{key:here.key,from:keep?here.from:'',via:keep?here.via:''},l.indexOf('tone')===0?l:'')).then(function(html){if(s.__w!==w)return;show(s,html,null,had)},
function(){if(s.__w!==w)return;s.removeAttribute('data-dive-busy');w.busy=false;say(s,'That could not be loaded. Try again.')})}
function lock(s,id){var w=state(s);if(w.busy)return;var here=w.trail[w.trail.length-1],next=lockOf(s)===id?'':id,had=s.contains(document.activeElement);
peek(s,null);w.busy=true;s.setAttribute('data-dive-busy','');
load(url(s,here,next)).then(function(html){if(s.__w!==w)return;show(s,html,null,had)},
function(){if(s.__w!==w)return;s.removeAttribute('data-dive-busy');w.busy=false;say(s,'That could not be loaded. Try again.')})}
document.addEventListener('click',function(e){
var el=e.target&&e.target.closest?e.target:null,s=sec(el);if(!s)return;
var a=el.closest('a[data-dive-nav]');
if(a){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)return;if(W.nav){e.preventDefault();W.nav(a.getAttribute('href'))}return}
var k=el.closest('[data-dive-to]');if(k){back(s,+k.getAttribute('data-dive-to'));return}
var d=el.closest('[data-dive-axis]');if(d){dial(s,d.getAttribute('data-dive-axis'));return}
var b=el.closest('[data-dive-step]'),p=el.closest('[data-dive-pile]');
if(p&&!p.hasAttribute('data-on')&&!(b&&b.hasAttribute('data-dive-back'))){var n=q(p,'[data-dive-end]');
if(n)say(s,n.getAttribute('data-dive-end'));else lock(s,p.getAttribute('data-dive-pile'));return}
if(b){step(s,b);return}
var x=el.closest('[data-dive-end]');if(x){say(s,x.getAttribute('data-dive-end'));return}
var l=el.closest('[data-dive-lock]');if(l)lock(s,l.getAttribute('data-dive-lock'))});
document.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;var b=hit(e,'[data-dive-step],[data-dive-lock]'),s=sec(b);if(!s)return;
var w=state(s),here=w.trail[w.trail.length-1],p=b.closest('[data-dive-pile]');
if(b.hasAttribute('data-dive-back'))return;
if(b.hasAttribute('data-dive-lock')||(p&&!p.hasAttribute('data-on'))){var id=b.getAttribute('data-dive-lock')||p.getAttribute('data-dive-pile');
load(url(s,here,lockOf(s)===id?'':id)).catch(function(){});return}
load(url(s,{key:b.getAttribute('data-dive-step'),from:here.key,via:b.getAttribute('data-via')},lockOf(s))).catch(function(){})},true);
function over(e){var b=hit(e,'[data-dive-step]'),s=sec(b);if(!s||state(s).busy)return;peek(s,b)}
function out(e){var b=hit(e,'[data-dive-step]'),s=sec(b);if(!s||(e.relatedTarget&&b.contains(e.relatedTarget)))return;peek(s,null)}
document.addEventListener('mouseover',over);document.addEventListener('mouseout',out);
document.addEventListener('focusin',function(e){var b=hit(e,'[data-dive-step]');if(b&&b.matches(':focus-visible'))over(e)});
document.addEventListener('focusout',out);
W.boot=function(){var l=document.querySelectorAll('[data-dive]');for(var i=0;i<l.length;i++)(function(s){var w=state(s),stage=q(s,'[data-dive-stage]');
if(stage&&stage.hasAttribute('data-dive-load')&&!w.loading){w.loading=true;
load(url(s,w.trail[0],'')).then(function(h){if(s.__w!==w||w.trail.length>1)return;show(s,h,null);var c=q(s,'[data-dive-center]');w.trail[0].poster=c?c.src:''},function(){})}})(l[i])};
W.boot()
})()`

export const DIVE_CSS = `
.wk[data-dive-busy] .wk-p{opacity:.25;pointer-events:none}
.wk[data-dive-busy] .wk-open,.wk[data-dive-busy] .dv-l,.wk[data-dive-busy] .dv3-m,.wk[data-dive-busy] .dv5-dial{opacity:.4;pointer-events:none}
.wk-stage[data-dive-in] .wk-p:not([data-dive-back]){animation:wk-in .28s ease both}
.wk-stage[data-dive-in=""] .wk-p[data-dive-back]{animation:wk-in .28s ease both}
.dv-l{font-size:.8125rem;font-weight:800;line-height:1.125rem;white-space:nowrap;color:#fde68a;border-radius:9999px;padding:1px 8px;
background:rgba(253,230,138,.08);border:1px solid rgba(253,230,138,.28);transition:background .15s}
.dv-l i{font-style:normal;font-weight:400;opacity:.7}
.dv-l em{font-style:normal;font-weight:400;font-size:.6875rem}
.dv-l:hover{background:rgba(253,230,138,.2)}
.dv-l:focus-visible{outline:2px solid #fff;outline-offset:1px}
.dv-l[aria-pressed="true"]{background:#fbbf24;color:#000;border-color:#fbbf24}
.dv-l[data-dive-end]{color:#9ca3af;background:none;border:1px dashed rgba(255,255,255,.2)}
.dv-l[data-dive-end] b{font-weight:600}
.dv-bk{position:absolute;left:50%;top:50%;translate:-50% -50%;border-radius:9999px;background:rgba(0,0,0,.8);padding:0 .375rem;
color:#fff;font-size:.6875rem;font-weight:700;line-height:1.125rem;border:1px solid rgba(255,255,255,.55);pointer-events:none}
.wk-p[data-dive-back] .wk-i{outline:2px dashed rgba(255,255,255,.6)}
.wk-p[data-dive-back] img{opacity:.55}
.wk-p[data-dive-back]:hover .wk-i,.wk-p[data-dive-back]:focus-visible .wk-i{outline-color:#fbbf24}
.dv-g{display:block;aspect-ratio:2/3;visibility:hidden;border-radius:.375rem}
[data-end] .dv-g{visibility:visible;border:1px dashed rgba(255,255,255,.14)}

.dv1 .wk-c{position:absolute;left:50%;top:50%;width:24.3%;translate:-50% -50%;z-index:2}
.dv1 .dv-d{display:contents}
.dv1 .wk-p,.dv1 .dv-g{position:absolute;width:16.2%;left:calc(50% + var(--x) * 1%);top:calc(50% + var(--y) * 1%);translate:-50% -50%}
.dv1 .dv-l{position:absolute;z-index:3;translate:-50% -50%}
.dv1-n .dv-l{left:50%;top:11px}
.dv1-s .dv-l{left:50%;top:calc(100% - 11px)}
.dv1-e .dv-l{left:88.5%;top:50%}
.dv1-w .dv-l{left:11.5%;top:50%}
.dv1[data-lock] svg{display:none}
.dv1[data-lock] .wk-c{width:20%}
.dv1[data-lockpos="e"] .wk-c{left:21%}
.dv1[data-lockpos="w"] .wk-c{left:79%}
.dv1[data-lockpos="n"] .wk-c{top:80.4%}
.dv1[data-lockpos="s"] .wk-c{top:19.6%}
.dv1[data-lockpos="n"] .wk-p,.dv1[data-lockpos="s"] .wk-p,.dv1[data-lockpos="n"] .dv-g,.dv1[data-lockpos="s"] .dv-g{width:13.3%}
.dv1[data-lock] .wk-p[data-dive-back]{z-index:1}
.dv1[data-lock] .dv-l:not([aria-pressed="true"]){font-size:.75rem;padding:0 6px;opacity:.75}
.dv1[data-lockpos="e"] .dv-l:not([aria-pressed="true"]){left:2px;translate:0 -50%}
.dv1[data-lockpos="w"] .dv-l:not([aria-pressed="true"]){left:auto;right:2px;translate:0 -50%}
.dv1[data-lockpos="e"] .dv1-w .dv-l,.dv1[data-lockpos="w"] .dv1-e .dv-l{top:69%}
.dv1[data-lockpos="n"] .dv1-e .dv-l,.dv1[data-lockpos="s"] .dv1-e .dv-l{left:calc(50% + 12%);translate:0 -50%}
.dv1[data-lockpos="n"] .dv1-w .dv-l,.dv1[data-lockpos="s"] .dv1-w .dv-l{left:auto;right:calc(50% + 12%);translate:0 -50%}
.dv1[data-lockpos="n"] .dv1-e .dv-l,.dv1[data-lockpos="n"] .dv1-w .dv-l{top:80.4%}
.dv1[data-lockpos="s"] .dv1-e .dv-l,.dv1[data-lockpos="s"] .dv1-w .dv-l{top:19.6%}
.dv1[data-lockpos="n"] .dv1-s .dv-l,.dv1[data-lockpos="s"] .dv1-n .dv-l{left:80%}
.dv1[data-lockpos="e"] .dv-bk{left:26%}
.dv1[data-lockpos="w"] .dv-bk{left:74%}
.dv1[data-lockpos="n"] .dv-bk{top:80%}
.dv1[data-lockpos="s"] .dv-bk{top:20%}
.dv1-gr{position:absolute;left:calc(50% + var(--x) * 1%);top:calc(50% + var(--y) * 1%);translate:-50% -50%;font-size:.6875rem;line-height:1rem;color:#9ca3af;white-space:nowrap}

.dv2{display:grid;grid-template-areas:"n n n" "w c e" "s s s";grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);grid-template-rows:1fr auto 1fr;
gap:8px 10px;align-items:center;justify-items:center}
.dv2::before{content:"";position:absolute;left:50%;top:50%;width:64%;aspect-ratio:1;translate:-50% -50%;border-radius:9999px;
border:1px dashed rgba(255,255,255,.16)}
.dv2 .wk-c{grid-area:c;position:relative;width:76px;z-index:1}
.dv2 .dv-d{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;max-width:100%}
.dv2 .dv2-n{grid-area:n;align-self:end}
.dv2 .dv2-s{grid-area:s;align-self:start;flex-direction:column-reverse}
.dv2 .dv2-w{grid-area:w;justify-self:end;align-items:flex-end}
.dv2 .dv2-e{grid-area:e;justify-self:start;align-items:flex-start}
.dv2-r{display:flex;gap:6px;max-width:100%;padding:3px;margin:-3px}
.dv2-w .dv2-r{flex-direction:row-reverse}
.dv2 .wk-p,.dv2 .dv-g{position:relative;flex:none;width:52px}
.dv2 .dv-d:not([data-on]) .dv2-r .wk-p:nth-child(n+3){display:none}
.dv2 .dv-d[data-on]{width:100%;justify-self:stretch}
.dv2 [data-on] .dv2-r{align-self:stretch;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;padding-inline-end:28px;
-webkit-mask-image:linear-gradient(90deg,#000 86%,transparent);mask-image:linear-gradient(90deg,#000 86%,transparent)}
.dv2 .dv2-w[data-on] .dv2-r{-webkit-mask-image:linear-gradient(270deg,#000 86%,transparent);mask-image:linear-gradient(270deg,#000 86%,transparent)}
.dv2 [data-on] .dv2-r::-webkit-scrollbar{display:none}
.dv2 .dv2-n[data-on] .dv2-r,.dv2 .dv2-s[data-on] .dv2-r{justify-content:safe center}
.dv2[data-lockpos="e"]{grid-template-columns:auto auto minmax(0,1fr)}
.dv2[data-lockpos="w"]{grid-template-columns:minmax(0,1fr) auto auto}
.dv2-sc{position:absolute;right:0;font-size:.6875rem;line-height:1.375rem;color:#9ca3af;white-space:nowrap}
.dv2-n .dv2-sc,.dv2-e .dv2-sc,.dv2-w .dv2-sc{top:0}
.dv2-s .dv2-sc{bottom:0}
.dv2-w .dv2-sc{right:auto;left:0}
.dv2[data-lock] .dv-d:not([data-on]) .dv-l{opacity:.6}

.dv2.dv5{grid-template-areas:"d d d" "n n n" "w c e" "s s s";grid-template-rows:auto 1fr auto 1fr;gap:6px 10px}
.dv2.dv5::before{top:calc(50% + 15px)}
.dv5-dial{grid-area:d;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;height:24px;font-size:.75rem;color:#9ca3af}
.dv5-dial button{border-radius:9999px;padding:0 7px;line-height:1.375rem;color:#d1d5db;background:rgba(255,255,255,.07);white-space:nowrap}
.dv5-dial button:hover{background:rgba(255,255,255,.16)}
.dv5-dial button[aria-pressed="true"]{background:#e5e7eb;color:#000;font-weight:700}

.wk-dive3 .wk-trail{height:3.5rem}
.wk-dive3 .wk-hint{display:flex;align-items:center;gap:.5rem}
.wk-dive3 .wk-hint::before{content:"";flex:none;width:32px;height:48px;border-radius:4px;border:1px dashed rgba(255,255,255,.3)}
.wk-dive3 .wk-crumbs li{flex:none;min-width:0}
.wk-dive3 .wk-crumbs li:last-child{flex:0 1 auto}
.wk-dive3 .wk-crumbs img{flex:none;display:block;width:32px;height:48px;border-radius:4px;object-fit:cover;outline:1px solid rgba(255,255,255,.2)}
.wk-dive3 .wk-crumbs button span{display:none}
.wk-dive3 .wk-crumbs [aria-current] img{outline:2px solid #fff}
.wk-dive3 .wk-crumbs [aria-current] span{max-width:8rem;overflow:hidden;text-overflow:ellipsis}
.wk-map.dv3{height:340px;display:grid;grid-template-columns:29% minmax(0,1fr);column-gap:16px;align-items:center}
.dv3 .wk-c{position:relative}
.dv3-b{display:flex;flex-direction:column;gap:9px;min-width:0}
.dv3-lane{display:flex;flex-direction:column;gap:2px;min-width:0}
.dv3 .dv-l{align-self:flex-start;padding:0 6px 0 0;border:0;background:none;line-height:1rem;border-radius:2px}
.dv3 .dv-l:hover{background:none;text-decoration:underline}
.dv3 .dv-l[aria-pressed="true"]{background:none;color:#fbbf24;text-decoration:underline}
.dv3 .dv-l[data-dive-end]{border:0}
.dv3-r{display:flex;gap:6px;min-width:0;padding:2px;margin:-2px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain}
.dv3-r::-webkit-scrollbar{display:none}
.dv3 .wk-p,.dv3 .dv-g,.dv3-m{position:relative;flex:none;width:40px}
.dv3-lane:not([data-on]) .dv3-r .wk-p:nth-child(n+5){display:none}
.dv3-lane[data-on] .dv3-r{padding-inline-end:24px;-webkit-mask-image:linear-gradient(90deg,#000 86%,transparent);mask-image:linear-gradient(90deg,#000 86%,transparent)}
.dv3-m{aspect-ratio:2/3;border-radius:.375rem;border:1px dashed rgba(253,230,138,.45);color:#fde68a;font-size:1.25rem;line-height:1}
.dv3-m:hover{background:rgba(253,230,138,.15)}

.dv4 .wk-c{position:absolute;left:50%;top:50%;width:22%;translate:-50% -50%;z-index:1}
.dv4-g{position:absolute;left:calc(50% + var(--x) * 1%);top:calc(50% + var(--y) * 1%);width:0;height:0;transition:opacity .2s;--oy:122px}
.dv4-g .wk-p,.dv4-g .dv-g{position:absolute;left:0;top:0;width:60px;translate:-50% -50%}
.dv4-k0{z-index:3;transform:translate(-8px,3px)}
.dv4-k1{z-index:2;transform:translate(2px,-1px) rotate(5deg)}
.dv4-k2{z-index:1;transform:translate(12px,-5px) rotate(10deg)}
.dv4-g .dv-l{position:absolute;left:0;translate:-50% 0;z-index:4}
.dv4-top .dv-l{bottom:50px}
.dv4-bottom .dv-l{top:50px}
.dv4-g[data-on]{left:50%}
.dv4-top[data-on]{top:calc(50% - var(--oy))}
.dv4-bottom[data-on]{top:calc(50% + var(--oy))}
.dv4-g[data-on] .wk-p{width:50px;transform:translateX(calc((var(--k) - 2.5) * 16.4cqw))}
.dv4-top[data-on] .dv-l{bottom:42px}
.dv4-bottom[data-on] .dv-l{top:42px}
.dv4-sc{position:absolute;left:0;translate:-50% 0;width:96cqw;display:flex;justify-content:space-between;align-items:center;gap:8px;
font-size:.6875rem;line-height:1rem;color:#9ca3af;white-space:nowrap}
.dv4-sc::before{content:"";order:1;flex:1;height:1px;background:linear-gradient(90deg,rgba(253,230,138,.15),rgba(253,230,138,.7))}
.dv4-sc i{font-style:normal}
.dv4-sc i:last-child{order:2}
.dv4-top .dv4-sc{top:42px}
.dv4-bottom .dv4-sc{bottom:42px}
.dv4[data-lock] .dv4-g:not([data-on]){opacity:.5}
.dv4[data-lockpos="w"] .dv4-g[data-pos="n"],.dv4[data-lockpos="n"] .dv4-g[data-pos="w"],.dv4[data-lockpos="s"] .dv4-g[data-pos="e"],.dv4[data-lockpos="e"] .dv4-g[data-pos="s"]{opacity:0;pointer-events:none}

@media (min-width:1024px){
.dv-l{font-size:.9375rem;line-height:1.25rem;padding:1px 10px}
.dv1 .wk-c{width:17%}
.dv1 .wk-p,.dv1 .dv-g{width:12%}
.dv1[data-lock] .wk-c{width:15%}
.dv1[data-lockpos="n"] .wk-p,.dv1[data-lockpos="s"] .wk-p,.dv1[data-lockpos="n"] .dv-g,.dv1[data-lockpos="s"] .dv-g{width:9.7%}
.dv1-n .dv-l{top:12px}
.dv1-s .dv-l{top:calc(100% - 12px)}
.dv2{gap:10px 16px}
.dv2 .wk-c{width:92px}
.dv2 .wk-p,.dv2 .dv-g{width:62px}
.dv2 .dv-d:not([data-on]) .dv2-r .wk-p:nth-child(n+3){display:block}
.dv2 .dv-d:not([data-on]) .dv2-r .wk-p:nth-child(n+4){display:none}
.dv2.dv5{gap:8px 16px}
.dv2.dv5 .wk-c{width:80px}
.dv2.dv5 .wk-p,.dv2.dv5 .dv-g{width:56px}
.dv5-dial{height:26px;gap:8px;font-size:.875rem}
.dv5-dial button{padding:0 12px;line-height:1.5rem}
.wk-map.dv3{height:420px;grid-template-columns:150px minmax(0,1fr);column-gap:28px}
.dv3-b{gap:12px}
.dv3-lane{gap:4px}
.dv3 .dv-l{line-height:1.125rem}
.dv3 .wk-p,.dv3 .dv-g,.dv3-m{width:48px}
.dv3-lane:not([data-on]) .dv3-r .wk-p:nth-child(n+5){display:block}
.dv4 .wk-c{width:16.3%}
.dv4-g{--oy:137px}
.dv4-g .wk-p,.dv4-g .dv-g{width:72px}
.dv4-top .dv-l{bottom:60px}
.dv4-bottom .dv-l{top:60px}
.dv4-g[data-on] .wk-p{width:60px}
.dv4-top[data-on] .dv-l{bottom:49px}
.dv4-bottom[data-on] .dv-l{top:49px}
.dv4-top .dv4-sc{top:49px}
.dv4-bottom .dv4-sc{bottom:49px}
}
@media (prefers-reduced-motion:reduce){
.dv-l,.dv4-g{transition:none}
.wk-stage[data-dive-in] .wk-p{animation:none}
}
`

interface DiveWindow {
	__gwDive?: { boot: () => void; nav: ((href: string) => void) | null }
}

export default function DiveSection({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const prototype = useCarouselPrototype()
	const navigate = useNavigate()
	const html = prototype?.dive?.html
	const rootKey = `${media.mediaType}-${media.details.tmdb_id}`
	useEffect(() => {
		const w = window as DiveWindow
		// A page opened by a navigation inside the app gets no inline script run by the parser: start it here.
		if (!w.__gwDive) {
			const script = document.createElement("script")
			script.text = DIVE_SCRIPT
			document.head.appendChild(script)
		}
		w.__gwDive?.boot()
		// "Open" and the text links navigate inside the app once it runs. Before that they are plain links.
		if (w.__gwDive) w.__gwDive.nav = (href) => navigate(href)
		return () => {
			if (w.__gwDive) w.__gwDive.nav = null
		}
	}, [navigate, rootKey])
	if (!html || !prototype) return null
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: constants of this file and of WalkSection. */}
			<style dangerouslySetInnerHTML={{ __html: WALK_CSS + DIVE_CSS }} />
			<section
				className={`wk wk-${prototype.variant}`}
				data-dive={prototype.variant}
				data-dive-root={rootKey}
				data-dive-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup rendered by server/prototype-dive-view.server.tsx.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{/* After the section, so that it finds it while the document is parsed. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<script dangerouslySetInnerHTML={{ __html: DIVE_SCRIPT }} />
		</>
	)
}
