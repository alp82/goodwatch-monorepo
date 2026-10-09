// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The style of the play forms. The server puts it into the page next to the section; a page opened by a navigation
// inside the app gets it from the lazy chunk (play-client.ts). Never part of the title route's own script.
import { BEST_CSS } from "~/ui/prototype-carousels/best-css"
import { ROAM_CSS } from "~/ui/prototype-carousels/roam-css"
import { SCRUB_CSS } from "~/ui/prototype-carousels/scrub-css"

export const PLAY_CSS = `
.pl{position:relative;display:flex;flex-direction:column;gap:.5rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);
background:rgba(255,255,255,.05);padding:1rem;overflow:hidden;contain:layout style}
.pl:focus{outline:none}
.pl :where(button){cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;font:inherit;color:inherit}
.pl button:focus-visible{outline:2px solid #fff;outline-offset:1px}
.pl i{font-style:normal}
.pl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.pl-h{font-size:1.25rem;line-height:1.75rem;font-weight:800;letter-spacing:-.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-bar{height:1.625rem;display:flex;align-items:center;gap:.5rem;min-width:0}
.pl-hint{font-size:.8125rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-back{flex:none;border-radius:9999px;background:rgba(255,255,255,.14);padding:0 .625rem;font-size:.8125rem;font-weight:700;line-height:1.5rem;color:#fff;white-space:nowrap}
.pl-back:hover{background:rgba(255,255,255,.24)}
.pl-crumbs{display:flex;align-items:center;gap:.375rem;flex:1;min-width:0;overflow-x:auto;white-space:nowrap;scrollbar-width:none;font-size:.8125rem;color:#d1d5db}
.pl-crumbs::-webkit-scrollbar{display:none}
.pl-crumbs li{display:flex;align-items:center;gap:.375rem;flex:0 1 auto;min-width:2.75rem}
.pl-crumbs li:last-child{flex-shrink:.25}
.pl-crumbs li+li::before{content:"›";flex:none;color:#6b7280}
.pl-crumbs button,.pl-crumbs [aria-current]{min-width:0;overflow:hidden;text-overflow:ellipsis}
.pl-crumbs button{text-decoration:underline;text-decoration-color:rgba(255,255,255,.35);text-underline-offset:2px}
.pl-crumbs button:hover{color:#fff}
.pl-crumbs [aria-current]{font-weight:700;color:#fff}
.pl-bar{position:relative;z-index:6}
.pl-hs{overflow:visible}
.pl-hs li{flex:0 1 auto;min-width:0}
.pl-hs .pl-h0{max-width:38%}
.pl-hs li:last-child{flex:1 1 0;flex-shrink:1}
.pl-hm{position:relative;flex:none!important}
.pl-hm summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:.25rem;border-radius:9999px;background:rgba(255,255,255,.14);padding:0 .5rem;font-weight:700;line-height:1.375rem;color:#fff;
font-variant-numeric:tabular-nums;-webkit-tap-highlight-color:transparent}
.pl-hm summary::-webkit-details-marker{display:none}
.pl-hm summary::after{content:"▾";font-size:.625rem;color:#d1d5db}
.pl-hm summary:hover,.pl-hm details[open] summary{background:rgba(255,255,255,.26)}
.pl-hm details>ol{position:absolute;left:0;top:1.75rem;z-index:7;display:flex;flex-direction:column;width:max-content;max-width:min(15rem,56vw);max-height:15rem;overflow-y:auto;overscroll-behavior:contain;
border-radius:.5rem;background:#141925;border:1px solid rgba(255,255,255,.22);box-shadow:0 10px 28px rgba(0,0,0,.7);padding:.25rem}
.pl-hm details>ol li{display:block;min-width:0}
.pl-hm details>ol li::before{content:none!important}
.pl-hm details>ol button{display:flex;gap:.5rem;width:100%;padding:.3125rem .5rem;border-radius:.375rem;text-align:left;text-decoration:none;line-height:1.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-hm details>ol button:hover{background:rgba(255,255,255,.12)}
.pl-hm details>ol i{flex:none;width:1.25rem;color:#9ca3af;font-variant-numeric:tabular-nums}
.pl-body{display:flex;flex-direction:column;gap:.5rem;min-width:0}
.pl-stage{position:relative;height:360px;container-type:inline-size;contain:layout paint style;--u:1cqw;--ux:1cqw;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.pl-side{display:flex;flex-direction:column;gap:.375rem;min-width:0}
.pl-p{position:relative;display:block;padding:0;border-radius:.375rem;background:#1b2130;outline:2px solid rgba(255,255,255,.14);box-shadow:0 4px 14px rgba(0,0,0,.55)}
.pl-p img,.pl-c img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:.375rem}
.pl-p:hover,.pl-p:focus-visible{outline-color:#fbbf24}
.pl-p:active{filter:brightness(1.3)}
.pl-ph{display:block;aspect-ratio:2/3;border-radius:.375rem;background:rgba(255,255,255,.045);outline:1px dashed rgba(255,255,255,.13)}
.pl-c{display:block;border-radius:.375rem;background:#1b2130;outline:3px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.6)}
.pl-p[data-pl-came]{outline:2px dashed rgba(255,255,255,.6)}
.pl-p[data-pl-came] img{opacity:.5}
.pl-p[data-pl-came]:hover{outline-color:#fbbf24}
.pl-cm{position:absolute;left:50%;top:50%;translate:-50% -50%;border-radius:9999px;background:rgba(0,0,0,.82);padding:0 .375rem;color:#fff;font-size:.6875rem;font-weight:700;
line-height:1.125rem;border:1px solid rgba(255,255,255,.55);white-space:nowrap;pointer-events:none}
@keyframes pl-in0{from{opacity:.2}}
@keyframes pl-in1{from{opacity:.2}}
.pl-stage[data-pl-in$="0"] .pl-p{animation:pl-in0 .14s ease-out both}
.pl-stage[data-pl-in$="1"] .pl-p{animation:pl-in1 .14s ease-out both}
.pl-mk{display:inline-flex;align-items:center;font-size:.75rem;line-height:1}
.pl-mk b{font-size:.5rem;margin-left:1px;color:var(--c)}
.pl-mk[data-s="-"] b{color:#9ca3af}
.pl-tr{display:inline-flex;align-items:center;gap:.25rem;border-radius:9999px;padding:0 .5rem;font-size:.75rem;line-height:1.375rem;color:#fff;white-space:nowrap;
background:color-mix(in srgb,var(--c) 20%,transparent);border:1px solid color-mix(in srgb,var(--c) 50%,transparent)}
.pl-card{display:flex;flex-direction:column;gap:.125rem;min-width:0}
.pl-here{display:flex;align-items:center;gap:.5rem;height:1.75rem;min-width:0}
.pl-here b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.0625rem}
.pl-meta{flex:none;font-size:.8125rem;color:#9ca3af}
.pl-open{margin-left:auto;flex:none;border-radius:.5rem;background:#fbbf24;color:#000;font-weight:700;font-size:.8125rem;line-height:1.25rem;padding:.25rem .75rem}
.pl-open:hover{background:#fcd34d}
.pl-this{margin-left:auto;flex:none;font-size:.75rem;color:#6b7280}
.pl-why{height:2.5rem;font-size:.875rem;line-height:1.25rem;color:#e5e7eb;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.pl-fp{display:flex;gap:.375rem;height:1.5rem;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 90%,transparent);mask-image:linear-gradient(90deg,#000 90%,transparent)}
.pl-fp::-webkit-scrollbar{display:none}
.pl-fi{flex:none;display:inline-flex;align-items:center;gap:.25rem;border-radius:9999px;padding:0 .5rem;font-size:.75rem;line-height:1.375rem;color:#e5e7eb;white-space:nowrap;
background:color-mix(in srgb,var(--c) 16%,transparent);border:1px solid color-mix(in srgb,var(--c) 40%,transparent)}
.pl-fi b{font-weight:500}
.pl-fi s{display:none}
.pl-fi em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums;color:#fff}
.pl-fi small{font-size:.5rem;margin-left:1px;color:var(--c)}
.pl-fi:last-child{margin-right:2rem}
.pl-more{display:flex;gap:.5rem;height:1.25rem;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;font-size:.8125rem;line-height:1.25rem;color:#9ca3af;
-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.pl-more::-webkit-scrollbar{display:none}
.pl-more a{color:#d1d5db}
.pl-more a:hover{color:#fff;text-decoration:underline}
.pl-more a+a::before{content:"·";margin-right:.5rem;color:#6b7280;display:inline-block}
.pl-more a:last-child{padding-right:3rem}

.p1{position:absolute;inset:0;overflow:hidden}
.p1-w{position:absolute;inset:0;transition:translate .15s ease-out}
.p1[data-deep] .p1-w{translate:calc(var(--px)*var(--ux)) calc(var(--py)*var(--u))}
.p1 svg{position:absolute;left:50%;top:50%;width:calc(100*var(--ux));height:calc(104*var(--u));translate:-50% -50%;transition:opacity .15s}
.p1 line{stroke:rgba(255,255,255,.12);stroke-width:1;stroke-dasharray:3 5;vector-effect:non-scaling-stroke}
.p1[data-deep] svg{opacity:0}
.p1-c,.p1-p,.p1-l,.p1-rk,.p1-x{position:absolute;left:50%;top:50%;translate:calc(var(--x)*var(--ux) - 50%) calc(var(--y)*var(--u) - 50%)}
.p1-c{--x:0;--y:0;width:calc(22*var(--u));z-index:2;padding:0;border-radius:.375rem;transition:scale .15s ease-out}
.p1[data-deep] .p1-c{scale:var(--cs)}
.p1-p{width:calc(13*var(--u));z-index:1;transition:translate .15s ease-out,width .15s ease-out,opacity .15s}
.p1-p:not(.p1-r){opacity:0;visibility:hidden}
.p1[data-deep] .p1-d[data-on] .p1-p:not(.p1-r){animation:pl-in0 .15s ease-out both}
.p1[data-deep] .p1-d:not([data-on]) .p1-p{opacity:0;visibility:hidden}
.p1[data-deep] .p1-d[data-on] .p1-p,.p1[data-deep] .p1-d[data-under] .p1-k{opacity:1;visibility:visible;width:calc(var(--dw)*var(--u));
translate:calc(var(--dx)*var(--ux) - 50%) calc(var(--dy)*var(--u) - 50%)}
.p1[data-deep] .p1-d[data-under] .p1-k{z-index:0}
.p1-al{translate:calc(var(--x)*var(--ux)) calc(var(--y)*var(--u) - 50%)}
.p1-ar{translate:calc(var(--x)*var(--ux) - 100%) calc(var(--y)*var(--u) - 50%)}
.p1-ls{transition:opacity .15s}
.p1[data-deep] .p1-ls{opacity:0;visibility:hidden}
.p1-l{display:inline-flex;align-items:center;gap:.25rem;z-index:3;white-space:nowrap;font-size:.71875rem;line-height:1.25rem;border-radius:9999px;padding:0 .5rem;color:#fde68a;
background:rgba(253,230,138,.08);border:1px solid rgba(253,230,138,.3)}
.p1-l b{font-weight:800}
.p1-l u{text-decoration:none;font-weight:800;color:#000;background:#fbbf24;border-radius:9999px;padding:0 .3125rem;margin-right:-.3125rem;font-size:.625rem;line-height:.9375rem}
button.p1-l:hover{background:rgba(253,230,138,.22)}
span.p1-l{background:none;border-color:transparent;padding-inline:0}
.p1-e{color:#9ca3af}
.p1-e u{background:none;color:#9ca3af;font-weight:400;padding:0;margin:0}
.p1-f{opacity:0;visibility:hidden;transition:opacity .15s}
.p1-f[data-on]{opacity:1;visibility:visible}
.p1-x{display:inline-flex;align-items:center;gap:.375rem;z-index:4;white-space:nowrap;font-size:.75rem;line-height:1.25rem;color:#fde68a}
.p1-x button{border-radius:9999px;background:#fff;color:#000;font-weight:700;padding:0 .5rem;line-height:1.375rem;box-shadow:0 1px 6px rgba(0,0,0,.5)}
.p1-x button:hover{background:#fde68a}
.p1-x b{font-weight:800;display:inline-flex;gap:.25rem}
.p1-rk{font-size:.6875rem;line-height:1rem;color:#9ca3af;white-space:nowrap;pointer-events:none}

.p3{position:absolute;inset:0;overflow:hidden;border-radius:.5rem}
.p3-m{position:absolute;inset:0;-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,.25),#000 13%,#000 87%,rgba(0,0,0,.25)),linear-gradient(rgba(0,0,0,.2),#000 10%,#000 90%,rgba(0,0,0,.2));
mask-image:linear-gradient(90deg,rgba(0,0,0,.25),#000 13%,#000 87%,rgba(0,0,0,.25)),linear-gradient(rgba(0,0,0,.2),#000 10%,#000 90%,rgba(0,0,0,.2));-webkit-mask-composite:source-in;mask-composite:intersect}
.p3-w{position:absolute;inset:0}
@keyframes p3-in0{from{translate:calc(var(--fx)*var(--u)) calc(var(--fy)*var(--u))}}
@keyframes p3-in1{from{translate:calc(var(--fx)*var(--u)) calc(var(--fy)*var(--u))}}
.pl-stage[data-pl-in="step0"] .p3-w{animation:p3-in0 .15s cubic-bezier(.2,.8,.3,1)}
.pl-stage[data-pl-in="step1"] .p3-w{animation:p3-in1 .15s cubic-bezier(.2,.8,.3,1)}
.pl-stage[data-pl-in^="step"] .p3 .pl-p{animation:none}
.p3-p{position:absolute;left:50%;top:50%;width:calc(19*var(--u));translate:calc(var(--x)*var(--u) - 50%) calc(var(--y)*var(--u) - 50%)}
.p3-o{opacity:.62}
.p3-o:hover,.p3-o:focus-visible{opacity:1}
.p3-c{z-index:2;scale:1.06}
.p3-x{display:none}
.p3-l{position:absolute;left:50%;top:50%;z-index:3;display:inline-flex;align-items:center;gap:.1875rem;white-space:nowrap;pointer-events:none;font-size:.6875rem;line-height:1.125rem;
border-radius:9999px;padding:0 .4375rem;color:#fde68a;background:rgba(10,13,22,.86);border:1px solid rgba(253,230,138,.32);translate:calc(var(--x)*1cqw - 50%) calc(var(--y)*var(--u) - 50%)}
.p3-l b{font-weight:800}
.p3-l u{text-decoration:none;opacity:.75}
.p3-l em{font-style:normal;font-weight:400;color:#9ca3af}
.p3-al{translate:calc(var(--x)*1cqw + 3px) calc(var(--y)*var(--u) - 50%)}
.p3-ar{translate:calc(var(--x)*1cqw - 100% - 3px) calc(var(--y)*var(--u) - 50%)}
.p3-e{color:#9ca3af;border-color:rgba(255,255,255,.18)}

.p6{position:absolute;inset:0;display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x pan-y}
.p6::-webkit-scrollbar{display:none}
.p6-g{flex:none;width:calc(100% - 38px);height:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:6px;scroll-snap-align:start;padding:2px}
.p6-1{grid-template-areas:"C C a b" "C C a c" "d e f f" "g g h i"}
.p6-2{grid-template-areas:"j k a b" "l m a c" "d e f f" "g g h i";scroll-snap-align:end}
.p6-t,.p6-c{position:relative;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden}
.p6-t img,.p6-c img{width:100%;height:100%;aspect-ratio:auto;object-fit:cover;object-position:50% 18%}
.p6-c{border-radius:.375rem;outline:3px solid #fff;outline-offset:-1px}
.p6-c .pl-c{height:100%;outline:0}
.p6-own{position:absolute;left:0;right:0;bottom:0;display:flex;gap:.25rem;padding:1.25rem .375rem .3125rem;background:linear-gradient(transparent,rgba(0,0,0,.85));pointer-events:none}
.p6-own i{font-size:.6875rem;font-weight:700;line-height:1.125rem;border-radius:9999px;padding:0 .375rem;background:color-mix(in srgb,var(--c) 45%,#000);white-space:nowrap}
.p6-m{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:.3125rem;padding:.875rem 0 .1875rem;background:linear-gradient(transparent,rgba(0,0,0,.88) 55%);border-radius:0 0 .375rem .375rem}
.p6-m .pl-mk{font-size:.8125rem}
.p6-m .pl-mk b{font-size:.5625rem}
.p6-wd{display:grid;grid-template-columns:auto minmax(0,1fr);text-align:left}
.p6-wd{grid-template-columns:34% minmax(0,1fr)}
.p6-wd img{border-radius:.375rem 0 0 .375rem}
.p6-w{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:0;padding:0 .25rem 0 .375rem;font-size:.6875rem;line-height:.9375rem;color:#d1d5db}
.p6-w b{font-size:.75rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p6-w span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p6-w span[data-s="+"]{color:#fff}
.p6-w u{text-decoration:none;font-size:.5rem;margin-right:2px;color:var(--c)}
.p6-w span[data-s="-"] u{color:#9ca3af}

.p7{position:absolute;inset:0;display:flex;flex-direction:column;gap:5px}
.p7-chips{flex:none;display:flex;gap:.375rem;height:1.75rem;align-items:center;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x pan-y;padding:0 2px;
-webkit-mask-image:linear-gradient(90deg,#000 90%,transparent);mask-image:linear-gradient(90deg,#000 90%,transparent)}
.p7-chips::-webkit-scrollbar{display:none}
.p7-ch{flex:none;line-height:1.5rem;font-weight:600}
.p7-ch em{font-style:normal;font-weight:800;opacity:.8}
.p7-ch:last-child{margin-right:2rem}
.p7-ch[aria-pressed="true"]{background:var(--c);border-color:#fff;color:#000;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
.p7-n{flex:none;height:1rem;font-size:.6875rem;line-height:1rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p7-n b{color:#fff}
.p7-g{flex:1;min-height:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:6px;padding:2px}
.p7-p{min-height:0;overflow:hidden}
.p7-p img{height:100%;aspect-ratio:auto;object-position:50% 15%}
.p7-off{opacity:.24;outline-color:transparent;box-shadow:none}
.p7-off:hover{opacity:.7}
.p7-b{position:absolute;left:0;right:0;bottom:0;display:flex;gap:1px;padding:.625rem 3px 3px;background:linear-gradient(transparent,rgba(0,0,0,.9) 60%);border-radius:0 0 .375rem .375rem}
.p7-b i{flex:1;height:5px;border-radius:1px;background:rgba(255,255,255,.14)}
.p7-b i[data-on]{background:var(--c)}
.p7-b i[data-pin][data-on]{height:9px;margin-top:-4px;box-shadow:0 0 0 1px #fff}
.p7-x{display:none}
.p7-me{outline-offset:-1px}

.p10{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px}
.p10-path{flex:none;height:66px;display:flex;align-items:center;gap:.3125rem;min-width:0;overflow:hidden}
.p10-lb{flex:none;font-size:.6875rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-right:.125rem}
.p10-s{flex:none;width:34px;border-radius:.25rem;overflow:hidden;opacity:.75;outline:1px solid rgba(255,255,255,.2)}
.p10-s:hover{opacity:1;outline-color:#fbbf24}
.p10-s img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover}
.p10-v{flex:none;font-size:.75rem;color:#9ca3af}
.p10-c{flex:none;width:44px}
.p10-cards{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:2px}
.p10-k{display:flex;flex-direction:column;min-height:0;min-width:0;text-align:left;overflow:hidden;background:rgba(255,255,255,.06)}
.p10-k img,.p10-k .pl-ph{flex:1;min-height:0;height:auto;aspect-ratio:auto;object-position:50% 18%;border-radius:.375rem .375rem 0 0}
.p10-d{flex:none;display:flex;flex-direction:column;gap:1px;height:5.125rem;padding:.3125rem .375rem;font-size:.6875rem;line-height:.9375rem;color:#d1d5db}
.p10-d b{font-size:.75rem;line-height:1rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p10-d span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
.p10-d u{text-decoration:none;font-size:.5rem;margin-right:2px;color:var(--c)}
.p10-d span[data-s="-"] u{color:#9ca3af}
.p10-none{grid-column:span 3;align-self:center;text-align:center;font-size:.8125rem;color:#9ca3af}
.p10-deal{flex:none;align-self:center;height:1.5rem;border-radius:9999px;padding:0 .75rem;font-size:.75rem;font-weight:700;line-height:1.5rem;color:#fde68a}
button.p10-deal{background:rgba(253,230,138,.1);border:1px solid rgba(253,230,138,.3)}
button.p10-deal:hover{background:rgba(253,230,138,.22)}
.p10-deal small{font-weight:400;opacity:.7}

.p2{position:absolute;inset:0;overflow:hidden;border-radius:.625rem;background:radial-gradient(70% 55% at 50% 100%,rgba(56,120,190,.3),transparent 75%),linear-gradient(#050814,#0a1226 55%,#0d1a36);
box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.p2 svg{position:absolute;left:50%;top:50%;width:calc(100*var(--ux));height:calc(104*var(--u));translate:-50% -50%;overflow:visible}
.p2 line{stroke-width:1.5;vector-effect:non-scaling-stroke}
.p2 ellipse{fill:none;stroke:rgba(125,211,252,.13);stroke-width:1;stroke-dasharray:2 6;vector-effect:non-scaling-stroke}
.p2-d{display:contents}
.p2-p[data-rk="0"],.p2-p[data-pl-came]{z-index:3}
.p2-p[data-rk="1"]{z-index:2}
.p2-p,.p2-c,.p2-l{position:absolute;left:50%;top:50%;translate:calc(var(--x)*var(--ux) - 50%) calc(var(--y)*var(--u) - 50%)}
.p2-p{width:calc(var(--w)*var(--u));z-index:1;box-shadow:0 0 0 1px rgba(125,211,252,.25),0 6px 16px rgba(0,0,0,.7)}
.p2-c{width:calc(18*var(--u));z-index:4;box-shadow:0 0 22px 2px rgba(125,211,252,.45)}
.p2-l{z-index:5;display:inline-flex;align-items:center;gap:.1875rem;white-space:nowrap;pointer-events:none;font-size:.6875rem;line-height:1.125rem;border-radius:9999px;padding:0 .4375rem;
color:#e0f2fe;background:rgba(8,14,30,.8);border:1px solid rgba(125,211,252,.35)}
.p2-l b{font-weight:800}
.p2-l em{font-style:normal;font-weight:400;color:#94a3b8}
.p2-al{translate:calc(var(--x)*1cqw + 2px) calc(var(--y)*var(--u) - 50%)}
.p2-ar{translate:calc(var(--x)*1cqw - 100% - 2px) calc(var(--y)*var(--u) - 50%)}
.p2-e{color:#94a3b8;border-color:rgba(255,255,255,.16)}
.p2-far{position:absolute;left:50%;bottom:3px;translate:-50% 0;font-size:.625rem;letter-spacing:.04em;color:#7c8aa5;white-space:nowrap;display:none}

.p4{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px}
.p4-mix{flex:none;display:flex;flex-direction:column;gap:2px}
.p4-r{display:grid;grid-template-columns:8.25rem minmax(0,1fr) 1.5rem;align-items:center;gap:.375rem;height:1.875rem;font-size:.75rem;color:#e5e7eb}
.p4-r>span:first-child{display:flex;align-items:center;gap:.25rem;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.p4-s{position:relative;display:flex;align-items:center;height:100%}
.p4-s input{-webkit-appearance:none;appearance:none;width:100%;height:1.875rem;margin:0;background:none;touch-action:pan-y;cursor:pointer}
.p4-s input::-webkit-slider-runnable-track{height:.4375rem;border-radius:9999px;background:linear-gradient(90deg,var(--c) calc(var(--t)*10%),rgba(255,255,255,.12) calc(var(--t)*10%))}
.p4-s input::-moz-range-track{height:.4375rem;border-radius:9999px;background:linear-gradient(90deg,var(--c) calc(var(--t)*10%),rgba(255,255,255,.12) calc(var(--t)*10%))}
.p4-s input::-webkit-slider-thumb{-webkit-appearance:none;width:1.25rem;height:1.25rem;margin-top:-.40625rem;border-radius:9999px;background:#fff;border:3px solid var(--c);box-shadow:0 1px 5px rgba(0,0,0,.6)}
.p4-s input::-moz-range-thumb{width:.875rem;height:.875rem;border-radius:9999px;background:#fff;border:3px solid var(--c)}
.p4-s u{position:absolute;left:calc(.625rem + (100% - 1.25rem)*var(--o)/10);top:50%;width:2px;height:.875rem;translate:-50% -50%;background:#fff;opacity:.55;pointer-events:none}
.p4-r output{font-weight:800;font-variant-numeric:tabular-nums;text-align:right}
.p4-n{display:flex;align-items:center;gap:.5rem;height:1.875rem;font-size:.6875rem;line-height:.9375rem;color:#9ca3af}
.p4-n span{flex:1;min-width:0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.p4-n button{flex:none;border-radius:9999px;padding:0 .625rem;line-height:1.375rem;font-weight:700;color:#fde68a;background:rgba(253,230,138,.1);border:1px solid rgba(253,230,138,.3)}
.p4-n button[hidden]{display:none}
.p4-g{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,4fr);gap:6px;padding:2px}
.p4-gg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:6px;min-height:0;grid-auto-flow:row}
.p4-g{grid-template-columns:repeat(5,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
.p4-gg{display:contents}
.p4-p{min-height:0;overflow:hidden}
.p4-p img{height:100%;aspect-ratio:auto;object-position:50% 15%}
.p4-me{outline-offset:-1px}
.p4-m{position:absolute;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:.75rem 2px 2px;background:linear-gradient(transparent,rgba(0,0,0,.9) 55%);border-radius:0 0 .375rem .375rem}
.p4-m i{font-size:.625rem;font-weight:800;line-height:.875rem;border-radius:9999px;padding:0 .1875rem;background:color-mix(in srgb,var(--c) 55%,#000);color:#fff;white-space:nowrap}
.p4-m i[data-s="="]{background:rgba(255,255,255,.18)}

.p5{position:absolute;inset:0;overflow:hidden}
.p5 svg{position:absolute;left:50%;top:50%;width:calc(100*var(--ux));height:calc(104*var(--u));translate:-50% -50%}
.p5 polygon{fill:rgba(251,191,36,.1);stroke:rgba(251,191,36,.6);stroke-width:1.5;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.p5 .p5-h{fill:none;stroke:rgba(255,255,255,.35);stroke-dasharray:3 4;stroke-width:1}
.p5-s{position:absolute;left:50%;top:50%;width:calc(var(--l)*var(--u));height:0;transform-origin:0 0;rotate:var(--a)}
.p5-s::before{content:"";position:absolute;left:0;top:-1px;width:100%;height:2px;background:rgba(255,255,255,.08)}
.p5-s b{position:absolute;left:0;top:-3px;height:6px;border-radius:0 9999px 9999px 0;background:var(--c);width:calc(var(--v)*100%)}
@keyframes p5-m0{from{width:calc(var(--v0)*100%)}}
@keyframes p5-m1{from{width:calc(var(--v0)*100%)}}
.pl-stage[data-pl-in="step0"] .p5-s b{animation:p5-m0 .15s ease-out}
.pl-stage[data-pl-in="step1"] .p5-s b{animation:p5-m1 .15s ease-out}
.p5-c,.p5-p,.p5-e{position:absolute;left:50%;top:50%;translate:calc(var(--x)*var(--ux) - 50%) calc(var(--y)*var(--u) - 50%)}
.p5-c{--x:0;--y:0;width:calc(16*var(--u));z-index:2}
.p5-p{width:calc(13*var(--u));z-index:1}
.p5-e{z-index:3;min-width:1rem;height:1rem;border-radius:9999px;background:#0d111c;border:1px solid rgba(255,255,255,.3);font-style:normal;font-size:.625rem;font-weight:800;line-height:.875rem;text-align:center;
color:#fff;pointer-events:none;display:none}
.p5-t{position:absolute;left:50%;bottom:-.4375rem;translate:-50% 0;display:inline-flex;align-items:center;gap:1px;border-radius:9999px;padding:0 .3125rem;font-size:.6875rem;font-weight:800;line-height:1.0625rem;
white-space:nowrap;color:#fff;background:color-mix(in srgb,var(--c) 60%,#000);border:1px solid rgba(255,255,255,.35)}
.p5-none{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;aspect-ratio:2/3;border-radius:.375rem;border:1px dashed rgba(255,255,255,.14);font-size:.5625rem;line-height:.6875rem;
text-align:center;color:#8b93a3}
.p5-none i{font-size:.875rem}
.p5-k{width:calc(10.5*var(--u))}

.p8{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px}
.p8-chips{flex:none;display:flex;gap:.3125rem;height:1.625rem;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x pan-y}
.p8-chips::-webkit-scrollbar{display:none}
.p8-ch{flex:none;border-radius:9999px;padding:0 .5625rem;font-size:.75rem;line-height:1.5rem;color:#d1d5db;background:rgba(255,255,255,.08);border:1px solid transparent}
.p8-ch:hover{background:rgba(255,255,255,.16)}
.p8-ch[aria-pressed="true"]{background:#fbbf24;color:#000;font-weight:700}
.p8-focus{flex:1;min-height:0;display:flex}
.p8-f{flex:1;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:.75rem;align-items:center;text-align:left;border-radius:.625rem;padding:.5rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
button.p8-f:hover{border-color:#fbbf24}
.p8-big{height:100%;aspect-ratio:2/3;max-height:168px;border-radius:.375rem;overflow:hidden;background:#1b2130;box-shadow:0 4px 14px rgba(0,0,0,.55)}
.p8-here .p8-big{outline:3px solid #fff}
.p8-big img{display:block;width:100%;height:100%;object-fit:cover}
.p8-tx{display:flex;flex-direction:column;gap:.1875rem;min-width:0;font-size:.75rem;line-height:1.0625rem;color:#d1d5db}
.p8-tx b{font-size:.9375rem;line-height:1.1875rem;color:#fff;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.p8-tx small{color:#9ca3af}
.p8-tx strong{color:#fde68a;font-weight:800}
.p8-bars{display:flex;flex-direction:column;gap:3px;margin:.125rem 0}
.p8-bars i{display:block;height:5px;border-radius:9999px;background:rgba(255,255,255,.1)}
.p8-bars u{display:block;height:100%;width:calc(var(--v)*10%);border-radius:9999px;background:#fbbf24}
.p8-bars .p8-own u{background:#fff;opacity:.55}
.p8-df{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.p8-go{font-style:normal;font-weight:800;color:#fbbf24}
.p8-rail{position:relative;flex:none;height:84px}
.p8-strip{display:flex;gap:6px;height:100%;align-items:center;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x pan-y;overscroll-behavior-x:contain;
padding:0 calc(50% - 26px)}
.p8-strip::-webkit-scrollbar{display:none}
.p8-i{flex:none;width:52px;scroll-snap-align:center;border-radius:.3125rem;opacity:.7}
.p8-i img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:.3125rem}
.p8-i[data-on]{opacity:1}
.p8-me{outline:2px solid #fff;opacity:1}
.p8-mark{position:absolute;left:50%;top:0;bottom:0;width:60px;translate:-50% 0;border-radius:.5rem;border:2px solid #fbbf24;pointer-events:none;box-shadow:0 0 14px rgba(251,191,36,.35)}
.p8-ax{flex:none;display:flex;align-items:center;gap:.5rem;height:1rem;font-size:.6875rem;font-weight:700;color:#fde68a;white-space:nowrap}
.p8-ax i{flex:1;height:3px;border-radius:9999px;background:linear-gradient(90deg,rgba(253,230,138,.15),rgba(253,230,138,.8))}

.p9{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px}
.p9 small{font-size:.625rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;white-space:nowrap}
.p9-top{flex:1;min-height:0;max-height:150px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.5rem;align-items:center;padding:3px}
.p9-a,.p9-b{height:calc(100% - 6px);max-height:144px;aspect-ratio:2/3;width:auto}
.p9-a img,.p9-b img{height:100%}
.p9-b{outline:3px solid #7dd3fc}
.p9-mid{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.p9-mid::before{content:"";position:absolute;left:-.5rem;right:-.5rem;top:50%;height:2px;background:linear-gradient(90deg,#fff,#7dd3fc);opacity:.25;z-index:-1}
.p9-ch{display:inline-flex;align-items:center;gap:.25rem;max-width:100%;border-radius:9999px;padding:0 .4375rem;font-size:.6875rem;line-height:1.25rem;color:#fff;background:color-mix(in srgb,var(--c) 30%,#0d111c);
border:1px solid color-mix(in srgb,var(--c) 60%,transparent)}
.p9-ch b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p9-ch em{font-style:normal;font-weight:800;opacity:.8;white-space:nowrap}
.p9-no{font-size:.75rem;color:#9ca3af}
.p9-pick{flex:none;display:flex;align-items:center;gap:.5rem;height:54px}
.p9-ws{flex:1;min-width:0;display:flex;gap:5px;height:100%;align-items:center;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x pan-y;padding:2px}
.p9-ws::-webkit-scrollbar{display:none}
.p9-w{flex:none;width:32px;border-radius:.25rem;overflow:hidden;opacity:.7;outline:1px solid rgba(255,255,255,.2)}
.p9-w img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover}
.p9-w:hover{opacity:1}
.p9-w[aria-pressed="true"]{opacity:1;outline:2px solid #7dd3fc}
.p9-bt{flex:1;min-height:0;display:flex;flex-direction:column;gap:4px}
.p9-bt small{display:flex;justify-content:space-between;gap:.5rem;text-transform:none;letter-spacing:0}
.p9-bt small span{min-width:0;overflow:hidden;text-overflow:ellipsis;flex:1}
.p9-bt small span:last-child{text-align:right}
.p9-bt small b{flex:none;text-transform:uppercase;letter-spacing:.06em;color:#d1d5db}
.p9-row{flex:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:2px}
.p9-p{min-height:0;overflow:hidden}

@media (min-width:1024px){
.pl-body{flex-direction:row;gap:1.5rem;align-items:stretch}
.pl-stage{flex:none;width:var(--sw,560px);height:420px}
.pl-side{flex:1;justify-content:center;gap:1rem}
.pl-why{height:3.75rem;-webkit-line-clamp:3}
.pl-fp{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.375rem 1.5rem;height:auto;overflow:visible;-webkit-mask-image:none;mask-image:none}
.pl-fp:not(:empty)::before{content:"What it is made of";grid-column:1/-1;font-size:.6875rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af}
.pl-fi{display:grid;grid-template-columns:1.25rem minmax(0,9rem) 1fr 2.25rem;align-items:center;gap:.5rem;border:0;background:none;padding:0;font-size:.8125rem}
.pl-fi b{overflow:hidden;text-overflow:ellipsis}
.pl-fi s{display:block;height:.375rem;border-radius:9999px;background:rgba(255,255,255,.08)}
.pl-fi u{display:block;height:100%;width:calc(var(--v)*10%);border-radius:9999px;background:var(--c);transition:width .15s ease-out}
.pl-fi em{text-align:right}
.pl-fi:last-child{margin-right:0}
.pl-stage.pl-play1{--u:calc(420px/104);--ux:calc(100cqw/100)}
.pl-stage.pl-play3{--u:calc(420px/104);--sw:600px}
.p3-x{display:block}
.pl-stage.pl-play6{--sw:700px}
.p6-g{width:400px}
.pl-stage.pl-play7{--sw:640px}
.p7-g{grid-template-columns:repeat(7,minmax(0,1fr))}
.p7-x{display:block}
.p7-chips{flex-wrap:wrap;height:auto;overflow:visible;-webkit-mask-image:none;mask-image:none}
.pl-stage.pl-play2{--u:calc(420px/104);--ux:calc(100cqw/100);--sw:640px}
.pl-stage.pl-play4{--sw:640px}
.p4{flex-direction:row;gap:1.25rem}
.p4-mix{width:250px;justify-content:center;gap:.5rem}
.p4-r{grid-template-columns:minmax(0,1fr) 1.5rem;grid-template-rows:auto auto;height:auto;row-gap:0}
.p4-r>span:first-child{grid-column:1/-1}
.p4-n{height:3.75rem;align-items:flex-start;flex-direction:column}
.p4-n span{-webkit-line-clamp:3}
.pl-stage.pl-play5{--u:calc(420px/104);--ux:calc(100cqw/100*.94)}
.pl-stage.pl-play8{--sw:640px}
.p8-big{max-height:none}
.p8-tx{font-size:.875rem;line-height:1.25rem}
.p8-tx b{font-size:1.25rem;line-height:1.5rem}
.pl-stage.pl-play9{--sw:640px}
.p9-top{max-height:190px}
.p9-a,.p9-b{max-height:184px}
.p9-row{grid-template-columns:repeat(5,104px);justify-content:space-between}
.p9-w{width:38px}
.pl-stage.pl-play10{--sw:520px}
.p10-path{height:84px}
.p10-s{width:44px}
.p10-c{width:56px}
.p10-cards{gap:14px}
}
@media (prefers-reduced-motion:reduce){
.pl-stage[data-pl-in] .pl-p{animation:none}
.p1-w,.p1-p,.p1-c,.p1-ls,.p1-f{transition:none}
.pl-stage[data-pl-in] .p3-w{animation:none}
}
`

/** The style of one form: the shared rules and its own. Rules that name another form are left out. */
export function playCss(variant: string): string {
	const own = variant.replace("play", "")
	// play9 draws its trait bars with play7's rule.
	const mine = (selector: string) => {
		if (own === "9" && selector.includes(".p7-b")) return true
		const named = selector.match(/\.p(\d+)[-[]|\.pl-play(\d+)|\bp(\d+)-(?:in|m)\d/g) ?? []
		return named.every((name) => (name.match(/\d+/) ?? [""])[0] === own)
	}
	const rules = (css: string): string => {
		let out = ""
		let i = 0
		while (i < css.length) {
			const open = css.indexOf("{", i)
			if (open < 0) break
			const selector = css.slice(i, open)
			let depth = 1
			let end = open + 1
			while (end < css.length && depth) {
				if (css[end] === "{") depth++
				else if (css[end] === "}") depth--
				end++
			}
			const body = css.slice(open + 1, end - 1)
			if (selector.trim().startsWith("@media"))
				out += `${selector}{${rules(body)}}`
			else if (mine(selector)) out += `${selector}{${body}}`
			i = end
		}
		return out
	}
	// The scrub forms share one sheet of their own (scrub-css.ts) on top of the rules that name no form.
	// The ninth round's forms likewise (best-css.ts).
	return variant.startsWith("scrub")
		? rules(PLAY_CSS) + SCRUB_CSS
		: variant.startsWith("best")
			? rules(PLAY_CSS) + BEST_CSS
			: variant.startsWith("roam")
				? rules(PLAY_CSS) + ROAM_CSS
				: rules(PLAY_CSS)
}
