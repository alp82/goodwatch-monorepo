// PROTOTYPE for "Prototype native-scroll carousels on title pages", eleventh round. Throwaway code: not for production.
//
// The style of the eleventh round's forms (roam1 with its fixes, rings1 to rings10), on top of the tenth round's
// (roam-css.ts): the rings, the map, the zoom, and the card's frame are the same. New here: no poster moves by a
// style transition (rings-forms.ts moves them itself, so that a step is one pan), the card's three lines with fixed
// heights, and one block per control area.
//
// Twelfth round: how long a fade, a change of size, and the mark of the way back take comes from the script with
// every redraw (a step, a zoom, and a control each have their own pace), and a control that is looked at dims the
// posters that would leave.
export const RINGS_CSS = `
.pl[class*="pl-rings"] .pl-side,.pl[class*="pl-mix"] .pl-side{display:none}
.pl-stage[class*="pl-rings"],.pl-stage[class*="pl-mix"]{height:468px}
.rm.rg .rm-top{height:var(--th,30px)}
.pl-stage[class] .rm.rg .rm-p{animation:none;transition:scale var(--sc,200ms) cubic-bezier(.3,.3,.2,1)}
.rg .rm-w{will-change:translate}
@keyframes rg-in{from{opacity:0}}
@keyframes rg-out{from{opacity:var(--o,1)}to{opacity:0}}
.pl-stage[class] .rm.rg .rm-p.rg-new{animation:rg-in var(--fi,190ms) linear var(--fd,0ms) backwards}
.pl-stage[class] .rm.rg .rm-p[data-r-x]{animation:rg-out var(--fo,190ms) linear both}
.rg .rm-p[data-pl-came] img{transition:opacity var(--bk,0ms) ease-out}
.rg .rm-p .pl-cm{animation:rg-in var(--cmd,0ms) linear var(--cmw,0ms) backwards}
.rg[data-r-pv] .rm-p:not([data-r-st]){opacity:.26}
.rg .rm-p[data-pl-came]{z-index:1}
.rg .rm-p[data-r-x]{pointer-events:none}
.rg .rm-p[style*="--dm"] img{opacity:.38;filter:saturate(.3)}
.rg .rm-p[style*="--dm"]{outline-style:dashed}
.rg .rg-c{z-index:3;outline:3px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.6);cursor:default}
.rg .rg-c:hover,.rg .rg-c:focus-visible{outline-color:#fff}
.rg .rg-c:active{filter:none}
.rm-info.rg-info{gap:0}
.rg-tall .rm-info.rg-info{height:42px}
.rg-tall .rg-nt{display:none}
.rg-vs,.rg-nt{height:1rem;font-size:.8125rem;line-height:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-vs{display:flex;gap:.3125rem;color:#e5e7eb}
.rg-ld{flex:0 1 auto;min-width:0;max-width:55%;overflow:hidden;text-overflow:ellipsis;color:#9ca3af}
.rg-ld b{color:#d1d5db;font-weight:600}
.rg-df{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#fde68a;font-weight:600}
.rg-nt{color:#9ca3af}
.rg-nt b{color:#e5e7eb;font-weight:600}
.rg-t{display:none}
@media (hover:none){.rg-h{display:none}.rg-t{display:inline}}
.rg-info[data-r-pk] [data-r-nm]{color:#fde68a}

.rg-bars{display:flex;gap:4px;width:100%;height:100%}
.rg-b{flex:1 1 0;min-width:0;display:grid;grid-template-columns:10px minmax(0,1fr);grid-template-rows:20px 19px 12px;column-gap:4px;align-items:center;padding:1px 3px 1px 4px;border-radius:.5rem;
border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);text-align:left}
.rg-b:hover{border-color:rgba(255,255,255,.4)}
.rg-b s{grid-column:1;grid-row:1/3;align-self:stretch;position:relative;margin:2px 0;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;text-decoration:none}
.rg-b u{position:absolute;left:0;right:0;bottom:0;height:calc(var(--v)*10%);background:var(--c);text-decoration:none}
.rg-b i{grid-column:2;grid-row:1;font-size:.9375rem;line-height:1}
.rg-b em{grid-column:2;grid-row:2;font-style:normal;font-size:.6875rem;font-weight:700;color:#fff;white-space:nowrap}
.rg-b b{grid-column:1/3;grid-row:3;font-size:.5625rem;font-weight:600;line-height:.75rem;color:#d1d5db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-b[aria-pressed="true"]{border-color:var(--c);background:color-mix(in srgb,var(--c) 24%,transparent)}
.rg-b[aria-pressed="true"] u{opacity:.3}
.rg-b[aria-pressed="true"] s::after{content:"";position:absolute;left:0;right:0;background:#fff}
.rg-b[aria-pressed="true"][data-d="w"] s::after{top:0;bottom:60%}
.rg-b[aria-pressed="true"][data-d="o"] s::after{bottom:0;top:60%}
.rg-b[aria-pressed="true"] em{color:#fde68a}

.rg-sts{display:flex;gap:8px;width:100%}
.rg-st{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px}
.rg-st>span{display:flex;align-items:center;gap:.25rem;height:12px;font-size:.6875rem;line-height:.875rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden}
.rg-st em{margin-left:auto;font-style:normal;color:#9ca3af;font-weight:500}
.rg-st>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));height:26px;border-radius:9999px;border:1px solid rgba(255,255,255,.24);overflow:hidden}
.rg-st button{font-size:.6875rem;font-weight:600;color:#9ca3af}
.rg-st button:hover{color:#fff}
.rg-st button[aria-pressed="true"]{background:color-mix(in srgb,var(--c) 50%,transparent);color:#fff}
.rg-st button[data-arg$=":0"][aria-pressed="true"]{background:rgba(255,255,255,.14)}
.rg-st button:disabled{opacity:.3;cursor:default}

.rg-wds,.rg-pr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:25px;gap:6px;width:100%;height:100%;overflow:hidden}
.rg-wd,.rg-dice,.rg-f{min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:.25rem;padding:0 .375rem;border-radius:9999px;font-size:.75rem;font-weight:600;line-height:1rem;white-space:nowrap;overflow:hidden;
color:#e5e7eb;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.04)}
.rg-wd{border-color:color-mix(in srgb,var(--c) 55%,transparent)}
.rg-wd:hover,.rg-f:hover{background:rgba(255,255,255,.12)}
.rg-wd[aria-pressed="true"]{background:color-mix(in srgb,var(--c) 42%,transparent);border-color:var(--c);color:#fff;font-weight:700}
.rg-f[aria-pressed="true"]{background:rgba(251,191,36,.26);border-color:#fbbf24;color:#fff;font-weight:700}
.rg-dice{border-color:#fbbf24;color:#fde68a;background:rgba(251,191,36,.12)}
.rg-dice:hover{background:rgba(251,191,36,.26)}

.rg-e{position:absolute;display:inline-flex;align-items:center;gap:.25rem;height:22px;padding:0 .5rem;border-radius:9999px;font-size:.6875rem;font-weight:700;line-height:1;white-space:nowrap;color:#fff;
background:rgba(13,17,28,.94);border:1px solid color-mix(in srgb,var(--c) 70%,transparent)}
.rg-e:hover{border-color:#fff}
.rg-e[aria-pressed="true"]{background:color-mix(in srgb,var(--c) 60%,#0d111c);border-color:#fff}
.rg-e[aria-pressed="true"]::after{content:"✓";font-size:.625rem}
.rg-e0{left:50%;top:3px;translate:-50% 0}
.rg-e2{left:50%;bottom:3px;translate:-50% 0}
.rg-e1,.rg-e3{top:50%;height:auto;width:22px;padding:.5rem 0;writing-mode:vertical-rl;translate:0 -50%}
.rg-e1{right:3px}
.rg-e3{left:3px}

.rg-lg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:25px;gap:6px;width:100%;height:100%;overflow:hidden}
.rg-le{min-width:0;display:flex;align-items:center;gap:.375rem;padding:0 .5rem;border-radius:.5rem;font-size:.75rem;font-weight:600;line-height:1rem;white-space:nowrap;overflow:hidden;color:#e5e7eb;
border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04)}
.rg-le u{flex:none;width:10px;height:10px;border-radius:3px;background:var(--c)}
.rg-le em{margin-left:auto;font-style:normal;font-weight:500;color:#9ca3af;font-variant-numeric:tabular-nums}
.rg-le:hover{border-color:rgba(255,255,255,.45)}
.rg-le[aria-pressed="true"]{border-color:var(--c);background:color-mix(in srgb,var(--c) 30%,transparent);color:#fff}
.rg-le[aria-pressed="true"]::after{content:"only";margin-left:auto;font-size:.625rem;text-transform:uppercase;letter-spacing:.04em;color:#fff}
.rg-tn{position:absolute;left:0;right:0;bottom:0;height:5px;border-radius:0 0 .375rem .375rem;background:var(--c);pointer-events:none}

.rg-pd{display:flex;align-items:center;gap:12px;width:100%;height:100%}
.rg-pad{position:relative;flex:none;height:100%;width:104px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);border-radius:.625rem;border:1px solid rgba(255,255,255,.3);overflow:hidden;
background:rgba(255,255,255,.05);touch-action:none}
.rg-pad button{border:0 solid rgba(255,255,255,.1);border-width:0 1px 1px 0}
.rg-pad button:hover{background:rgba(255,255,255,.1)}
.rg-pad button[aria-pressed="true"]{background:rgba(251,191,36,.16)}
.rg-dot{position:absolute;left:calc(50% + var(--px)*33.33%);top:calc(50% - var(--py)*33.33%);width:18px;height:18px;margin:-9px;border-radius:50%;background:#fbbf24;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.6);
pointer-events:none;transition:left .12s ease-out,top .12s ease-out}
.rg-ax{position:absolute;font-size:.5625rem;font-weight:700;line-height:1;color:#d1d5db;pointer-events:none;white-space:nowrap}
.rg-ax0{left:50%;top:2px;translate:-50% 0}
.rg-ax1{right:2px;top:50%;translate:0 -50%}
.rg-ax2{left:3px;top:50%;translate:0 -50%}
.rg-ax3{left:50%;bottom:2px;translate:-50% 0}
.rg-pds{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:.8125rem;line-height:1.125rem;color:#d1d5db}
.rg-pds span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-pds b{color:#fde68a;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.rg-bl{display:flex;align-items:center;gap:8px;width:100%;min-width:0;font-size:.8125rem;line-height:1rem;color:#d1d5db}
.rg-bn{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rg-bn b{color:#fff}
.rg-bp{flex:none;font-size:1rem;font-weight:800;color:#fbbf24}
.rg-slot{flex:none;border:1px dashed rgba(255,255,255,.4);border-radius:.5rem;padding:0 .625rem;line-height:1.75rem;font-size:.75rem;color:#9ca3af;white-space:nowrap}
.rg-pt{flex:0 1 auto;min-width:0;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 8px 0 3px;border-radius:.5rem;border:1px solid #fbbf24;background:rgba(251,191,36,.16);color:#fff}
.rg-pt img{flex:none;width:18px;height:27px;border-radius:2px;object-fit:cover}
.rg-pt b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rg-pt em{flex:none;font-style:normal;font-size:.6875rem;color:#fde68a;text-decoration:underline}
.rg-pt:hover{background:rgba(251,191,36,.3)}
.rg-pl{position:absolute;right:-6px;top:-6px;z-index:1;width:22px;height:22px;border-radius:50%;background:#0d111c;border:1.5px solid #fbbf24;color:#fbbf24;font-size:.9375rem;font-weight:800;line-height:19px;text-align:center;
scale:calc(1/var(--s,1));cursor:copy}
.rg-pl::before{content:"";position:absolute;inset:-5px}
.rg-pl:hover{background:#fbbf24;color:#000}
.rg-in{position:absolute;left:0;right:0;bottom:0;padding:.5rem 0 1px;border-radius:0 0 .375rem .375rem;background:linear-gradient(transparent,rgba(0,0,0,.92) 45%);font-size:.5625rem;font-weight:700;line-height:.75rem;
text-align:center;color:#fde68a;pointer-events:none}

.rg-iw{height:100%;overflow:hidden;font-size:.8125rem;line-height:1.0625rem;color:#d1d5db;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
.rg-iw b{font-weight:700;color:color-mix(in srgb,var(--c) 50%,#fff)}

@media (min-width:1024px){
.pl-stage[class*="pl-rings"],.pl-stage[class*="pl-mix"]{flex:1;width:auto;height:420px}
.rm.rg{grid-template-rows:30px minmax(0,1fr)}
.rm.rg .rm-top{height:30px}
.rm.rg .rm-info,.rg-tall .rm-info.rg-info{height:auto;padding-top:2.5rem}
.rg-tall .rg-nt{display:-webkit-box}
.rg-wds,.rg-pr{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:28px;height:28px}
.rg-lg{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:28px;height:28px}
.rg-st{flex-direction:row;align-items:center;gap:.5rem}
.rg-st>span{flex:none;height:auto;font-size:.8125rem}
.rg-st em{margin-left:.25rem}
.rg-st>div{flex:1 1 0;min-width:0;max-width:11rem}
.rg-iw{font-size:.8125rem;line-height:.9375rem;-webkit-line-clamp:2}
.rg-info .rm-nm b{min-height:3.75rem}
.rg-info .rm-nm small{min-width:6.5rem}
.rg-vs,.rg-nt{height:4.125rem;font-size:.9375rem;line-height:1.375rem;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
.rg-ld{max-width:none}
.rm.rg-big{grid-template-rows:auto minmax(0,1fr)}
.rg-big .rm-map{grid-row:1/3}
.rm.rg-big .rm-info{grid-row:1;padding-top:0;gap:.5rem}
.rg-big .rg-info .rm-nm{height:5.75rem}
.rm.rg-big .rm-top{grid-column:2;grid-row:2;height:auto;min-height:0;align-items:flex-start}
.rg-big .rg-vs,.rg-big .rg-nt{height:2.75rem;-webkit-line-clamp:2}
.rg-big .rg-bars{flex-direction:column;gap:3px;height:auto}
.rg-big .rg-b{flex:none;grid-template-columns:20px 92px minmax(0,1fr) 30px;grid-template-rows:20px;column-gap:6px;padding:0 6px}
.rg-big .rg-b i{grid-column:1;grid-row:1}
.rg-big .rg-b b{grid-column:2;grid-row:1;font-size:.75rem;line-height:1rem}
.rg-big .rg-b s{grid-column:3;grid-row:1;align-self:center;height:8px;margin:0}
.rg-big .rg-b u{top:0;right:auto;height:auto;width:calc(var(--v)*10%)}
.rg-big .rg-b em{grid-column:4;grid-row:1;text-align:right}
.rg-big .rg-b[aria-pressed="true"][data-d="w"] s::after{top:0;bottom:0;left:60%;right:0}
.rg-big .rg-b[aria-pressed="true"][data-d="o"] s::after{top:0;bottom:0;left:0;right:60%}
.rg-big .rg-pd{flex-direction:column;align-items:flex-start;gap:8px;height:auto}
.rg-big .rg-pad{width:140px;height:140px}
.rg-big .rg-ax{font-size:.6875rem}
}
@media (prefers-reduced-motion:reduce){
.pl-stage[class] .rm.rg .rm-p.rg-new,.pl-stage[class] .rm.rg .rm-p[data-r-x],.rg .rm-p .pl-cm{animation:none}
.pl-stage[class] .rm.rg .rm-p,.rg .rm-p[data-pl-came] img{transition:none}
.rg-dot{transition:none}
}
`
