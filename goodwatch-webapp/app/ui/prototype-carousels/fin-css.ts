// PROTOTYPE for "Prototype native-scroll carousels on title pages", thirteenth round. Throwaway code: not for production.
//
// The style of the thirteenth round's forms (fin1 to fin3), on top of the rings' and the remixes' (rings-css.ts,
// mix-css.ts). Four parts: what the three share in the chips and on the map (the sweep on a chip that is on, the
// second mark for a poster that is pointed at, the posters a chip lights), the navigation of each form, the card,
// and the wide layout.
//
// fin2 after the owner chose it: its trail is the head of the card, so that walk and title are one bar under the map
// (beside it on a wide screen), and only the heading and the chips sit above the map.
//
// The heights on a phone add up to a section of 600 px: the padding (32), the heading, the navigation, the stage,
// and the gaps between them. The line of plain links stays in the document and takes no room.
export const FIN_CSS = `
.pl[class*="pl-fin"] .pl-side{display:none}
.pl[class*="pl-fin"] .pl-more{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);-webkit-mask-image:none;mask-image:none}
.pl-stage[class*="pl-fin"]{height:484px}
.pl-stage.pl-fin2{height:532px}
.pl-stage.pl-fin3{height:532px}
.pl[class*="pl-fin"] .pl-bar{height:40px}
.pl.pl-fin2 .pl-bar{display:none}
.pl.pl-fin3 .pl-bar{display:none}

.fn-row .ix-z{overflow:hidden}
.fn-row .ix-c[aria-pressed="true"] .ix-z{box-shadow:0 0 9px 1px var(--g)}
.fn-row .ix-c[aria-pressed="true"] .ix-z::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 12%,rgba(255,255,255,.92) 50%,transparent 88%);translate:-101% 0;
animation:fn-sw 1.6s cubic-bezier(.45,.05,.55,.95) calc(var(--fw,0ms) + var(--fa,0ms)) infinite}
.fn-row .ix-c[data-fl]{--fw:1250ms}
.fn-row .ix-c[data-d="dn"][aria-pressed="true"] .ix-z::after{animation-direction:reverse}
@keyframes fn-sw{0%{translate:-101% 0}72%,100%{translate:101% 0}}
.ix-c>.fn-pz{left:calc(var(--pa,var(--v))*10%);width:calc((var(--pb,var(--v)) - var(--pa,var(--v)))*10%);opacity:0;
transition:left .28s cubic-bezier(.3,.3,.2,1),width .28s cubic-bezier(.3,.3,.2,1),opacity .28s ease-in}
.ix-c[data-fn-pd="up"] .fn-pz{background:#22c55e}
.ix-c[data-fn-pd="dn"] .fn-pz{background:repeating-linear-gradient(135deg,#ef4444 0 3px,rgba(239,68,68,.4) 3px 6px)}
.ix-c>.fn-pk{left:calc(var(--pm,var(--v))*10%);width:0;margin-left:-1px;border-left:2px solid #fde68a;opacity:0;transition:left .28s cubic-bezier(.3,.3,.2,1),opacity .28s ease-in}
.fn-pk::after{content:"";position:absolute;left:-4px;top:-1px;border:3px solid transparent;border-top:4px solid #fde68a}
.ix-c[data-fn-pk] .fn-pz{opacity:.78;transition-timing-function:cubic-bezier(.3,.3,.2,1),cubic-bezier(.3,.3,.2,1),ease-out}
.ix-c[data-fn-pk] .fn-pk{opacity:1}
.ix-c[data-fn-pk] .ix-z{opacity:0}
.ix-c[data-fn-pk][aria-pressed="true"] .ix-z{opacity:.14}
.ix-c[data-fn-pk] .ix-n{opacity:0}
.fn-pt{display:none;color:#fde68a}
.ix-c[data-fn-pk] .ix-r,.ix-c[data-fn-pk] .ix-p{display:none}
.ix-c[data-fn-pk] .fn-pt{display:inline}
.rg .rm-p[data-fn-lit]{outline-color:#4ade80;box-shadow:0 0 0 4px rgba(34,197,94,.4),0 4px 14px rgba(0,0,0,.55)}
.rg .rm-p[data-fn-ld="dn"]{outline-color:#f87171;box-shadow:0 0 0 4px rgba(239,68,68,.4),0 4px 14px rgba(0,0,0,.55)}
.rg .rm-p[data-fn-lit]::after{content:attr(data-fn-lit);position:absolute;left:-4px;top:-4px;min-width:19px;height:19px;border-radius:10px;background:#0d111c;border:1.5px solid #4ade80;font-size:.6875rem;line-height:16px;
text-align:center;scale:calc(1/var(--s,1));pointer-events:none}
.rg .rm-p[data-fn-ld="dn"]::after{border-color:#f87171}
.rg[data-r-pv] .rm-p[data-fn-lit]:not([data-r-st]){opacity:.9}

.fn-n{position:static;display:flex;align-items:center;gap:8px;width:100%;height:100%;min-width:0}
.fn-bk{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:.125rem;height:36px;min-width:36px;border-radius:9999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);
color:#fff;font-size:.8125rem;font-weight:700;line-height:1;white-space:nowrap}
.fn-bk svg{flex:none;width:16px;height:16px}
.fn-bk span{display:none}
.fn-bk:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.4)}
.fn-bk:disabled{opacity:.32;cursor:default;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}
.fn-tip{flex:1 1 0;min-width:0;font-size:.8125rem;line-height:1.125rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fn-hs summary{list-style:none;cursor:pointer}
.fn-hs summary::-webkit-details-marker{display:none}
.fn-pop{position:absolute;left:0;top:calc(100% + 6px);z-index:8;display:flex;flex-direction:column;width:max-content;min-width:12rem;max-width:min(100%,19rem);max-height:15rem;overflow-y:auto;overscroll-behavior:contain;
padding:.25rem;border-radius:.75rem;background:#111827;border:1px solid rgba(255,255,255,.2);box-shadow:0 14px 34px rgba(0,0,0,.65)}
.fn-pop li{display:block;min-width:0}
.fn-hs .fn-pop button{display:flex;flex-direction:row;justify-content:flex-start;align-items:center;gap:.5rem;width:100%;min-width:0;padding:.25rem .625rem .25rem .25rem;border-radius:.5rem;text-align:left;font-size:.8125rem;font-weight:500;line-height:1.25rem;color:#e5e7eb;
opacity:1;outline:0}
.fn-hs .fn-pop button:hover{background:rgba(255,255,255,.12);color:#fff}
.fn-pop i{flex:none;width:2.25rem;font-size:.6875rem;font-weight:600;color:#9ca3af;text-align:right;font-variant-numeric:tabular-nums}
.fn-hs .fn-pop img{outline:0;flex:none;width:22px;height:33px;border-radius:3px;object-fit:cover;background:#1b2130}
.fn-pop span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.fn-path{flex:1 1 0;display:flex;align-items:stretch;min-width:0;height:40px;padding:2px;border-radius:.75rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.fn-n1[data-fn-0] .fn-path{flex:0 1 auto}
.fn-path>li{display:flex;align-items:stretch;flex:1 1 0;min-width:0}
.fn-path>li.fn-md{flex:0 0 auto}
.fn-path>li.fn-cu{flex:1.5 1 0}
.fn-path>li+li::before{content:"";flex:none;align-self:center;width:7px;height:7px;margin:0 3px 0 -1px;border:solid rgba(255,255,255,.34);border-width:1.5px 1.5px 0 0;rotate:45deg}
.fn-path .fn-hs{display:flex;min-width:0}
.fn-path button,.fn-path summary,.fn-path [aria-current]{display:flex;flex-direction:column;justify-content:center;min-width:0;width:100%;padding:0 8px;border-radius:.5625rem;text-align:left}
.fn-path small{font-size:.5625rem;line-height:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fn-path b{font-size:.8125rem;line-height:1.125rem;font-weight:600;color:#e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fn-path button:hover,.fn-path summary:hover,.fn-path details[open] summary{background:rgba(255,255,255,.12)}
.fn-path button:hover b,.fn-path summary:hover b{color:#fff}
.fn-path summary b::after{content:"";display:inline-block;margin-left:.3125rem;border:4px solid transparent;border-top:5px solid #d1d5db;border-bottom:0;vertical-align:middle}
.fn-cu [aria-current]{background:rgba(251,191,36,.12)}
.fn-cu small{color:#fbbf24}
.fn-cu b{color:#fff;font-weight:800}

.fn-tb{position:relative;flex:none;display:flex;align-items:center;gap:6px;height:44px;min-width:0;padding:0 8px 0 6px;border-bottom:1px solid rgba(255,255,255,.1)}
.fn-tb .fn-bk{width:32px;min-width:32px;height:32px;border-radius:7px;border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.07)}
.fn-tb .fn-tip{font-size:.75rem}
.fn-tb .fn-pop{top:auto;bottom:calc(100% + 6px);left:6px}
.fn-tb .fn-pop,.fn-ns .fn-pop{max-width:min(calc(100% - 16px),19rem)}
.fn-tr{flex:none;display:flex;align-items:center;min-width:0;height:32px}
.fn-tr>li{flex:none;display:flex;align-items:center;height:32px}
.fn-tr>li+li::before{content:"";flex:none;width:5px;height:5px;margin:0 5px 0 2px;border:solid rgba(255,255,255,.36);border-width:1.5px 1.5px 0 0;rotate:45deg}
.fn-tr>li.fn-ti+li.fn-ti{margin-left:4px}
.fn-tr>li.fn-ti+li.fn-ti::before{display:none}
.fn-tr>li>button,.fn-tr>li>.fn-cap,.fn-tm summary{display:flex;align-items:center;height:32px;overflow:hidden;border-radius:7px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);
font-size:.75rem;font-weight:600;line-height:1;color:#e5e7eb;white-space:nowrap}
.fn-tr>li>button>img,.fn-cap>img{display:block;flex:none;width:21px;height:100%;object-fit:cover;background:#1b2130}
.fn-cap>span:not(.pl-sr){padding:0 8px 0 6px}
.fn-tr>li>button:hover,.fn-tm summary:hover,.fn-tm details[open] summary{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.42);color:#fff}
.fn-tm summary{gap:4px;padding:0 7px 0 8px;font-weight:700;font-variant-numeric:tabular-nums}
.fn-tm summary::after{content:"";border:3.5px solid transparent;border-top:4.5px solid #d1d5db;border-bottom:0}
.fn-c2{display:none}
.fn-tr>li.fn-tc>.fn-cap{border-color:rgba(251,191,36,.75);background:rgba(251,191,36,.13);color:#fde68a;font-weight:700}

.rm.rg[class*="rg-fin"] .rm-info.rg-info{position:relative;z-index:5;height:72px}
.rm.rg.rg-fin3 .rm-info.rg-info{height:108px;border-radius:.75rem;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}
.fn-card{display:grid;grid-template-columns:40px auto minmax(0,1fr) auto;grid-template-rows:14px 24px 20px;column-gap:8px;align-items:center;height:72px;min-width:0;padding:6px 8px;border-radius:.75rem;
border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}
.fn-th{grid-column:1;grid-row:1/4;align-self:stretch;border-radius:5px;overflow:hidden;background:#1b2130;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.fn-th img{display:block;width:100%;height:100%;object-fit:cover}
.fn-kk,.fn-vs{font-size:.5625rem;line-height:.875rem;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.fn-kk{grid-column:2;grid-row:1;font-weight:800;color:#d1d5db}
.fn-kk b{font-weight:800}
.fn-k1{display:none;color:#fbbf24}
.fn-vs{grid-column:3;grid-row:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:600;color:#9ca3af}
.fn-vs b{font-weight:700;color:#d1d5db}
.fn-v2{display:none}
.fn-nm{grid-column:2/4;grid-row:2;display:flex;align-items:baseline;gap:.375rem;min-width:0}
.fn-nm b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.0625rem;line-height:1.5rem;font-weight:800;letter-spacing:-.01em;color:#fff}
.fn-nm small{flex:none;font-size:.75rem;color:#9ca3af;white-space:nowrap}
.fn-df{grid-column:2/4;grid-row:3;display:flex;flex-wrap:wrap;gap:0 4px;height:20px;min-width:0;overflow:hidden}
.fn-d{flex:none;display:inline-flex;align-items:center;gap:2px;height:20px;padding:0 6px 0 5px;border-radius:9999px;font-size:.6875rem;font-weight:600;line-height:1;white-space:nowrap;color:#e5e7eb;background:rgba(255,255,255,.08)}
.fn-d i{font-size:.8125rem;font-weight:800}
.fn-d[data-d="up"]{background:rgba(34,197,94,.16);color:#bbf7d0}
.fn-d[data-d="up"] i{color:#4ade80}
.fn-d[data-d="dn"]{background:rgba(239,68,68,.16);color:#fecaca}
.fn-d[data-d="dn"] i{color:#f87171}
.fn-dh{min-width:0;font-size:.75rem;line-height:1.25rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fn-go{grid-column:4;grid-row:1/4;display:grid;align-items:center;justify-items:end}
.fn-go>*{grid-area:1/1}
.fn-open{display:inline-flex;align-items:center;justify-content:center;gap:.25rem;height:40px;padding:0 .625rem 0 .875rem;border-radius:.625rem;background:#fbbf24;color:#111827;font-size:.875rem;font-weight:800;line-height:1;
white-space:nowrap;box-shadow:0 2px 12px rgba(251,191,36,.28)}
.fn-open:hover{background:#fcd34d}
.fn-open:focus-visible{outline:2px solid #fff;outline-offset:2px}
.fn-open svg{flex:none;width:16px;height:16px}
.fn-ow{display:none}
.fn-this{padding:.25rem .5rem;border-radius:.5rem;border:1px dashed rgba(255,255,255,.22);font-size:.6875rem;font-weight:600;line-height:1rem;color:#9ca3af;white-space:nowrap}
.fn-mv{visibility:hidden;max-width:4.75rem;font-size:.6875rem;line-height:.875rem;font-weight:700;color:#fde68a;text-align:right}
.fn-nt{display:none}
.rg-info[data-r-pk] .fn-open,.rg-info[data-r-pk] .fn-this{visibility:hidden}
.rg-info[data-r-pk] .fn-mv{visibility:visible}
.rg-info[data-r-pk] .fn-k0{display:none}
.rg-info[data-r-pk] .fn-k1{display:inline}
.rg-info[data-r-pk] .fn-card{border-style:dashed;border-color:rgba(251,191,36,.7);background:rgba(251,191,36,.08)}
.rg-info:not([data-r-pk]) .fn-card[data-fn-root] .fn-vs{visibility:hidden}

.rm.rg.rg-fin2 .rm-info.rg-info{height:116px;border-radius:.75rem;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}
.rg-fin2 .fn-card{grid-template-columns:auto minmax(0,1fr) auto;height:70px;padding:5px 8px 7px 10px;border:0;border-radius:0 0 .6875rem .6875rem;background:none}
.rg-fin2 .fn-kk{grid-column:1}
.rg-fin2 .fn-vs{grid-column:2}
.rg-fin2 .fn-nm,.rg-fin2 .fn-df{grid-column:1/3}
.rg-fin2 .fn-go{grid-column:3}
.rg-fin2 .rg-info[data-r-pk] .fn-card{background:rgba(251,191,36,.1);box-shadow:inset 0 0 0 1px rgba(251,191,36,.6)}

.fn-ns{position:relative;flex:none;display:flex;align-items:center;gap:6px;height:36px;min-width:0;padding:0 6px;border-bottom:1px solid rgba(255,255,255,.1)}
.fn-ns .fn-bk{height:26px;min-width:0;padding:0 .625rem 0 .3125rem}
.fn-ns .fn-bk span{display:inline}
.fn-wh{flex:1 1 0;min-width:0;font-size:.8125rem;line-height:1.125rem;color:#d1d5db}
.fn-wh .fn-tip{display:block;padding:0 .25rem}
.fn-wh summary{display:flex;align-items:center;gap:.3125rem;width:fit-content;max-width:100%;height:26px;padding:0 .5rem;border-radius:9999px}
.fn-wh summary span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fn-wh summary b{font-weight:700;color:#fff}
.fn-wh summary::after{content:"";flex:none;border:4px solid transparent;border-top:5px solid #d1d5db;border-bottom:0}
.fn-wh summary:hover,.fn-wh details[open] summary{background:rgba(255,255,255,.12)}
.fn-ns .fn-pop{top:auto;bottom:calc(100% + 6px);left:6px}
.fn-so{flex:none;height:26px;padding:0 .625rem;border-radius:9999px;border:1px solid rgba(255,255,255,.2);font-size:.75rem;font-weight:600;line-height:1;color:#e5e7eb;white-space:nowrap}
.fn-so:hover{border-color:rgba(255,255,255,.5);color:#fff}
.rg-fin3 .fn-card{height:70px;padding:5px 8px 7px;border:0;border-radius:0 0 .6875rem .6875rem;background:none}
.rg-fin3 .rg-info[data-r-pk] .fn-card{background:rgba(251,191,36,.1);box-shadow:inset 0 0 0 1px rgba(251,191,36,.6)}

@media (min-width:1024px){
.pl-stage[class*="pl-fin"]{flex:1;width:auto;height:470px}
.pl-stage.pl-fin2,.pl-stage.pl-fin3{height:506px}
.pl.pl-fin1{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:1.25rem;row-gap:.75rem}
.pl.pl-fin1 .pl-h{max-width:26rem}
.pl.pl-fin1 .pl-body{grid-column:1/-1}
.fn-n1 .fn-bk{padding:0 .875rem 0 .5rem}
.fn-n1 .fn-bk span{display:inline}
.fn-path{flex:0 1 auto}
.fn-tb{height:48px;padding:0 10px 0 8px}
.fn-tr>li+li::before{margin:0 4px 0 1px}
.fn-cap>span:not(.pl-sr){padding:0 7px 0 5px}
.fn-tr>li.fn-old{display:none}
.fn-tr>li.fn-old+li.fn-ti{margin-left:0}
.fn-tr>li.fn-old+li.fn-ti::before{display:block}
.fn-c1{display:none}
.fn-c2{display:inline}
.fn-tb .fn-pop{top:calc(100% + 4px);bottom:auto;left:8px}
.fn-path>li{flex:0 1 auto;max-width:17rem}
.fn-path button,.fn-path summary,.fn-path [aria-current]{padding:0 12px}
.fn-v1{display:none}
.fn-v2{display:inline}
.fn-tip{flex:0 1 auto}
.rm.rg[class*="rg-fin"]{grid-template-columns:minmax(0,1fr) 300px}
.rm.rg[class*="rg-fin"] .rm-info.rg-info{height:auto;padding-top:0;gap:0}
.rm.rg[class*="rg-fin"] .rm-top{margin-top:.375rem}
.fn-card{grid-template-columns:48px minmax(0,1fr);grid-template-rows:auto;grid-template-areas:"kk kk" "th nm" "go go" "vs vs" "df df" "nt nt";column-gap:12px;height:auto;padding:12px}
.fn-th{grid-area:th;align-self:center;width:48px;height:72px}
.fn-kk{grid-area:kk;margin-bottom:8px}
.fn-kk,.fn-vs{font-size:.625rem}
.fn-nm{grid-area:nm;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;height:72px}
.fn-nm b{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:1.25rem;line-height:1.5rem}
.fn-nm small{font-size:.8125rem}
.fn-go{grid-area:go;justify-items:stretch;margin-top:10px}
.fn-open{height:40px;font-size:.9375rem}
.fn-ow{display:inline}
.fn-this{padding:.6875rem .5rem;text-align:center;font-size:.75rem}
.fn-mv{max-width:none;align-self:center;text-align:center;font-size:.8125rem;line-height:1rem}
.fn-vs{grid-area:vs;margin-top:12px}
.fn-df{grid-area:df;align-content:flex-start;gap:4px;height:48px;margin-top:4px}
.fn-d{height:22px;font-size:.75rem}
.fn-nt{grid-area:nt;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;height:32px;margin-top:8px;overflow:hidden;font-size:.75rem;line-height:1rem;color:#9ca3af}
.fn-nt b{font-weight:600;color:#e5e7eb}
.rg-fin2 .fn-card{grid-template-columns:minmax(0,1fr);grid-template-areas:"kk" "nm" "go" "vs" "df" "nt";height:auto;padding:10px 12px 12px}
.rg-fin2 .fn-kk,.rg-fin2 .fn-vs,.rg-fin2 .fn-nm,.rg-fin2 .fn-df,.rg-fin2 .fn-go{grid-column:1}
.rg-fin2 .fn-nm{height:62px}
.rg-fin2 .fn-nm b{font-size:1.375rem;line-height:1.625rem}
.rm.rg.rg-fin2 .rm-info.rg-info,.rm.rg.rg-fin3 .rm-info.rg-info{height:auto}
.fn-ns{height:42px;padding:0 8px}
.fn-ns .fn-bk,.fn-wh summary,.fn-so{height:28px}
.fn-ns .fn-pop{top:calc(100% + 4px);bottom:auto;left:8px}
.rg-fin3 .fn-card{height:auto;padding:10px 12px 12px}
}
@media (prefers-reduced-motion:reduce){
.fn-row .ix-c[aria-pressed="true"] .ix-z::after{animation:none;translate:0 0;opacity:.5}
.ix-c>.fn-pz,.ix-c>.fn-pk{transition:none}
}
`
