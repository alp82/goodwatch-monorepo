// PROTOTYPE for "Prototype native-scroll carousels on title pages", ninth round. Throwaway code: not for production.
//
// The style of the ninth round's forms (best1 to best3), added to the play forms' shared rules for those forms only
// (see playCss in play-css.ts). On a strip a poster's place is 38 px wide and a new level starts 12 px later:
// best-forms.ts computes the strip's positions from the same numbers. The poster under the marker is large and
// its two neighbors on each side make room: five attributes move when the title under the marker changes. (A
// scroll-driven animation per poster looked smoother and made a step several times slower to paint at 4x CPU.)
export const BEST_CSS = `
.pl[class*="pl-best"] .pl-side{display:none}
.pl-stage[class*="pl-best"]{height:468px}
.bs,.bh{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px}
.bs{--mk:50%}
.bs s,.bs u,.bh s,.bh u{text-decoration:none}
.bs q,.bh q{quotes:none}
.bs q::before,.bs q::after,.bh q::before,.bh q::after{content:none}
.bs p,.bh p{margin:0}

.bs-f{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;border-radius:.625rem;padding:.5rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.bs-hd{flex:1;min-height:0;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;column-gap:.75rem;row-gap:.375rem}
.bs-big{grid-row:1/3;align-self:center;display:block;height:100%;max-height:156px;aspect-ratio:2/3;padding:0;border-radius:.375rem;overflow:hidden;background:#1b2130;box-shadow:0 4px 14px rgba(0,0,0,.55)}
.bs-big img{display:block;width:100%;height:100%;object-fit:cover}
.bs-here{outline:3px solid #fff}
button.bs-big:hover{outline:2px solid #fbbf24}
.bs-tx{min-width:0;min-height:0;display:flex;flex-direction:column;gap:.25rem;overflow:hidden}
.bs-nm{display:flex;align-items:baseline;gap:.5rem;min-width:0}
.bs-nm b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.0625rem;line-height:1.375rem;color:#fff}
.bs-nm small{flex:none;font-size:.75rem;color:#9ca3af;white-space:nowrap}
.bs-rs{font-size:.8125rem;line-height:1.1875rem;color:#d1d5db;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.bs-rs b{color:#fde68a;font-weight:800}
.bs-rs small{font-size:.6875rem;color:#9ca3af}
.bs-ac{display:flex;align-items:center;gap:.5rem;min-width:0;height:1.875rem}
.bs-cta{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;border-radius:.5rem;background:#fbbf24;color:#000;font-weight:800;font-size:.8125rem;line-height:1.25rem;padding:.3125rem .625rem;white-space:nowrap}
.bs-cta:hover{background:#fcd34d}
.bs-open{flex:none;margin-left:auto;border-radius:.5rem;border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:700;font-size:.8125rem;line-height:1.25rem;padding:.25rem .625rem}
.bs-open:hover{border-color:#fbbf24;color:#fde68a}
.bs-open[data-pl-open]{background:#fbbf24;border-color:#fbbf24;color:#000}
.bs-this{flex:none;margin-left:auto;font-size:.75rem;color:#6b7280}
.bs-you{font-size:.8125rem;font-weight:700;color:#fff}

.bs-bars{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:5px 6px}
.bs-b{display:grid;grid-template-columns:minmax(0,auto) minmax(1.25rem,1fr) 1rem;align-items:center;gap:.375rem;height:28px;padding:0 .5rem;border-radius:9999px;background:rgba(255,255,255,.07);
border:1px solid transparent;font-size:.75rem;line-height:1rem;color:#d1d5db;text-align:left}
.bs-b:hover{background:rgba(255,255,255,.14)}
.bs-b[aria-pressed="true"]{border-color:#fbbf24;background:rgba(251,191,36,.16);color:#fff;font-weight:700}
.bs-b em,.bh-lv em{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-b s,.bh-lv s{position:relative;display:block;height:6px;border-radius:9999px;background:rgba(255,255,255,.14)}
.bs-b u,.bh-lv u{display:block;height:100%;border-radius:9999px;background:var(--c);transition:width .18s ease-out}
.bs-b q,.bh-lv q{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;border-radius:1px;background:#fff}
.bs-b b,.bh-lv b{color:#fff;text-align:right;font-variant-numeric:tabular-nums}

.bs-ft{flex:none;display:flex;flex-direction:column;gap:6px;min-width:0}
.bs-rail{position:relative;flex:none;height:104px}
.bs-strip{display:flex;height:100%;align-items:flex-end;box-sizing:border-box;padding-bottom:5px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;
scroll-padding-right:calc(100% - 2*var(--mk));scrollbar-width:none;touch-action:pan-x pan-y;overscroll-behavior-x:contain}
.bs-strip::-webkit-scrollbar{display:none}
.bs-strip::before{content:"";flex:none;width:var(--mk)}
.bs-strip::after{content:"";flex:none;width:calc(100% - var(--mk))}
.bs-i{position:relative;display:block;flex:none;width:34px;margin:0 2px;scroll-snap-align:center;border-radius:.25rem;transform-origin:50% 100%;opacity:.62;outline-width:1px;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.bs-i[data-g]{margin-left:14px}
.bs-i img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:.25rem}
.bs-me{outline:2px solid #fff;opacity:1}
.bs-pin{position:absolute;left:50%;top:-1px;translate:-50% 0;border-radius:0 0 3px 3px;background:#fff;padding:0 3px;font-size:.5rem;font-weight:800;line-height:.6875rem;color:#000;white-space:nowrap;pointer-events:none}
.bs-pg{background:#cbd5e1}
.bs-i .pl-cm{font-size:0;line-height:0;padding:1px 3px;border-width:1px}
.bs-i .pl-cm::before{content:"←";font-size:.6875rem;line-height:.875rem}
.pl-stage[class] .bs-strip .bs-i{animation:none;transition:transform .12s ease-out,opacity .12s ease-out}
.bs-i[data-d="-2"]{transform:translateX(-7px)}
.bs-i[data-d="2"]{transform:translateX(7px)}
.bs-i[data-d="-1"]{transform:translateX(-13px) scale(1.12);opacity:.85;z-index:1}
.bs-i[data-d="1"]{transform:translateX(13px) scale(1.12);opacity:.85;z-index:1}
.bs-i[data-d="0"]{transform:scale(1.85);opacity:1;z-index:2}
.bs-mark{position:absolute;left:var(--mk);bottom:0;width:68px;height:102px;translate:-50% 0;border-radius:.5rem;border:2px solid #fbbf24;pointer-events:none;box-shadow:0 0 14px rgba(251,191,36,.35)}
.bs-none{position:absolute;left:calc(var(--mk) + 44px);right:0;top:50%;translate:0 -50%;font-size:.8125rem;line-height:1.125rem;color:#9ca3af}
.bs-nd{display:none;position:absolute;top:50%;translate:0 -50%;z-index:3;width:1.625rem;height:1.625rem;border-radius:9999px;background:rgba(13,17,28,.92);border:1px solid rgba(255,255,255,.3);color:#fff;font-weight:800;line-height:1.375rem}
.bs-nd[data-arg="-1"]{left:2px}
.bs-nd[data-arg="1"]{right:2px}
.bs-nd:hover{border-color:#fbbf24}
@media (hover:hover) and (pointer:fine){.bs-nd{display:block}}
.bs-cap{flex:none;display:flex;align-items:center;justify-content:space-between;gap:.5rem;height:16px;font-size:.6875rem;line-height:1rem;color:#9ca3af;white-space:nowrap}
.bs-cap>span{flex:none;max-width:38%;overflow:hidden;text-overflow:ellipsis}
.bs-cap>b{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#fde68a;font-weight:700}
.bs-cap>b b{font-weight:800}

.bs-map{position:relative;flex:none;display:flex;align-items:flex-start;height:34px;touch-action:pan-y;cursor:ew-resize}
.bs-map i{position:relative;display:block;flex:1;min-width:0;height:20px}
.bs-map i::before{content:"";position:absolute;left:50%;top:4px;bottom:2px;width:min(100% - 2px,10px);translate:-50% 0;border-radius:2px;background:rgba(253,230,138,.34)}
.bs-map i[data-l]{border-left:1px solid rgba(253,230,138,.4)}
.bs-map i[data-skip]{border-left:2px dotted rgba(253,230,138,.75)}
.bs-map i[data-l]::after{content:attr(data-l);position:absolute;left:2px;top:21px;font-size:.625rem;font-weight:600;line-height:.75rem;color:#9ca3af}
.bs-map i[data-me]::before{background:#fff}
.bs-map i[data-pg]::before{background:none;box-shadow:inset 0 0 0 1.5px #fff}
.bs-map i[data-on]::before{background:#fbbf24;top:1px;bottom:0}
.bs-win{position:absolute;top:0;height:20px;left:calc((var(--i) + .5)/var(--n)*100%);width:calc(var(--vis,10)/var(--n)*100%);translate:-50% 0;border-radius:4px;border:1.5px solid rgba(251,191,36,.75);
background:rgba(251,191,36,.1);pointer-events:none}

.bs3{--mk:24%}
.b3-say{flex:none;height:2.25rem;font-size:.8125rem;line-height:1.125rem;color:#d1d5db;overflow:hidden}
.b3-say b{color:#fff;font-weight:700}
.b3-say button{margin-left:.25rem;border-radius:9999px;border:1px solid rgba(253,230,138,.45);padding:0 .5rem;font-size:.75rem;font-weight:700;line-height:1rem;color:#fde68a}
.b3-say button:hover{background:rgba(253,230,138,.18)}
.b3-open{border-radius:9999px;background:#fbbf24;padding:0 .5rem;font-size:.75rem;font-weight:700;line-height:1rem;color:#000;white-space:nowrap}
.b3-open:hover{background:#fcd34d}
.b3-mix{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:6px}
.b3-st{display:grid;grid-template-columns:2rem minmax(0,1fr) 2rem;height:34px;border-radius:9999px;border:1px solid rgba(255,255,255,.16);overflow:hidden}
.b3-st[data-s]{border-color:#fbbf24}
.b3-st span{display:flex;align-items:center;justify-content:center;gap:.25rem;min-width:0;padding:0 .125rem;font-size:.71875rem;line-height:1rem;color:#e5e7eb;white-space:nowrap;
background:linear-gradient(90deg,color-mix(in srgb,var(--c) 32%,transparent) calc(var(--v)*10%),rgba(255,255,255,.04) calc(var(--v)*10%))}
.b3-st em{font-style:normal;min-width:0;overflow:hidden;text-overflow:ellipsis}
.b3-st span b{color:#fff;font-variant-numeric:tabular-nums}
.b3-st button{font-size:1.125rem;font-weight:800;line-height:1;color:#fde68a;background:rgba(255,255,255,.09)}
.b3-st button:hover{background:rgba(255,255,255,.2)}
.b3-st button[aria-pressed="true"]{background:#fbbf24;color:#000}
.b3-st button:disabled{opacity:.3;cursor:default;background:none}

.bh-map{position:relative;flex:1;min-height:0;--w:50px;--cp:60px;--rp:80px}
.bh-c,.bh-p{position:absolute;left:50%;top:50%;width:var(--w);translate:calc(var(--x,0)*var(--cp) - 50%) calc(var(--y,0)*var(--rp) - 50%)}
.bh-c{z-index:2;width:calc(var(--w) + 4px)}
.bh-p{z-index:1}
span.bh-p{height:calc(var(--w)*1.5);aspect-ratio:auto}
.bh-lb{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;padding:.625rem 0 2px;border-radius:0 0 .375rem .375rem;background:linear-gradient(transparent,rgba(0,0,0,.94) 42%);
font-size:.5625rem;font-weight:700;line-height:.6875rem;color:#fde68a;white-space:nowrap;overflow:hidden;pointer-events:none}
.bh-lb i{color:#fff}
span.bh-p .bh-lb{top:0;justify-content:center;padding:0;background:none;color:#9ca3af}
span.bh-p .bh-lb i{color:#d1d5db}
.bh-sp{position:absolute;left:50%;top:50%;width:2px;height:calc(4*var(--rp));translate:-50% -50%;border-radius:1px;opacity:.55;
background:linear-gradient(transparent,var(--c) 14%,var(--c) 86%,transparent)}
.bh-sp[data-i="1"]{height:288px;rotate:56.31deg}
.bh-sp[data-i="2"]{height:288px;rotate:-56.31deg}
.bh-info{flex:none;display:flex;flex-direction:column;gap:2px;height:62px;min-width:0}
.bh-info .bs-nm{align-items:center;height:1.75rem}
.bh-why{height:2.25rem;font-size:.8125rem;line-height:1.125rem;color:#e5e7eb;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.bh-lvs{display:none}

@media (min-width:1024px){
.pl-stage[class*="pl-best"]{flex:1;width:auto;height:420px}
.bs1 .bs-f{flex-direction:row;gap:1.5rem;padding:.75rem}
.bs1 .bs-hd{flex:1}
.bs1 .bs-bars{flex:none;width:340px;grid-template-columns:1fr;align-content:center;gap:8px}
.bs-b{height:34px;font-size:.8125rem;grid-template-columns:7rem minmax(2rem,1fr) 1.25rem}
.bs-big{max-height:none}
.bs-nm b{font-size:1.375rem;line-height:1.75rem}
.bs-rs{font-size:.9375rem;line-height:1.375rem}
.bs3 .bs-f{padding:.75rem}
.b3-say{height:1.25rem;font-size:.875rem;line-height:1.25rem}
.b3-mix{grid-template-columns:repeat(4,1fr);gap:10px}
.bh{flex-direction:row;gap:2.5rem;align-items:center}
.bh-map{flex:none;width:360px;height:100%}
.bh-info{flex:1;height:auto;gap:.75rem}
.bh-why{height:auto;font-size:.9375rem;line-height:1.375rem;-webkit-line-clamp:3}
.bh-lvs{display:flex;flex-direction:column;gap:.5rem;max-width:420px}
.bh-lv{display:grid;grid-template-columns:7rem minmax(2rem,1fr) 1.25rem;align-items:center;gap:.5rem;font-size:.8125rem;color:#d1d5db}
}
@media (prefers-reduced-motion:reduce){
.pl-stage[class] .bs-strip .bs-i,.bs-b u,.bh-lv u{transition:none}
}
`
