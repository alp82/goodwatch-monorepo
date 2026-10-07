// PROTOTYPE for "Prototype native-scroll carousels on title pages", third round. Throwaway code: not for production.
//
// The related titles section of the five walk variants (walk1 to walk5). The rule of this round:
//
//   A tap or click on a poster never leaves the page and never moves the scroll position. It walks: the tapped
//   title becomes the place you stand on, in place.
//
// How the rule is kept:
// - A poster is a <button>, never a link. Without script a tap does nothing; it can't navigate.
// - React renders the section's markup as one string (server/prototype-walk.server.tsx) and attaches no handler.
//   One inline script with delegated listeners drives all five variants. It runs while the document is parsed, so a
//   tap walks before hydration exactly as after it.
// - Every part of the section has a fixed height (trail, map, caption, link line), and titles and reasons are cut
//   off with an ellipsis, so a step changes nothing around the section.
// - A step swaps the stage's markup and moves the focus without scrolling. It doesn't touch the URL or the history:
//   the trail in the section is the way back, and the browser's back button leaves the page as it always did.
// - Opening a title is its own control: "Open" next to the name of the title you stand on, and the text links at
//   the bottom. Both are plain links in the server HTML (search engines follow them).
//
// Real: the titles, the groups, the reasons (walk-model.ts), and every step (one request per step).
// Faked: no title actions on posters, and a walk is forgotten when the page is left.
import { useNavigate } from "@remix-run/react"
import { useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"

export const WALK_SCRIPT = `(function(){
if(window.__gwWalk){window.__gwWalk.boot();return}
var W=window.__gwWalk={cache:{},nav:null};
function still(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function q(s,x){return s.querySelector(x)}
function sec(el){return el&&el.closest?el.closest('[data-walk]'):null}
function hit(e,x){var t=e.target;return t&&t.closest?t.closest(x):null}
function low(t){return t?t.charAt(0).toLowerCase()+t.slice(1):''}
function mark(l,i){for(var k=0;k<l.length;k++){if(k===i)l[k].setAttribute('data-on','');else l[k].removeAttribute('data-on')}}
function state(s){var k=s.getAttribute('data-walk-root');
if(!s.__w||s.__w.root!==k){var c=q(s,'[data-walk-center]');
s.__w={root:k,busy:false,at:0,hold:0,trail:[{key:k,title:s.getAttribute('data-walk-title'),poster:c?(c.currentSrc||c.src):'',html:null}]}}
return s.__w}
function url(s,key){var p=key.split('-');
return '/api/prototype-explore?variant='+s.getAttribute('data-walk')+'&type='+p[0]+'&id='+p[1]+'&root='+s.getAttribute('data-walk-root')}
function load(s,key){var u=url(s,key);
return W.cache[u]||(W.cache[u]=fetch(u).then(function(r){if(!r.ok)throw new Error(r.status);return r.text()}).catch(function(e){delete W.cache[u];throw e}))}
function crumbs(s){var w=state(s),ol=q(s,'[data-walk-crumbs]'),hint=q(s,'[data-walk-hint]');if(!ol)return;
var on=w.trail.length>1;ol.hidden=!on;if(hint)hint.hidden=on;ol.textContent='';if(!on)return;
w.trail.forEach(function(p,i){var last=i===w.trail.length-1,li=document.createElement('li'),b=document.createElement(last?'span':'button');
if(last)b.setAttribute('aria-current','step');else{b.type='button';b.setAttribute('data-walk-back',i);b.setAttribute('aria-label','Back to '+p.title)}
if(p.poster){var m=document.createElement('img');m.src=p.poster;m.alt='';m.width=32;m.height=48;b.appendChild(m)}
var t=document.createElement('span');t.textContent=p.title;b.appendChild(t);li.appendChild(b);ol.appendChild(li)});
ol.scrollLeft=ol.scrollWidth}
function show(s,html,fly,had){var w=state(s),stage=q(s,'[data-walk-stage]');had=had||s.contains(document.activeElement);
stage.innerHTML=html;stage.removeAttribute('data-walk-load');crumbs(s);s.removeAttribute('data-walk-busy');w.busy=false;w.at=0;
if(!still()){stage.removeAttribute('data-walk-in');void stage.offsetWidth;stage.setAttribute('data-walk-in','')}
if(had)s.focus({preventScroll:true});
var c=q(s,'[data-walk-center]');
function off(){if(fly&&fly.parentNode)fly.parentNode.removeChild(fly);fly=null}
if(fly){if(c&&!c.complete){c.addEventListener('load',off);c.addEventListener('error',off);setTimeout(off,2000)}else off()}}
function peek(s,b){var y=q(s,'[data-walk-why]');if(!y)return;
if(b){if(y.__d==null)y.__d=y.textContent;y.textContent=b.getAttribute('data-t')+' ('+b.getAttribute('data-y')+'): '+low(b.getAttribute('data-why'))+'.';
mark(s.querySelectorAll('[data-walk-step]'),+b.getAttribute('data-i'));mark(s.querySelectorAll('[data-spoke]'),+b.getAttribute('data-i'))}
else if(y.__d!=null){y.textContent=y.__d;y.__d=null;mark(s.querySelectorAll('[data-walk-step]'),-1);mark(s.querySelectorAll('[data-spoke]'),-1)}}
function pile(s,g){var m=q(s,'[data-walk-piles]'),y=q(s,'[data-walk-why]');if(!m)return;peek(s,null);
mark(m.querySelectorAll('[data-walk-pile]'),g?+g.getAttribute('data-walk-pile'):-1);
if(g){m.setAttribute('data-open',g.getAttribute('data-walk-pile'));if(y){if(y.__p==null)y.__p=y.textContent;
y.textContent=g.getAttribute('data-label')+': these share it. Tap one to walk there, or tap beside them to put them back.'}}
else{m.removeAttribute('data-open');if(y&&y.__p!=null){y.textContent=y.__p;y.__p=null}}}
function voice(s,i,hold){var w=state(s),n=s.querySelectorAll('[data-walk-step]');if(!n.length)return;
i=((i%n.length)+n.length)%n.length;w.at=i;if(hold)w.hold=Date.now()+12000;
mark(n,i);mark(s.querySelectorAll('[data-spoke]'),i);
var t=q(s,'[data-walk-voice-t]'),v=q(s,'[data-walk-voice-w]');
if(t&&v){t.textContent=n[i].getAttribute('data-t')+' ('+n[i].getAttribute('data-y')+')';v.textContent=n[i].getAttribute('data-why')}}
function step(s,b){var w=state(s);if(w.busy)return;
var key=b.getAttribute('data-walk-step'),stage=q(s,'[data-walk-stage]'),img=q(b,'img'),c=q(s,'[data-walk-center]');
var a=img&&img.getBoundingClientRect(),here=w.trail[w.trail.length-1],title=b.getAttribute('data-t'),why=b.getAttribute('data-why');
var had=s.contains(document.activeElement);pile(s,null);peek(s,null);here.html=stage.innerHTML;
var place={key:key,title:title,poster:img?(img.currentSrc||img.src):'',html:null};
w.busy=true;s.setAttribute('data-walk-busy','');
var fly=null,wait=0;
if(img&&c&&!still()){var z=c.getBoundingClientRect(),o=s.getBoundingClientRect();
fly=document.createElement('img');fly.src=place.poster;fly.alt='';fly.className='wk-fly';
fly.style.cssText='left:'+(a.left-o.left-s.clientLeft)+'px;top:'+(a.top-o.top-s.clientTop)+'px;width:'+a.width+'px;height:'+a.height+'px';
s.appendChild(fly);b.style.visibility='hidden';void fly.offsetWidth;
fly.style.transform='translate('+(z.left-a.left)+'px,'+(z.top-a.top)+'px) scale('+(z.width/a.width)+','+(z.height/a.height)+')';wait=300}
var t=q(s,'[data-walk-here]');if(t)t.textContent=title;
var m=q(s,'[data-walk-meta]');if(m)m.textContent=b.getAttribute('data-y')||'';
var started=Date.now();
load(s,key).then(function(html){var left=wait-(Date.now()-started);
setTimeout(function(){if(s.__w!==w)return;w.trail.push(place);show(s,html,fly,had);
var y=q(s,'[data-walk-why]');if(y&&why)y.textContent='Next to '+here.title+': '+low(why)+'.'},left>0?left:0)},
function(){if(s.__w!==w)return;if(fly&&fly.parentNode)fly.parentNode.removeChild(fly);
stage.innerHTML=here.html;s.removeAttribute('data-walk-busy');w.busy=false;
var y=q(s,'[data-walk-why]')||q(s,'[data-walk-voice-w]');if(y)y.textContent='That step could not be loaded. Try again.'})}
function back(s,i){var w=state(s);if(w.busy||i<0||i>=w.trail.length-1)return;var p=w.trail[i];w.trail.length=i+1;show(s,p.html,null)}
document.addEventListener('click',function(e){
var el=e.target&&e.target.closest?e.target:null,s=sec(el);if(!s)return;
var a=el.closest('a[data-walk-nav]');
if(a){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)return;if(W.nav){e.preventDefault();W.nav(a.getAttribute('href'))}return}
var k=el.closest('[data-walk-back]');if(k){back(s,+k.getAttribute('data-walk-back'));return}
var d=el.closest('[data-walk-voice-dir]');if(d){voice(s,state(s).at+Number(d.getAttribute('data-walk-voice-dir')),1);return}
var b=el.closest('[data-walk-step]'),m=q(s,'[data-walk-piles]');
if(m){var g=el.closest('[data-walk-pile]'),open=m.getAttribute('data-open');
if(g&&g.getAttribute('data-walk-pile')!==open){if(!state(s).busy)pile(s,g);return}
if(!b){if(open!=null)pile(s,null);return}}
if(b)step(s,b)});
document.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;var b=hit(e,'[data-walk-step]'),s=sec(b);if(!s)return;
var g=b.closest('[data-walk-pile]');if(g&&!g.hasAttribute('data-on'))return;
load(s,b.getAttribute('data-walk-step')).catch(function(){})},true);
function over(e){var b=hit(e,'[data-walk-step]'),s=sec(b);if(!s||state(s).busy)return;
if(q(s,'[data-walk-voice]'))voice(s,+b.getAttribute('data-i'),1);else peek(s,b)}
function out(e){var b=hit(e,'[data-walk-step]'),s=sec(b);if(!s||(e.relatedTarget&&b.contains(e.relatedTarget)))return;peek(s,null)}
document.addEventListener('mouseover',over);document.addEventListener('mouseout',out);
document.addEventListener('focusin',function(e){var b=hit(e,'[data-walk-step]');if(b&&b.matches(':focus-visible'))over(e)});
document.addEventListener('focusout',out);
var sx=null;
document.addEventListener('touchstart',function(e){sx=hit(e,'.wk-voice')?e.touches[0].clientX:null},{passive:true});
document.addEventListener('touchend',function(e){if(sx==null)return;var dx=e.changedTouches[0].clientX-sx,s=sec(e.target);sx=null;
if(s&&Math.abs(dx)>40)voice(s,state(s).at+(dx<0?1:-1),1)},{passive:true});
setInterval(function(){if(document.hidden||still())return;var l=document.querySelectorAll('[data-walk] [data-walk-voice]');
for(var i=0;i<l.length;i++){var s=sec(l[i]),w=state(s);if(w.busy||Date.now()<w.hold)continue;
var r=s.getBoundingClientRect();if(r.bottom<0||r.top>window.innerHeight)continue;voice(s,w.at+1)}},4000);
W.boot=function(){var l=document.querySelectorAll('[data-walk]');for(var i=0;i<l.length;i++)(function(s){var w=state(s),stage=q(s,'[data-walk-stage]');
if(stage&&stage.hasAttribute('data-walk-load')&&!w.loading){w.loading=true;
load(s,w.root).then(function(h){if(s.__w!==w||w.trail.length>1)return;show(s,h,null);var c=q(s,'[data-walk-center]');w.trail[0].poster=c?c.src:''},function(){})}})(l[i])};
W.boot()
})()`

export const WALK_CSS = `
.wk{position:relative;display:flex;flex-direction:column;gap:.625rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);
background:rgba(255,255,255,.05);padding:1rem;overflow:hidden}
.wk:focus{outline:none}
.wk button{cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.wk-h{font-size:1.25rem;line-height:1.75rem;font-weight:800;letter-spacing:-.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wk-trail{height:1.5rem;display:flex;align-items:center;min-width:0}
.wk-hint{font-size:.8125rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wk-crumbs{display:flex;align-items:center;gap:.375rem;width:100%;overflow-x:auto;white-space:nowrap;scrollbar-width:none;font-size:.8125rem;color:#d1d5db}
.wk-crumbs::-webkit-scrollbar{display:none}
.wk-crumbs[hidden],.wk-hint[hidden]{display:none}
.wk-crumbs li{display:flex;align-items:center;gap:.375rem;flex:0 1 auto;min-width:3.25rem}
.wk-crumbs li:last-child{flex-shrink:.25}
.wk-crumbs li+li::before{content:"→";flex:none;color:#6b7280}
.wk-crumbs button,.wk-crumbs [aria-current]{display:flex;align-items:center;gap:.375rem;min-width:0}
.wk-crumbs span span{overflow:hidden;text-overflow:ellipsis}
.wk-crumbs button span{overflow:hidden;text-overflow:ellipsis;text-decoration:underline;text-decoration-color:rgba(255,255,255,.35);text-underline-offset:2px}
.wk-crumbs button:hover{color:#fff}
.wk-crumbs img{display:none}
.wk-crumbs [aria-current]{font-weight:700;color:#fff}
.wk-stage{display:flex;flex-direction:column;gap:.625rem}
.wk-map{position:relative;width:100%;max-width:346px;height:372px;margin:0 auto;container-type:inline-size}
.wk-map svg{position:absolute;inset:0;width:100%;height:100%}
.wk-map line{stroke:rgba(255,255,255,.13);stroke-width:1.5;transition:stroke .15s}
.wk-map line[data-on]{stroke:#fbbf24}
.wk-map ellipse{fill:none;stroke:rgba(255,255,255,.16);stroke-width:1;stroke-dasharray:3 5;vector-effect:non-scaling-stroke}
.wk-i{display:block;border-radius:.375rem;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.55);outline:2px solid rgba(255,255,255,.14);transition:outline-color .15s}
.wk-i img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;background:rgba(255,255,255,.06)}
.wk-c{display:block}
.wk-c .wk-i{outline:3px solid #fff}
.wk-p{display:block;transition:opacity .2s,scale .2s}
.wk-p:hover .wk-i,.wk-p:focus-visible .wk-i,.wk-p[data-on] .wk-i{outline-color:#fbbf24}
.wk-p:focus-visible{outline:none}
.wk-p:active{scale:.95}
.wk[data-walk-busy] .wk-p{opacity:.25;pointer-events:none}
.wk[data-walk-busy] .wk-open{opacity:.4;pointer-events:none}
.wk-fly{position:absolute;z-index:6;max-width:none;transform-origin:0 0;transition:transform .3s cubic-bezier(.25,.8,.3,1);border-radius:.375rem;
outline:3px solid #fff;object-fit:cover;pointer-events:none}
@keyframes wk-in{from{opacity:0;scale:.88}}
.wk-stage[data-walk-in] .wk-p,.wk-stage[data-walk-in] .wk2-l,.wk-stage[data-walk-in] .wk5-l{animation:wk-in .28s ease both}
.wk-cap{display:flex;flex-direction:column;gap:.25rem;min-width:0}
.wk-here{display:flex;align-items:center;gap:.5rem;height:1.75rem;min-width:0}
.wk-here-l{display:none;flex:none;font-size:.6875rem;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af}
.wk-here b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.0625rem}
.wk-meta{flex:none;font-size:.8125rem;color:#9ca3af}
.wk-open{margin-left:auto;flex:none;border-radius:.5rem;background:#fbbf24;color:#000;font-weight:700;font-size:.8125rem;line-height:1.25rem;padding:.25rem .75rem}
.wk-open:hover{background:#fcd34d}
.wk-this{margin-left:auto;flex:none;font-size:.75rem;color:#6b7280}
.wk-why{height:2.5rem;font-size:.875rem;line-height:1.25rem;color:#e5e7eb;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.wk-why b{color:#fff}
.wk-voice{display:flex;align-items:center;gap:.375rem;touch-action:pan-y}
.wk-voice button{flex:none;width:2rem;height:2.5rem;border-radius:.5rem;background:rgba(255,255,255,.08);font-size:1.375rem;line-height:1;color:#e5e7eb}
.wk-voice button:hover{background:rgba(255,255,255,.16)}
.wk-voice .wk-why{flex:1;min-width:0}
.wk-more{display:flex;gap:.5rem;height:1.25rem;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;font-size:.8125rem;line-height:1.25rem;color:#9ca3af;
-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.wk-more::-webkit-scrollbar{display:none}
.wk-more a{color:#d1d5db}
.wk-more a:hover{color:#fff;text-decoration:underline}
.wk-more a+a::before{content:"·";margin-right:.5rem;color:#6b7280;display:inline-block}
.wk-more a:last-child{padding-right:3rem}

.wk-walk1 .wk-c,.wk-walk4 .wk-c,.wk-walk5 .wk-c{position:absolute;left:50%;top:50%;width:24.3%;translate:-50% -50%;z-index:1}
.wk-walk5 .wk-c{width:22%}
.wk-walk1 .wk-p,.wk-walk4 .wk-p{position:absolute;width:16.2%;left:calc(50% + var(--x) * 1%);top:calc(50% + var(--y) * 1%);translate:-50% -50%}
.wk-walk4 line{stroke:transparent}
.wk-walk4 .wk-p[data-on]{scale:1.14;z-index:2}

.wk-walk2 .wk-map{display:grid;grid-template-areas:"n n n" "w c e" "s s s";grid-template-columns:1fr auto 1fr;grid-template-rows:1fr auto 1fr;
gap:10px 12px;align-items:center;justify-items:center}
.wk-walk2 .wk-map::before{content:"";position:absolute;left:50%;top:50%;width:64%;aspect-ratio:1;translate:-50% -50%;border-radius:9999px;
border:1px dashed rgba(255,255,255,.16)}
.wk-walk2 .wk-c{grid-area:c;position:relative;width:76px;z-index:1}
.wk2-d{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.wk2-n{grid-area:n;align-self:end}
.wk2-s{grid-area:s;align-self:start;flex-direction:column-reverse}
.wk2-w{grid-area:w;justify-self:end}
.wk2-e{grid-area:e;justify-self:start}
.wk2-l{font-size:.8125rem;font-weight:800;line-height:1.125rem;white-space:nowrap;color:#fde68a}
.wk2-l i{font-style:normal;font-weight:400;color:#9ca3af}
.wk2-w .wk2-l,.wk2-e .wk2-l{max-width:110px;overflow:hidden;text-overflow:ellipsis}
.wk2-r{display:flex;gap:6px}
.wk-walk2 .wk-p{width:52px}
.wk2-r .wk-p:nth-child(3){display:none}

.wk-walk3 .wk-trail{height:3.5rem}
.wk-walk3 .wk-hint{display:flex;align-items:center;gap:.5rem}
.wk-walk3 .wk-hint::before{content:"";flex:none;width:32px;height:48px;border-radius:4px;border:1px dashed rgba(255,255,255,.3)}
.wk-walk3 .wk-crumbs li{flex:none;min-width:0}
.wk-walk3 .wk-crumbs li:last-child{flex:0 1 auto}
.wk-walk3 .wk-crumbs img{flex:none;display:block;width:32px;height:48px;border-radius:4px;object-fit:cover;outline:1px solid rgba(255,255,255,.2)}
.wk-walk3 .wk-crumbs button span{display:none}
.wk-walk3 .wk-crumbs [aria-current] img{outline:2px solid #fff}
.wk-walk3 .wk-crumbs [aria-current] span{max-width:8rem;overflow:hidden;text-overflow:ellipsis}
.wk-walk3 .wk-map{height:340px;display:grid;grid-template-columns:29% minmax(0,1fr);column-gap:22px;align-items:center}
.wk-walk3 .wk-c{position:relative}
.wk-walk3 .wk-c::after{content:"";position:absolute;left:100%;top:50%;width:22px;border-top:2px solid rgba(255,255,255,.22)}
.wk3-b{position:relative;display:flex;flex-direction:column;gap:8px}
.wk3-b::before{content:"";position:absolute;left:0;top:30px;bottom:30px;border-left:2px solid rgba(255,255,255,.22)}
.wk3-b .wk-p{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr);gap:10px;align-items:center;width:100%;height:60px;padding-left:14px;text-align:left}
.wk3-b .wk-p::before{content:"";position:absolute;left:0;top:50%;width:10px;border-top:2px solid rgba(255,255,255,.22)}
.wk3-x{display:flex;flex-direction:column;min-width:0}
.wk3-x b{font-size:.875rem;line-height:1.2;color:#fde68a}
.wk3-x span,.wk3-x em{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wk3-x span{font-size:.8125rem;line-height:1.3;color:#e5e7eb}
.wk3-x em{display:none;font-style:normal;font-size:.75rem;line-height:1.3;color:#9ca3af}

.wk5-g{position:absolute;left:calc(50% + var(--x) * 1%);top:calc(50% + var(--y) * 1%);width:0;height:0;transition:opacity .2s;--s:1}
.wk5-right{--s:-1}
.wk5-g .wk-p{position:absolute;left:0;top:0;width:60px;translate:-50% -50%;transition:transform .28s cubic-bezier(.25,.8,.3,1),opacity .2s,scale .2s}
.wk5-k0{z-index:3;transform:translate(-8px,3px)}
.wk5-k1{z-index:2;transform:translate(2px,-1px) rotate(5deg)}
.wk5-k2{z-index:1;transform:translate(12px,-5px) rotate(10deg)}
.wk5-l{position:absolute;left:0;translate:-50% 0;max-width:46cqw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
font-size:.8125rem;font-weight:800;line-height:1.125rem;color:#fde68a;transition:opacity .2s}
.wk5-top .wk5-l{bottom:54px}
.wk5-bottom .wk5-l{top:54px}
.wk5-t{display:none;position:absolute;left:50%;translate:-50% 0;width:30cqw;font-size:.6875rem;line-height:.75rem;text-align:center;color:#e5e7eb;
overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.wk5-top .wk5-t{bottom:calc(100% + 4px)}
.wk5-bottom .wk5-t{top:calc(100% + 4px)}
.wk5-g[data-on] .wk5-k0{transform:none}
.wk5-g[data-on] .wk5-k1{transform:translateX(calc(var(--s) * 31cqw))}
.wk5-g[data-on] .wk5-k2{transform:translateX(calc(var(--s) * 62cqw))}
.wk5-g[data-on] .wk5-t{display:-webkit-box}
.wk5-g[data-on] .wk5-l{opacity:0;pointer-events:none}
.wk-map[data-open] .wk5-g:not([data-on]){opacity:.3}
.wk-map[data-open="0"] .wk5-g[data-walk-pile="1"]:not([data-on]),.wk-map[data-open="1"] .wk5-g[data-walk-pile="0"]:not([data-on]),
.wk-map[data-open="2"] .wk5-g[data-walk-pile="3"]:not([data-on]),.wk-map[data-open="3"] .wk5-g[data-walk-pile="2"]:not([data-on]){opacity:0;pointer-events:none}

@media (min-width:1024px){
.wk{padding:1.5rem;gap:.75rem}
.wk-h{font-size:1.5rem;line-height:2rem}
.wk-stage{display:grid;grid-template-columns:540px minmax(0,1fr);column-gap:3rem;row-gap:.75rem;align-items:center}
.wk-map{max-width:540px;height:420px;margin:0}
.wk-more{grid-column:1/-1}
.wk-cap{gap:.75rem;max-width:34rem}
.wk-here{height:2.25rem;gap:.75rem}
.wk-here-l{display:block}
.wk-here b{font-size:1.5rem}
.wk-meta{font-size:.9375rem}
.wk-open{font-size:.9375rem;padding:.375rem 1rem}
.wk-why{height:4.5rem;font-size:1rem;line-height:1.5rem;-webkit-line-clamp:3}
.wk-voice button{height:3rem}
.wk-voice .wk-why{height:3rem;-webkit-line-clamp:2}
.wk-walk1 .wk-c,.wk-walk4 .wk-c{width:19.3%}
.wk-walk5 .wk-c{width:16.3%}
.wk-walk1 .wk-p,.wk-walk4 .wk-p{width:13.3%}
.wk-walk2 .wk-map{gap:12px 16px}
.wk-walk2 .wk-c{width:96px}
.wk-walk2 .wk-p{width:64px}
.wk2-r .wk-p:nth-child(3){display:block}
.wk2-l{font-size:.9375rem}
.wk2-w .wk2-l,.wk2-e .wk2-l{max-width:204px}
.wk-walk3 .wk-map{height:420px;grid-template-columns:150px minmax(0,1fr);column-gap:28px}
.wk-walk3 .wk-c::after{width:28px}
.wk3-b{gap:10px}
.wk3-b::before{top:38px;bottom:38px}
.wk3-b .wk-p{grid-template-columns:48px minmax(0,1fr);gap:14px;height:76px;padding-left:20px}
.wk3-b .wk-p::before{width:14px}
.wk3-x b{font-size:1rem}
.wk3-x span{font-size:.875rem}
.wk3-x em{display:block}
.wk5-g .wk-p{width:72px}
.wk5-top .wk5-l{bottom:64px}
.wk5-bottom .wk5-l{top:64px}
.wk5-l{font-size:.9375rem}
.wk5-t{font-size:.75rem;line-height:.875rem}
}
@media (prefers-reduced-motion:reduce){
.wk-p,.wk-fly,.wk5-g,.wk5-g .wk-p,.wk5-l{transition:none}
.wk-stage[data-walk-in] .wk-p,.wk-stage[data-walk-in] .wk2-l,.wk-stage[data-walk-in] .wk5-l{animation:none}
}
`

interface WalkWindow {
	__gwWalk?: { boot: () => void; nav: ((href: string) => void) | null }
}

export default function WalkSection({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const prototype = useCarouselPrototype()
	const navigate = useNavigate()
	const html = prototype?.walk?.html
	const rootKey = `${media.mediaType}-${media.details.tmdb_id}`
	useEffect(() => {
		const w = window as WalkWindow
		// A page opened by a navigation inside the app gets no inline script run by the parser: start it here.
		if (!w.__gwWalk) {
			const script = document.createElement("script")
			script.text = WALK_SCRIPT
			document.head.appendChild(script)
		}
		w.__gwWalk?.boot()
		// "Open" and the text links navigate inside the app once it runs. Before that they are plain links.
		if (w.__gwWalk) w.__gwWalk.nav = (href) => navigate(href)
		return () => {
			if (w.__gwWalk) w.__gwWalk.nav = null
		}
	}, [navigate, rootKey])
	if (!html || !prototype) return null
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: WALK_CSS }} />
			<section
				className={`wk wk-${prototype.variant}`}
				data-walk={prototype.variant}
				data-walk-root={rootKey}
				data-walk-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup rendered by server/prototype-walk.server.tsx.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{/* After the section, so that it finds it while the document is parsed. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<script dangerouslySetInnerHTML={{ __html: WALK_SCRIPT }} />
		</>
	)
}
