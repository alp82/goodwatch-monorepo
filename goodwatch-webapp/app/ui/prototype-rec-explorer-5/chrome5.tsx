// PROTOTYPE - throwaway. Controls around the round-5 map (#180): the top bar (grouping, history, filters), an
// island's identity as a small DOM badge (for the close-up's doors and the zoom ladder), the zoom ladder with the
// fractal's steps, and the page styles. Round 4's history, grouping bar, minimap and toast are reused as they are.
import { MinusIcon, PlusIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { FilterChips, WhoNote } from "~/ui/prototype-rec-explorer-2/kit2"
import { GroupBar, as2 } from "~/ui/prototype-rec-explorer-4/chrome"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { Config } from "./config"
import type { Engine } from "./engine5"
import { GLYPHS } from "./glyphs"
import { EMOJI_FONT, type Ident, drawFlag } from "./identity"

/** The top of the page: name, grouping, history, filters, who it's for. */
export function Top5({ ex, history }: { ex: Ex4; history: React.ReactNode }) {
	return (
		<header className="rx4-top">
			<div className="rx4-top-row">
				<h1 className="rx4-display rx4-h1">Explore</h1>
				<GroupBar ex={ex} />
			</div>
			<div className="rx4-top-row rx4-top-row2">
				{history}
				<FilterChips ex={as2(ex)} className="rx4-filters" />
			</div>
			<WhoNote
				ex={as2(ex)}
				className="rx4-who"
				extra="Tap an island to fly in. Keep zooming: every step shows each title's closest titles around it. Push into a poster to open it."
			/>
		</header>
	)
}

function FlagDom({ flag, h }: { flag: string; h: number }) {
	const ref = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		const c = ref.current
		if (!c) return
		const dpr = Math.min(2, window.devicePixelRatio || 1)
		c.width = Math.round(h * 1.5 * dpr)
		c.height = Math.round(h * dpr)
		const g = c.getContext("2d") as CanvasRenderingContext2D
		g.setTransform(dpr, 0, 0, dpr, 0, 0)
		drawFlag(g, flag, 0, 0, h * 1.5, h)
	}, [flag, h])
	return (
		<canvas
			ref={ref}
			style={{ width: h * 1.5, height: h, borderRadius: 3, display: "block" }}
			aria-hidden
		/>
	)
}

/** An island's identity, small, for the DOM. */
export function IdentBadge({
	ident,
	color,
	icons,
	size = 22,
}: { ident: Ident; color: string; icons: Config["icons"]; size?: number }) {
	if (ident.kind === "logo")
		return (
			<img
				src={ident.src}
				alt=""
				className="rx5-badge-logo"
				style={{ width: size, height: size }}
			/>
		)
	if (ident.kind === "flag")
		return <FlagDom flag={ident.flag} h={Math.round(size * 0.72)} />
	if (ident.kind === "era")
		return (
			<span
				className="rx5-badge-era"
				style={{
					fontFamily: `'${ident.era.font}', system-ui`,
					fontWeight: ident.era.weight,
					fontStyle: ident.era.italic ? "italic" : undefined,
					color: ident.era.color,
					fontSize: size * 0.62,
				}}
			>
				{ident.era.text}
			</span>
		)
	if (icons === "emoji")
		return (
			<span
				aria-hidden
				style={{ fontFamily: EMOJI_FONT, fontSize: size * 0.82, lineHeight: 1 }}
			>
				{ident.emoji}
			</span>
		)
	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			aria-hidden
			style={{ color, flex: "none" }}
		>
			<title>{ident.glyph}</title>
			{(GLYPHS[ident.glyph] ?? []).map((p) => (
				<path
					key={p.d}
					d={p.d}
					fill="currentColor"
					fillRule={p.evenodd ? "evenodd" : undefined}
					clipRule={p.evenodd ? "evenodd" : undefined}
				/>
			))}
		</svg>
	)
}

const STEP_NAMES = [
	"All islands",
	"",
	"Closest titles",
	"Their closest",
	"Close-up",
]

/** Zoom buttons and the fractal's steps: all islands, one island, each ring of closer titles, the close-up. */
export function Ladder5({
	eng,
	cine,
	islandName,
	onStep,
}: {
	eng: Engine | null
	cine: boolean
	islandName: string
	onStep: (step: number) => void
}) {
	const [k, setK] = useState(0)
	useEffect(() => {
		if (!eng) return
		let raf = 0
		const update = () => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const v = eng.view()
				const s = v.cam.s
				// Continuous position between the steps, on a log scale.
				const at = [v.fit, ...v.stops]
				let pos = 0
				if (s >= at[at.length - 1]) pos = at.length - 1
				else
					for (let j = 0; j < at.length - 1; j++)
						if (s < at[j + 1]) {
							pos =
								j +
								Math.max(0, Math.log(s / at[j]) / Math.log(at[j + 1] / at[j]))
							break
						}
				const nk = Math.round(pos * 20) / 20
				setK((x) => (x === nk ? x : nk))
			})
		}
		update()
		const off = eng.subscribe(update)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [eng])
	const at = cine ? 4 : k
	const current = Math.round(at)
	const names = STEP_NAMES.map((n, j) => (j === 1 ? islandName || "Island" : n))
	return (
		<div className="rx4-ladder" aria-label="Zoom">
			<button
				type="button"
				aria-label="Zoom in"
				className="rx4-zbtn"
				onClick={() => onStep(Math.min(4, Math.floor(at + 0.05) + 1))}
			>
				<PlusIcon className="rx4-i" />
			</button>
			<div className="rx4-scale rx5-scale">
				<div className="rx4-rail" />
				<div
					className="rx4-mark"
					style={{ "--k": at / 4 } as React.CSSProperties}
				/>
				{names.map((n, j) => (
					<button
						key={STEP_NAMES[j] || "island"}
						type="button"
						onClick={() => onStep(j)}
						className={`rx4-stop ${current === j ? "rx4-stop-on" : ""}`}
						style={{ "--k": j / 4 } as React.CSSProperties}
						title={`Zoom to ${n}`}
						aria-label={`Zoom to ${n}`}
					>
						<span className="rx4-stop-dot" />
						<span className="rx4-stop-t">{n}</span>
					</button>
				))}
			</div>
			<button
				type="button"
				aria-label="Zoom out"
				className="rx4-zbtn"
				onClick={() => onStep(Math.max(0, Math.ceil(at - 0.05) - 1))}
			>
				<MinusIcon className="rx4-i" />
			</button>
		</div>
	)
}

const CSS5 = `
.rx5-scale{height:9.5rem}
@media (max-width:1023px){.rx5-scale{height:2.6rem;width:7rem}}
.rx5-badge-logo{border-radius:22%;object-fit:cover;flex:none;display:block}
.rx5-badge-era{line-height:1;white-space:nowrap;flex:none}
.rx5-where{position:absolute;z-index:22;left:1.5rem;bottom:1.25rem;display:flex;align-items:center;gap:.5rem;height:2.5rem;padding:0 1rem 0 .6rem;border-radius:999px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px);font-weight:800;font-size:.9rem;white-space:nowrap;pointer-events:none}
.rx5-where-n{font-weight:600;color:#a8a29e;font-size:.8rem}
@media (max-width:1023px){.rx5-where{bottom:auto;top:8.2rem;left:1rem;transform:none;height:2.2rem;font-size:.8rem}}
/* ---- close-up ---- */
.rx5-cbar{position:absolute;z-index:32;left:1rem;top:1rem;display:flex;align-items:center;gap:.5rem;max-width:calc(100% - 2rem)}
@media (min-width:1024px){.rx5-cbar{left:1.5rem;top:1.25rem}}
.rx5-back{display:inline-flex;align-items:center;gap:.45rem;height:2.75rem;padding:0 1rem;border-radius:999px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.18);font-weight:800;font-size:.9rem;color:#fff;backdrop-filter:blur(6px);flex:none}
.rx5-back:hover{border-color:rgba(255,255,255,.5)}
.rx5-back:focus-visible,.rx5-door:focus-visible,.rx5-nav:focus-visible{outline:2px solid #fff;outline-offset:2px}
.rx5-panel{position:absolute;z-index:31;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;color:#fff}
.rx5-side{right:1rem;top:1rem;bottom:1rem;width:25rem;padding:1.4rem 1.4rem 1.2rem;border-radius:1.25rem;background:linear-gradient(to bottom,rgba(12,10,9,.9),rgba(12,10,9,.82));border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);animation:rx5in .45s cubic-bezier(.2,.7,.2,1) both}
@keyframes rx5in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
.rx5-marq{left:0;right:0;bottom:0;padding:0 1.5rem 4.4rem;pointer-events:none;background:linear-gradient(to top,rgba(12,10,9,.95) 0%,rgba(12,10,9,.7) 45%,transparent);animation:rx5up .45s cubic-bezier(.2,.7,.2,1) both}
.rx5-marq>*{pointer-events:auto}
@keyframes rx5up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.rx5-marq-title{font-size:clamp(3rem,7.4vw,7.5rem);font-weight:900;line-height:.86;text-wrap:balance;max-width:44rem;text-shadow:0 4px 30px rgba(0,0,0,.6)}
.rx5-marq-row{display:flex;align-items:flex-end;gap:1.5rem;margin-top:1rem}
.rx5-marq-doors{display:grid;grid-template-columns:repeat(2,minmax(0,15rem));gap:.5rem;margin-left:auto}
.rx5-title{font-size:2.6rem;font-weight:900;line-height:.92;text-wrap:balance}
.rx5-meta{margin-top:.6rem;color:#d6d3d1;font-size:.95rem}
.rx5-why{margin-top:.75rem;font-size:1.05rem;color:#e7e5e4;min-height:1.5rem}
.rx5-match{font-size:2.2rem;font-weight:900;line-height:1}
.rx5-match-l{font-size:1rem;font-weight:800;color:#d6d3d1;margin-left:.2rem}
.rx5-acts{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:1rem}
.rx5-nav-row{display:flex;align-items:center;gap:.5rem;margin-top:1.1rem;padding:.35rem .35rem .35rem .8rem;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.rx5-nav-where{flex:1;min-width:0;display:flex;align-items:center;gap:.5rem;font-weight:800;font-size:.9rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.rx5-nav-n{font-weight:600;color:#a8a29e;font-size:.8rem}
.rx5-nav{display:flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:999px;background:rgba(255,255,255,.1);color:#fff;flex:none}
.rx5-nav:hover{background:rgba(255,255,255,.25)}.rx5-nav:disabled{opacity:.3}
.rx5-doors{display:flex;flex-direction:column;gap:.45rem;margin-top:1rem}
.rx5-doors-h{font-size:.8rem;font-weight:800;color:#a8a29e}
.rx5-door{display:flex;align-items:center;gap:.65rem;min-width:0;padding:.4rem .7rem .4rem .45rem;border-radius:.9rem;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);text-align:left;transition:border-color .15s,background .15s}
.rx5-door:hover{border-color:rgba(251,191,36,.7);background:rgba(120,53,15,.35)}
.rx5-door-img{width:2.3rem;height:3.45rem;border-radius:4px;object-fit:cover;flex:none;background:#292524}
.rx5-door-dir{font-size:1.2rem;font-weight:900;color:#fbbf24;width:1.1rem;text-align:center;flex:none}
.rx5-door-to{display:flex;align-items:center;gap:.4rem;font-family:'Big Shoulders Display','Gabarito',system-ui,sans-serif;font-weight:900;font-size:1.15rem;line-height:1.05;min-width:0}
.rx5-door-to>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rx5-door-t{display:block;font-size:.76rem;color:#d6d3d1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rx5-sheet{left:0;right:0;bottom:0;max-height:42%;padding:1rem 1rem 6.5rem;border-radius:1.25rem 1.25rem 0 0;background:rgba(12,10,9,.94);border-top:1px solid rgba(255,255,255,.12);animation:rx5up .4s cubic-bezier(.2,.7,.2,1) both}
.rx5-sheet .rx5-title{font-size:1.9rem}
.rx5-sheet .rx5-why{font-size:.95rem}
.rx5-sheet .rx5-doors{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}
.rx5-sheet .rx5-door-img{display:none}
.rx5-sheet .rx5-door-to{font-size:1rem}
@media (prefers-reduced-motion:reduce){.rx5-side,.rx5-marq,.rx5-sheet{animation:none}}
`
export function Styles5() {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: the page's own static stylesheet, as rounds 1-4 ship theirs.
	return <style dangerouslySetInnerHTML={{ __html: CSS5 }} />
}
