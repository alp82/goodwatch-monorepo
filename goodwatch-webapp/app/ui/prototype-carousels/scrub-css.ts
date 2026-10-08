// PROTOTYPE for "Prototype native-scroll carousels on title pages", eighth round. Throwaway code: not for production.
//
// The style of the scrub forms (scrub1 to scrub10), added to the play forms' shared rules for those forms only (see
// playCss in play-css.ts). A poster's place is 58 px wide, a small one 42 px, a tick 26 px, and a zone's name 96 px:
// scrub-forms.ts computes the strip's positions from the same numbers.
export const SCRUB_CSS = `
.sc{position:absolute;inset:0;display:flex;flex-direction:column;gap:5px}
.sc s,.sc u{text-decoration:none}
.sc q{quotes:none}
.sc q::before,.sc q::after{content:none}
.sc small{font-size:.625rem;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;white-space:nowrap}
.sc-pick{flex:none;display:flex;flex-direction:column;gap:4px;min-width:0}
.sc-row{display:flex;align-items:center;gap:5px;height:26px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x pan-y}
.sc-row::-webkit-scrollbar{display:none}
.sc-row>small{flex:none}
.sc-ch{flex:none;display:inline-flex;align-items:center;gap:.25rem;border-radius:9999px;padding:0 .5625rem;height:1.5rem;font-size:.75rem;line-height:1.5rem;color:#d1d5db;
background:rgba(255,255,255,.08);border:1px solid transparent;white-space:nowrap}
.sc-ch:hover{background:rgba(255,255,255,.16)}
.sc-ch[aria-pressed="true"]{background:#fbbf24;color:#000;font-weight:700}
.sc-ch b{font-weight:700;font-variant-numeric:tabular-nums}
.sc-sw{padding:0 .5rem;font-weight:800;border-color:rgba(255,255,255,.25)}
.sc-up[aria-pressed="true"]{background:#34d399}
.sc-dn[aria-pressed="true"]{background:#f87171}
.sc-bc s,.sc-vc s{position:relative;display:block;width:34px;height:5px;border-radius:9999px;background:rgba(255,255,255,.14)}
.sc-bc s u{display:block;height:100%;border-radius:9999px;background:var(--c)}
.sc-vc s u{position:absolute;top:0;bottom:0;border-radius:9999px;background:#7dd3fc}
.sc-bc em{font-style:normal;color:#fbbf24}
.sc-ch[aria-pressed="true"] s{background:rgba(0,0,0,.22)}
.sc-ch[aria-pressed="true"] s u{background:#000}
.sc-ch[aria-pressed="true"] em{color:#000}
.sc-flat{opacity:.6}
.sc-q{flex:none;width:8.5rem;height:1.5rem;border-radius:9999px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.3);color:#fff;padding:0 .625rem;font-size:16px;line-height:1.25rem}
.sc-q::placeholder{color:#9ca3af}
.sc-none{padding:0 .25rem}

.sc-focus{flex:1;min-height:0;display:flex}
.sc-f{flex:1;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:.75rem;align-items:center;text-align:left;border-radius:.625rem;padding:.5rem;
background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);overflow:hidden}
button.sc-f:hover{border-color:#fbbf24}
.sc-big{height:100%;aspect-ratio:2/3;max-height:168px;border-radius:.375rem;overflow:hidden;background:#1b2130;box-shadow:0 4px 14px rgba(0,0,0,.55)}
.sc-here .sc-big{outline:3px solid #fff}
.sc-big img{display:block;width:100%;height:100%;object-fit:cover}
.sc-tx{display:flex;flex-direction:column;gap:.125rem;min-width:0;font-size:.75rem;line-height:1.0625rem;color:#d1d5db}
.sc-tx>b{font-size:.9375rem;line-height:1.1875rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-tx>small{text-transform:none;letter-spacing:0;font-size:.6875rem}
.sc-tx strong{color:#fde68a;font-weight:800}
.sc-abs{color:#7dd3fc;font-weight:800}
.sc-cmp{color:#e5e7eb}
.sc-df{color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-df:empty{display:none}
.sc-go{font-style:normal;font-weight:800;color:#fbbf24}
.sc-bl{display:grid;grid-template-columns:minmax(0,8.5rem) minmax(1.5rem,1fr) 1.25rem;align-items:center;gap:.375rem}
.sc-bl em{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-bl s{position:relative;display:block;height:6px;border-radius:9999px;background:rgba(255,255,255,.1)}
.sc-bl u{display:block;height:100%;border-radius:9999px;background:var(--c)}
.sc-bl q{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#fff;border-radius:1px}
.sc-bl b{color:#fff;text-align:right;font-variant-numeric:tabular-nums}
.sc[data-compact] .sc-f{padding:.375rem;gap:.625rem}
.sc[data-compact] .sc-tx{gap:0}
.sc[data-compact] .sc-tx>small{display:none}

.sc-rail{position:relative;flex:none;height:88px}
.sc-strip{display:flex;height:100%;align-items:flex-end;box-sizing:border-box;padding-bottom:3px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;
touch-action:pan-x pan-y;overscroll-behavior-x:contain}
.sc-strip::-webkit-scrollbar{display:none}
.sc-strip::before,.sc-strip::after{content:"";flex:none;width:50%}
.sc-i{flex:none;width:52px;margin:0 3px;scroll-snap-align:center;border-radius:.3125rem;opacity:.72}
.sc-i img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:.3125rem}
.sc-i[data-on]{opacity:1}
.sc-me{position:relative;display:block;outline:2px solid #fff;opacity:1}
.sc-i:has(.sc-pg){outline-color:#fff}
.sc-pg{position:absolute;left:50%;top:-1px;translate:-50% 0;border-radius:0 0 3px 3px;background:#fff;padding:0 3px;font-size:.5rem;font-weight:800;line-height:.75rem;color:#000;white-space:nowrap;pointer-events:none}
.sc-nb{position:absolute;left:0;right:0;bottom:0;border-radius:0 0 .3125rem .3125rem;background:rgba(0,0,0,.72);font-size:.625rem;font-weight:800;line-height:.875rem;text-align:center;color:#fff;
font-variant-numeric:tabular-nums;pointer-events:none}
.sc-tk{flex:none;align-self:stretch;width:26px;display:flex;flex-direction:column;align-items:center;gap:1px;padding-top:5px;box-sizing:border-box;color:#fde68a;font-size:.6875rem;font-weight:800}
.sc-tk b{line-height:.875rem;font-variant-numeric:tabular-nums}
.sc-tk small{writing-mode:vertical-rl;font-size:.5625rem;text-transform:none;letter-spacing:0;font-weight:500}
.sc-tk::after{content:"";flex:1;width:1px;background:linear-gradient(rgba(253,230,138,.65),rgba(253,230,138,.08))}
.sc-tk[data-off]{opacity:.45}
.sc-tk[data-off]::after{width:0;background:none;border-left:1px dashed rgba(253,230,138,.6)}
.sc-tk[data-wide]{width:96px;align-items:flex-start;justify-content:center;gap:2px;padding:0 6px 0 8px;border-left:2px solid rgba(253,230,138,.55);text-align:left;line-height:.875rem}
.sc-tk[data-wide]::after{display:none}
.sc-tk[data-wide] small{writing-mode:horizontal-tb;font-size:.625rem}
.sc-mark{position:absolute;left:50%;top:0;bottom:0;width:60px;translate:-50% 0;border-radius:.5rem;border:2px solid #fbbf24;pointer-events:none;box-shadow:0 0 14px rgba(251,191,36,.35)}
.sc-nd{display:none;position:absolute;top:50%;translate:0 -50%;width:1.625rem;height:1.625rem;border-radius:9999px;background:rgba(13,17,28,.92);border:1px solid rgba(255,255,255,.3);color:#fff;font-weight:800;line-height:1.375rem}
.sc-nd[data-arg="-1"]{left:2px}
.sc-nd[data-arg="1"]{right:2px}
.sc-nd:hover{border-color:#fbbf24}
@media (hover:hover) and (pointer:fine){.sc-nd{display:block}}
.sc-rail[data-sz="s"]{height:62px}
.sc-rail[data-sz="s"] .sc-i{width:36px}
.sc-rail[data-sz="s"] .sc-mark{width:44px}
.sc-rail[data-sz="s"] .pl-cm{font-size:.5rem;padding:0 .125rem}
.sc-rail[data-sz="s"] .sc-tk{padding-top:2px}
.sc-rail[data-bands]{height:180px}
.sc-rail[data-bands] .sc-strip{align-items:flex-start;padding:4px 0 0}
.sc-rail[data-bands] .sc-i{translate:0 calc(var(--b)*58px)}
.sc-bn{position:absolute;inset:4px 0 auto 0;display:flex;flex-direction:column;pointer-events:none}
.sc-bn>i{display:block;height:58px;box-sizing:border-box;border-top:1px dashed rgba(253,230,138,.28)}
.sc-bn span{display:inline-block;border-radius:0 0 .25rem 0;background:rgba(13,17,28,.9);padding:0 .3125rem;font-size:.625rem;font-weight:700;line-height:.875rem;color:#fde68a;white-space:nowrap}
.sc-lh{flex:none;display:flex;align-items:center;justify-content:space-between;gap:.5rem;height:16px;margin-bottom:-5px;font-size:.6875rem;line-height:1rem;color:#d1d5db;white-space:nowrap}
.sc-lh button{display:inline-flex;align-items:center;gap:.25rem;min-width:0;font-weight:700;color:#fde68a}
.sc-lh button:hover{text-decoration:underline}
.sc-lh b{color:#fff}

.sc-foot{flex:none;height:36px;min-width:0}
.sc-foot:empty{display:none}
.sc-ru{display:flex;align-items:flex-end;gap:.375rem;height:100%;font-size:.625rem;line-height:.75rem;color:#9ca3af;white-space:nowrap}
.sc-rl b{color:#fde68a}
.sc-rb{flex:1;min-width:0;display:grid;grid-template-columns:repeat(11,minmax(0,1fr));align-items:end;height:100%}
.sc-rc{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;padding:0;font-size:.625rem;color:#9ca3af}
.sc-rc u{display:block;width:60%;max-width:22px;border-radius:2px 2px 0 0;background:rgba(253,230,138,.4)}
.sc-rc b{width:100%;border-top:1px solid rgba(253,230,138,.45);font-weight:600;line-height:.75rem;text-align:center}
.sc-rc[data-n="0"] b{color:#6b7280}
.sc-rc[data-f] u{background:#fbbf24}
.sc-rc[data-f] b{border-radius:0 0 3px 3px;background:#fbbf24;color:#000}
.sc-rc[data-h]::before{content:"";position:absolute;top:2px;width:6px;height:6px;border-radius:50%;background:#fff}
.sc-rc[data-p]::after{content:"";position:absolute;top:0;width:10px;height:10px;box-sizing:border-box;border-radius:50%;border:1.5px solid #fff}
.sc-rc:hover b{color:#fff}
.sc-note{height:100%;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:.6875rem;line-height:1.0625rem;color:#9ca3af}
.sc-note b{color:#fde68a}
.sc-two{display:grid;grid-template-columns:1fr 1fr;gap:.875rem;height:100%;align-items:center}
.sc-two span{display:flex;flex-direction:column;gap:3px;min-width:0}
.sc-two small{text-transform:none;letter-spacing:0;line-height:.6875rem}
.sc-two small:first-child{font-weight:800;color:#fde68a}
.sc-two span+span small:first-child{color:#7dd3fc}
.sc-two s{position:relative;display:block;height:6px;border-radius:9999px;background:rgba(255,255,255,.12)}
.sc-two span:first-child s{background:linear-gradient(90deg,rgba(253,230,138,.2),rgba(253,230,138,.7))}
.sc-two u{position:absolute;top:0;bottom:0;border-radius:9999px;background:linear-gradient(90deg,rgba(253,230,138,.2),rgba(253,230,138,.7))}
.sc-two q{position:absolute;top:-3px;bottom:-3px;width:3px;margin-left:-1.5px;border-radius:1px;background:#fff}

@media (min-width:1024px){
.pl-stage[class*="pl-scrub"]{--sw:700px}
.sc-big{max-height:none}
.sc-tx{font-size:.875rem;line-height:1.25rem;gap:.25rem}
.sc-tx>b{font-size:1.25rem;line-height:1.5rem}
.sc-tx>small{font-size:.75rem}
.sc-bl{grid-template-columns:minmax(0,11rem) minmax(2rem,1fr) 1.5rem}
.sc-q{font-size:.8125rem}
.sc[data-compact] .sc-tx{gap:.125rem}
}
`
