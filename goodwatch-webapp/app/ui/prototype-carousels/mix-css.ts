// PROTOTYPE for "Prototype native-scroll carousels on title pages", twelfth round. Throwaway code: not for production.
//
// The style of the twelfth round's remixes (mix1 to mix6), on top of the rings' (rings-css.ts). One control for all
// of them: a slim chip that is also a bar. Its background fills to a level, the part a tap adds is green, the part it
// takes away is red and striped, and a chip that is on wears the color of its selection. The marks on posters are
// small on purpose: a thin line, or a badge at a corner.
export const MIX_CSS = `
.ix-row{display:grid;gap:5px;width:100%;height:100%}
.ix-6{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
.ix-4{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
.ix-hd{display:flex;flex-direction:column;gap:5px;width:100%;height:100%;min-width:0}
.ix-ln{flex:none;display:flex;align-items:baseline;gap:.5rem;height:18px;min-width:0;font-size:.8125rem;line-height:1.125rem;white-space:nowrap}
.ix-ln b{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#fde68a;font-weight:700}
.ix-ln span{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#9ca3af;font-size:.75rem}
.ix-chs{flex:1;display:flex;gap:5px;min-width:0;min-height:0}
.ix-chs .ix-c{flex:1 1 0}
.ix-chs .ix-c:nth-child(n+4){display:none}
.ix-no{align-self:center;min-width:0;font-size:.75rem;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ix-c{position:relative;z-index:0;min-width:0;display:flex;align-items:center;gap:.1875rem;padding:0 .3125rem;border-radius:.5rem;overflow:hidden;font-size:.6875rem;line-height:1rem;font-weight:600;
color:#e5e7eb;white-space:nowrap;text-align:left;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.035)}
.ix-c>u{position:absolute;top:0;bottom:0;z-index:-1;text-decoration:none;pointer-events:none}
.ix-f{left:0;width:calc(var(--v)*10%);background:rgba(255,255,255,.16);box-shadow:1.5px 0 0 rgba(255,255,255,.5)}
.ix-z{left:calc(var(--a)*10%);width:calc((var(--b) - var(--a))*10%);opacity:0;transition:opacity .12s}
.ix-c[data-d="up"]{--g:rgba(34,197,94,.65)}
.ix-c[data-d="dn"]{--g:rgba(239,68,68,.65)}
.ix-c[data-d="up"] .ix-z{background:#22c55e}
.ix-c[data-d="dn"] .ix-z{background:repeating-linear-gradient(135deg,#ef4444 0 3px,rgba(239,68,68,.4) 3px 6px)}
.ix-n{left:calc(var(--n)*10%);width:0;border-left:1.5px dashed rgba(255,255,255,.85);opacity:0}
.ix-c>i{flex:none;font-size:.8125rem}
.ix-c>b{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.ix-c>em{flex:none;margin-left:auto;font-style:normal;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.ix-c .ix-p,.ix-x{display:none}
.ix-s{font-size:0}
.ix-s::before{content:attr(data-s);margin-right:1px;font-size:.8125rem;font-weight:800}
.ix-s[data-s="+"]::before{color:#4ade80}
.ix-s[data-s="−"]::before{color:#f87171}
.ix-4 .ix-s{font-size:inherit}
.ix-4 .ix-s::before{content:none}
.ix-c small{margin-left:.25rem;font-size:.625rem;font-weight:500;color:#e5e7eb;text-decoration:underline}
.ix-c:hover{border-color:rgba(255,255,255,.55)}
.ix-c[data-r-on] .ix-z{opacity:.5}
.ix-c[data-r-on] .ix-n,.ix-c[aria-pressed="true"] .ix-n{opacity:.9}
.ix-c[data-r-on] .ix-r,.ix-c[aria-pressed="true"] .ix-r{display:none}
.ix-c[data-r-on] .ix-p,.ix-c[aria-pressed="true"] .ix-p{display:inline}
.ix-c[aria-pressed="true"]{border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c);color:#fff}
.ix-c[aria-pressed="true"] .ix-z{opacity:.8}
@keyframes ix-fl{0%{opacity:1;filter:brightness(1.9)}22%{opacity:.2}44%{opacity:1;filter:brightness(1.6)}66%{opacity:.3}100%{opacity:.8;filter:none}}
@keyframes ix-gl{0%{box-shadow:inset 0 0 0 1px var(--c),0 0 0 4px var(--g)}100%{box-shadow:inset 0 0 0 1px var(--c),0 0 0 0 transparent}}
.ix-c[data-fl] .ix-z{animation:ix-fl 1.2s ease-in-out var(--fa,0ms) both}
.ix-c[data-fl]{animation:ix-gl 1.2s ease-out var(--fa,0ms) both}

.ix-k{left:calc(var(--m)*10%);width:0;margin-left:-1px;border-left:2px solid #fff;transition:left .28s cubic-bezier(.3,.3,.2,1)}
.ix-k::after{content:"";position:absolute;left:-4px;top:-1px;border:3px solid transparent;border-top:4px solid #fff}
.ix-w{left:calc(var(--w)*10%);width:0;border-left:1.5px dotted rgba(255,255,255,.75)}
.ix-ba .ix-z{opacity:.42;transition:left .28s cubic-bezier(.3,.3,.2,1),width .28s cubic-bezier(.3,.3,.2,1),opacity .12s}
.ix-ba .ix-c .ix-n{display:none}
.ix-ba .ix-c .ix-r{display:inline}
.ix-ba .ix-c .ix-p{display:none}
.ix-ba .ix-c[data-r-wd] .ix-r{display:none}
.ix-ba .ix-c[data-r-wd] .ix-p{display:inline;color:#fde68a}
.ix-ba .ix-c[data-r-wd] .ix-k{border-left-color:#fde68a}
.ix-ba .ix-c[data-r-wd] .ix-k::after{border-top-color:#fde68a}
.ix-ba .ix-c[data-r-wd] .ix-z,.ix-ba .ix-c[aria-pressed="true"] .ix-z{opacity:.8}

.ix-ts{align-items:center;gap:10px}
.ix-t{flex:0 1 auto;display:block;min-width:0;font-size:.75rem;line-height:1rem;font-weight:700;color:#e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ix-t small{margin-right:.25rem;font-size:.75rem;font-weight:500;color:#9ca3af}
.ix-t i{margin-right:.125rem}

.ix-in{position:absolute;left:0;right:0;bottom:0;height:4px;border-radius:0 0 .375rem .375rem;background:var(--c);pointer-events:none}
.ix-up,.ix-b{position:absolute;top:-3px;min-width:17px;height:17px;border-radius:9px;background:#0d111c;border:1.5px solid var(--c);text-align:center;scale:calc(1/var(--s,1));pointer-events:none}
.ix-up{right:-3px;color:var(--c);font-size:.5625rem;font-weight:800;line-height:14px}
.ix-b{left:-3px;font-size:.625rem;line-height:14px}
.ix-bp{box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 45%,transparent)}
.rg-mix4 .rm-p[style*="--fd2"] img{opacity:.5}

@media (min-width:1024px){
.ix-6{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:28px;height:28px}
.ix-4{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:28px;height:28px}
.ix-hd{flex-direction:row;align-items:center;gap:.75rem;height:30px}
.ix-ln{flex:0 1 auto;max-width:42%;height:auto}
.ix-ln span{flex:0 1 auto}
.ix-chs{flex:1 1 0;height:28px}
.ix-chs .ix-c:nth-child(n+4){display:flex}
.ix-chs .ix-c{max-width:15rem}
.ix-c{font-size:.78125rem;padding:0 .5rem;gap:.25rem}
.ix-x{display:inline}
.ix-t{font-size:.8125rem}
.rg-big .ix-s{font-size:inherit}
.rg-big .ix-s::before{content:none}
.rg-big .ix-6{grid-template-columns:minmax(0,1fr);grid-template-rows:none;grid-auto-rows:25px;gap:4px;height:auto}
.rg-big .ix-c{font-size:.8125rem}
}
@media (min-width:1024px) and (max-width:1279px){
.ix-chs .ix-c:nth-child(n+4){display:none}
}
@media (min-width:1280px){
.ix-s{font-size:inherit}
.ix-s::before{content:none}
}
@media (prefers-reduced-motion:reduce){
.ix-c[data-fl],.ix-c[data-fl] .ix-z{animation:none}
.ix-k,.ix-ba .ix-z,.ix-z{transition:none}
}
`
