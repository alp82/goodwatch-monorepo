// PROTOTYPE for "Prototype native-scroll carousels on title pages", tenth round. Throwaway code: not for production.
//
// The style of the tenth round's forms (roam1 to roam5), added to the play forms' shared rules for those forms only
// (see playCss in play-css.ts). A poster's place and size are three custom properties that roam-forms.ts sets; a
// poster that stays in the document from one picture to the next glides to its new place, and only `translate`,
// `scale`, and `opacity` move, so the compositor does it.
export const ROAM_CSS = `
.pl[class*="pl-roam"] .pl-side{display:none}
.pl-stage[class*="pl-roam"]{height:468px}
.rm{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px}
.rm p{margin:0}
.rm-top{flex:none;height:30px;display:flex;align-items:center;min-width:0}
.rm-map{position:relative;flex:1;min-height:0;overflow:hidden;border-radius:.75rem;background:radial-gradient(ellipse at center,rgba(255,255,255,.09),rgba(255,255,255,.02) 72%);touch-action:pan-y}
.rm-bg{position:absolute;inset:0;pointer-events:none}
.rm-g{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rm-g ellipse{fill:none;stroke:rgba(255,255,255,.13);stroke-width:1;stroke-dasharray:2 5}
.rm-arm polyline{fill:none;stroke:rgba(253,230,138,.4);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.rm-sp line{stroke:rgba(255,255,255,.12);stroke-width:1}
.rm-w{position:absolute;inset:0}
.rm-sc{position:absolute;inset:0;overflow:hidden}
.rm-sc[data-r-on]{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x pan-y;overscroll-behavior-x:contain;
-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,.25),#000 7%,#000 93%,rgba(0,0,0,.25));mask-image:linear-gradient(90deg,rgba(0,0,0,.25),#000 7%,#000 93%,rgba(0,0,0,.25))}
.rm-sc::-webkit-scrollbar{display:none}
.rm-sc .rm-w{position:relative;inset:auto;height:100%}
.rm-sc:not([data-r-on]) .rm-w{width:100%!important}
.rm-p,.rm-c{position:absolute;left:50%;top:50%;width:var(--pw);margin:calc(var(--pw)*-.75) 0 0 calc(var(--pw)*-.5);translate:var(--x,0) var(--y,0);scale:var(--s,1)}
.rm img{pointer-events:none;-webkit-user-drag:none}
@keyframes rm-in{from{opacity:0}}
.pl-stage[class] .rm .rm-p{animation:rm-in .15s ease-out;transition:translate .16s cubic-bezier(.2,.8,.3,1),scale .16s cubic-bezier(.2,.8,.3,1),opacity .15s}
.pl-stage[class] .rm[data-r-drag] .rm-p{transition:none;animation:none}
.rm-p[style*="--oc"]{outline-color:color-mix(in srgb,var(--oc) 62%,transparent)}
span.rm-p{height:calc(var(--pw)*1.5);aspect-ratio:auto}
.rm-c{z-index:2;scale:calc(var(--s,1)*1.1);transition:scale .24s cubic-bezier(.2,.8,.3,1)}
.rm-p .pl-cm{font-size:.625rem;padding:0 .25rem}
.rm-key{position:absolute;left:8px;bottom:6px;max-width:66px;font-size:.6875rem;line-height:.875rem;color:#9ca3af}
.rm-ctl{position:absolute;inset:0;z-index:4;pointer-events:none}
.rm-ctl>*{pointer-events:auto}
.rm-z{position:absolute;right:6px;bottom:6px;display:grid;grid-template-columns:32px 32px;gap:0 4px;justify-items:center}
.rm-z span{grid-column:1/3;font-size:.6875rem;line-height:.875rem;color:#9ca3af;font-variant-numeric:tabular-nums;white-space:nowrap}
.rm-z button{grid-row:2;width:32px;height:28px;border-radius:.5rem;background:rgba(13,17,28,.92);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:1.0625rem;font-weight:800;line-height:1}
.rm-z button:hover{border-color:#fbbf24}
.rm-z button:disabled{opacity:.3;cursor:default;border-color:rgba(255,255,255,.3)}
.rm-sw{display:flex;align-items:center;gap:5px;min-width:0;width:100%}
.rm-swl{flex:none;font-size:.75rem;color:#9ca3af}
.rm-ch{flex:0 1 auto;min-width:0;display:inline-flex;align-items:center;gap:.25rem;height:28px;padding:0 .5rem;border-radius:9999px;font-size:.78125rem;font-weight:700;line-height:1rem;white-space:nowrap;overflow:hidden;color:#fff;
border:1px solid color-mix(in srgb,var(--c) 70%,transparent);background:color-mix(in srgb,var(--c) 28%,transparent)}
.rm-ch::after{content:"✓";font-size:.6875rem;color:#fff;opacity:.85}
.rm-ch i{flex:none}
.rm-ch:hover{background:color-mix(in srgb,var(--c) 42%,transparent)}
.rm-ch[aria-pressed="false"]{border:1px dashed rgba(255,255,255,.32);background:none;color:#9ca3af;font-weight:500}
.rm-ch[aria-pressed="false"] i{filter:grayscale(1);opacity:.6}
.rm-ch[aria-pressed="false"]::after{content:"off";font-size:.625rem;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
.rm-ch[aria-pressed="false"]:hover{border-color:rgba(255,255,255,.6);color:#fff}
.rm-say{display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;min-width:0;font-size:.75rem;line-height:1rem;color:#9ca3af;white-space:nowrap}
.rm-say b{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:.8125rem;color:#fde68a;font-weight:700}
.rm-say span{flex:none}
.rm-cap{position:absolute;z-index:3;display:flex;flex-direction:column;margin:4px;padding:2px 6px;border-radius:.375rem;background:rgba(10,13,22,.9);border:1px solid color-mix(in srgb,var(--c) 60%,transparent);
font-size:.6875rem;font-weight:700;line-height:.875rem;color:#fff;white-space:nowrap}
.rm-cap i{font-weight:500;color:color-mix(in srgb,var(--c) 55%,#fff)}
.rm-lb{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;padding:.625rem 0 2px;border-radius:0 0 .375rem .375rem;background:linear-gradient(transparent,rgba(0,0,0,.94) 45%);
font-size:.5625rem;font-weight:700;line-height:.6875rem;color:#fff;white-space:nowrap;overflow:hidden;pointer-events:none}
.rm-lb i{font-weight:500;color:color-mix(in srgb,var(--c) 55%,#fff)}
.rm-pg{display:none;position:absolute;top:50%;translate:0 -50%;width:1.875rem;height:1.875rem;border-radius:9999px;background:rgba(13,17,28,.92);border:1px solid rgba(255,255,255,.3);color:#fff;font-weight:800;line-height:1.5rem}
.rm-pg[data-arg="-1"]{left:6px}
.rm-pg[data-arg="1"]{right:6px}
.rm-pg:hover,.rm-home:hover{border-color:#fbbf24}
@media (hover:hover) and (pointer:fine){.rm-pg{display:block}.rm-map[data-pl-pan],.rm-sc[data-r-on]{cursor:grab}}
.rm-home{position:absolute;left:50%;bottom:6px;translate:-50% 0;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:9999px;background:rgba(13,17,28,.94);border:1px solid rgba(255,255,255,.35);padding:0 .75rem;
font-size:.75rem;font-weight:700;line-height:1.5rem;color:#fff}
.rm-info{flex:none;display:flex;flex-direction:column;gap:2px;height:58px;min-width:0}
.rm-nm{display:flex;align-items:center;gap:.5rem;min-width:0;height:1.625rem}
.rm-nm b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.0625rem;line-height:1.375rem;color:#fff}
.rm-nm small{flex:none;font-size:.75rem;color:#9ca3af;white-space:nowrap}
.rm-nm .bs-open,.rm-nm .bs-this{flex:none;margin-left:auto}
.bs-open{border-radius:.5rem;background:#fbbf24;color:#000;font-weight:700;font-size:.8125rem;line-height:1.25rem;padding:.25rem .75rem}
.bs-open:hover{background:#fcd34d}
.bs-this{font-size:.75rem;color:#6b7280}
.rm-why{height:2rem;font-size:.8125rem;line-height:1rem;color:#e5e7eb;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.rm-why b{color:#fde68a;font-weight:700}
@media (min-width:1024px){
.pl-stage[class*="pl-roam"]{flex:1;width:auto;height:420px}
.rm{display:grid;grid-template-columns:minmax(0,1fr) 280px;grid-template-rows:30px minmax(0,1fr);gap:6px 1.5rem}
.rm-top{grid-column:1}
.rm-map{grid-column:1;grid-row:2}
.rm-info{grid-column:2;grid-row:1/3;height:auto;justify-content:flex-start;padding-top:3.5rem;gap:.75rem}
.rm-nm{flex-wrap:wrap;height:auto;row-gap:.5rem}
.rm-nm{align-content:flex-start;height:6.25rem;overflow:hidden}
.rm-nm b{flex:1 0 100%;font-size:1.5rem;line-height:1.875rem;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.rm-nm .bs-open,.rm-nm .bs-this{margin-left:0}
.rm-why{height:auto;font-size:.9375rem;line-height:1.375rem;-webkit-line-clamp:5}
.rm-ch{font-size:.8125rem;padding:0 .75rem}
.rm-swl,.rm-say{font-size:.8125rem}
.rm-cap{font-size:.75rem;line-height:1rem;flex-direction:row;gap:.25rem}
.rm-key{max-width:none}
}
@media (prefers-reduced-motion:reduce){
.pl-stage[class] .rm .rm-p,.rm-c{transition:none;animation:none}
}
`
