// PROTOTYPE - throwaway. Controls around the round-6 map (#180): the grouping, the two filters (hide, never dim),
// the history (the last two steps and a dropdown, like a browser's back button), the zoom rail with its readable
// levels, the minimap, and the page's styles. All glass over the live map, quiet so the islands carry the page.
import { ArrowUturnLeftIcon, ChevronDownIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import type { World } from "~/ui/prototype-rec-explorer-4/geo"
import type { Ex4, Step } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { GROUPINGS } from "~/ui/prototype-rec-explorer-4/wire4"
import type { Engine, Isl } from "./map6"
import { TMDB, rgbCss } from "./surface6"

export function TopBar({ ex, history }: { ex: Ex4; history: React.ReactNode }) {
	const mine = ex.services.filter((s) => s.mine)
	return (
		<header className="rx6-top">
			<div className="rx6-top-row">
				<h1 className="rx6-brand">Explore</h1>
				<div role="radiogroup" aria-label="Lay the islands out by" className="rx6-seg rx6-noscroll">
					{GROUPINGS.map((g) => (
						<button key={g.id} type="button" role="radio" aria-checked={ex.group === g.id} onClick={() => ex.setGroup(g.id)} className={`rx6-seg-b ${ex.group === g.id ? "rx6-seg-on" : ""}`}>
							{g.name}
						</button>
					))}
				</div>
			</div>
			<div className="rx6-top-row rx6-top-row2 rx6-noscroll">
				{history}
				<button type="button" aria-pressed={ex.onlyMine} onClick={() => ex.setOnlyMine(!ex.onlyMine)} className={`rx6-tog ${ex.onlyMine ? "rx6-tog-on" : ""}`} disabled={!ex.hasServices}>
					<span className="rx6-logos" aria-hidden>
						{mine.slice(0, 3).map((s) => (
							<img key={s.id} src={s.logo} alt="" />
						))}
					</span>
					On my services
				</button>
				<button type="button" aria-pressed={ex.notSeen} onClick={() => ex.setNotSeen(!ex.notSeen)} className={`rx6-tog ${ex.notSeen ? "rx6-tog-on" : ""}`}>
					<span className="rx6-tick" aria-hidden />
					Not seen yet
				</button>
			</div>
			<Who ex={ex} />
		</header>
	)
}

function Who({ ex }: { ex: Ex4 }) {
	const [params] = useSearchParams()
	const w = ex.who
	const other = new URLSearchParams(params)
	other.set("as", w.mode === "me" ? "demo" : "me")
	return (
		<p className="rx6-who">
			{w.mode === "me" ? `Picked for you from your ${w.rated.toLocaleString("en")} ratings` : `Picked for a demo member with ${w.rated} ratings`}
			{w.demoServices ? ", demo services" : ", your services"} in {w.country}.{" "}
			{w.signedIn && (
				<Link to={`?${other}`} reloadDocument className="rx6-who-a">
					{w.mode === "me" ? "Switch to the demo member" : "Use my profile"}
				</Link>
			)}
		</p>
	)
}

const thumb = (s: Step) => (s.title?.p ? <img crossOrigin="anonymous" src={`${TMDB}/w92${s.title.p}`} alt="" className="rx6-crumb-img" /> : null)

/** The last two steps, a back button, and every step in a dropdown. */
export function History6({ steps, onPick }: { steps: Step[]; onPick: (s: Step) => void }) {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => {
			if (!box.current?.contains(e.target as Node)) setOpen(false)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => {
			window.removeEventListener("pointerdown", off)
			window.removeEventListener("keydown", esc)
		}
	}, [open])
	const cur = steps[steps.length - 1]
	const prev = steps[steps.length - 2]
	return (
		<div ref={box} className="rx6-hist">
			<nav aria-label="Where you've been" className="rx6-crumbs">
				<button type="button" disabled={!prev} onClick={() => prev && onPick(prev)} aria-label={prev ? `Back to ${prev.label}` : "Back"} className="rx6-back">
					<ArrowUturnLeftIcon className="rx6-i-s" />
				</button>
				{prev && (
					<>
						<button type="button" onClick={() => onPick(prev)} className="rx6-crumb" title={prev.label}>
							{thumb(prev)}
							<span className="rx6-crumb-t">{prev.label}</span>
						</button>
						<span className="rx6-sep" aria-hidden>
							/
						</span>
					</>
				)}
				<span className="rx6-crumb rx6-crumb-on" aria-current="step" title={cur?.label}>
					{cur && thumb(cur)}
					<span className="rx6-crumb-t">{cur?.label}</span>
				</span>
				<button type="button" aria-expanded={open} aria-label="All steps" onClick={() => setOpen((o) => !o)} className="rx6-hist-btn">
					<span className="rx6-hist-n">{steps.length}</span>
					<ChevronDownIcon className="rx6-i-s" />
				</button>
			</nav>
			{open && (
				<ol className="rx6-hist-menu" aria-label="History, newest first">
					{[...steps].reverse().map((s, n) => (
						<li key={s.id}>
							<button
								type="button"
								onClick={() => {
									setOpen(false)
									if (n) onPick(s)
								}}
								className={`rx6-hist-item ${n === 0 ? "rx6-hist-cur" : ""}`}
							>
								{s.title?.p ? <img crossOrigin="anonymous" src={`${TMDB}/w92${s.title.p}`} alt="" className="rx6-hist-img" /> : <span className="rx6-hist-kind">{s.kind === "region" ? "Island" : "Map"}</span>}
								<span className="rx6-hist-t">{s.label}</span>
								{n === 0 && <span className="rx6-hist-here">You're here</span>}
							</button>
						</li>
					))}
				</ol>
			)}
		</div>
	)
}

/** Zoom buttons and the readable levels near the island in the middle. */
export function Rail6({ eng, onStop }: { eng: Engine | null; onStop: (s: number) => void }) {
	const [st, setSt] = useState<{ stops: number[]; at: number; name: string }>({ stops: [], at: 0, name: "" })
	useEffect(() => {
		if (!eng) return
		let raf = 0
		const up = () => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const v = eng.view()
				const l = Math.log(v.cam.s)
				let at = 0
				v.stops.forEach((s, k) => {
					if (Math.abs(Math.log(s) - l) < Math.abs(Math.log(v.stops[at]) - l)) at = k
				})
				// Fractional position between stops for the marker.
				let f = at
				const s0 = v.stops[at]
				const nb = l > Math.log(s0) ? at + 1 : at - 1
				if (v.stops[nb]) f = at + ((l - Math.log(s0)) / (Math.log(v.stops[nb]) - Math.log(s0))) * (nb - at)
				const name = v.focus?.name ?? ""
				setSt((p) => (p.stops.length === v.stops.length && Math.abs(p.at - f) < 0.02 && p.name === name ? p : { stops: v.stops, at: Math.max(0, f), name }))
			})
		}
		up()
		const off = eng.subscribe(up)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [eng])
	const n = Math.max(1, st.stops.length - 1)
	const label = (k: number) => (k === 0 ? "All islands" : k === 1 ? st.name || "Island" : k === 2 ? "First titles" : k === 3 ? "Closer titles" : "Closest")
	return (
		<div className="rx6-rail" aria-label="Zoom">
			<button type="button" aria-label="Zoom in" className="rx6-zb" onClick={() => eng?.stepZoom(1)}>
				<PlusIcon className="rx6-i-s" />
			</button>
			<div className="rx6-rail-track">
				<span className="rx6-rail-line" />
				<span className="rx6-rail-mark" style={{ "--k": Math.min(1, st.at / n) } as React.CSSProperties} />
				{st.stops.map((s, k) => (
					<button key={k} type="button" className={`rx6-rail-stop ${Math.round(st.at) === k ? "rx6-rail-on" : ""}`} style={{ "--k": k / n } as React.CSSProperties} onClick={() => onStop(s)} aria-label={`Zoom to ${label(k)}`}>
						<span className="rx6-rail-dot" />
						<span className="rx6-rail-t">{label(k)}</span>
					</button>
				))}
			</div>
			<button type="button" aria-label="Zoom out" className="rx6-zb" onClick={() => eng?.stepZoom(-1)}>
				<MinusIcon className="rx6-i-s" />
			</button>
		</div>
	)
}

/** The whole archipelago small, with the part on screen outlined. Tap to go there. */
export function Minimap6({ eng, world, onGo }: { eng: Engine | null; world: World; onGo: (x: number, y: number) => void }) {
	const cv = useRef<HTMLCanvasElement>(null)
	const [size, setSize] = useState({ w: 170, h: 100 })
	// Zoomed out the whole map is on screen, so the minimap only shows once you're in.
	const [on, setOn] = useState(false)
	useEffect(() => {
		const small = window.innerWidth < 640
		const s = Math.min((small ? 96 : 176) / world.w, (small ? 64 : 110) / world.h)
		setSize({ w: Math.round(world.w * s), h: Math.round(world.h * s) })
	}, [world])
	useEffect(() => {
		const c = cv.current
		if (!c || !eng) return
		const dpr = Math.min(2, window.devicePixelRatio || 1)
		c.width = size.w * dpr
		c.height = size.h * dpr
		const g = c.getContext("2d") as CanvasRenderingContext2D
		const s = size.w / world.w
		let raf = 0
		const draw = () => {
			raf = 0
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, size.w, size.h)
			const v = eng.view()
			setOn(v.cam.s > v.fit * 1.35)
			const isl = eng.islands()
			for (const i of isl) {
				const r = (i.cell.r ?? 100) * s
				const x = i.cell.cx * s
				const y = i.cell.cy * s
				const on = v.focus === i
				const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.6)
				gr.addColorStop(0, rgbCss(i.tint, on ? 0.95 : 0.7))
				gr.addColorStop(0.6, rgbCss(i.tint, on ? 0.5 : 0.28))
				gr.addColorStop(1, rgbCss(i.tint, 0))
				g.fillStyle = gr
				g.beginPath()
				g.arc(x, y, r * 1.6, 0, Math.PI * 2)
				g.fill()
			}
			const x = (v.cam.x - v.cam.w / 2 / v.cam.s) * s
			const y = (v.cam.y - v.cam.h / 2 / v.cam.s) * s
			const w = (v.cam.w / v.cam.s) * s
			const h = (v.cam.h / v.cam.s) * s
			if (w < size.w * 0.97 || h < size.h * 0.97) {
				g.strokeStyle = "rgba(255,255,255,.9)"
				g.lineWidth = 1.25
				g.beginPath()
				g.roundRect(x, y, Math.max(3, w), Math.max(3, h), 2)
				g.stroke()
			}
		}
		const kick = () => {
			if (!raf) raf = requestAnimationFrame(draw)
		}
		kick()
		const off = eng.subscribe(kick)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [world, size, eng])
	return (
		<button
			type="button"
			className={`rx6-mini ${on ? "" : "rx6-mini-off"}`}
			aria-hidden={!on}
			tabIndex={on ? 0 : -1}
			aria-label="Minimap: tap to go there"
			onClick={(e) => {
				const r = e.currentTarget.getBoundingClientRect()
				onGo(((e.clientX - r.left - 6) / (r.width - 12)) * world.w, ((e.clientY - r.top - 6) / (r.height - 12)) * world.h)
			}}
		>
			<canvas ref={cv} style={{ width: size.w, height: size.h, display: "block" }} />
		</button>
	)
}

/** The island in the middle, once you're in it. */
export function Where6({ isl }: { isl: Isl | null }) {
	if (!isl) return null
	return (
		<div className="rx6-where" aria-live="polite">
			<span className="rx6-dot" style={{ background: rgbCss(isl.tint), boxShadow: `0 0 12px ${rgbCss(isl.tint, 0.9)}` }} />
			<span className="rx6-where-n">{isl.name}</span>
			<span className="rx6-where-c">{isl.count.toLocaleString("en")} titles</span>
		</div>
	)
}

export function Toast6({ text }: { text: string | null }) {
	if (!text) return null
	return (
		<div role="status" className="rx6-toast">
			{text}
		</div>
	)
}

const CSS6 = `
.rx6-stage{--glass:rgba(10,14,26,.58);--glass-2:rgba(14,19,34,.82);--line:rgba(255,255,255,.1);--line-2:rgba(255,255,255,.18);--text:#eef2ff;--mute:rgba(222,229,255,.62);--gold:#fbbf24;
 position:relative;height:calc(100svh - 8rem);overflow:hidden;background:#050810;color:var(--text);outline:none;font-family:Gabarito,system-ui,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:none;user-select:none}
@media (min-width:1024px){.rx6-stage{height:calc(100vh - 4rem)}}
.rx6-gl,.rx6-2d{position:absolute;inset:0;width:100%;height:100%;display:block}
.rx6-2d{touch-action:none}
.rx6-noscroll{scrollbar-width:none}.rx6-noscroll::-webkit-scrollbar{display:none}
.rx6-i{width:1.15rem;height:1.15rem}.rx6-i-s{width:1rem;height:1rem}
.rx6-glassy{background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5)}
.rx6-stage button:focus-visible,.rx6-stage a:focus-visible{outline:2px solid #fff;outline-offset:2px}
/* ---- top */
.rx6-top{position:absolute;left:0;right:0;top:0;z-index:30;padding:14px 16px 28px;pointer-events:none;background:linear-gradient(to bottom,rgba(4,6,13,.78),rgba(4,6,13,.35) 60%,transparent)}
.rx6-top>*{pointer-events:auto}
@media (min-width:768px){.rx6-top{padding:18px 24px 36px}}
.rx6-top-row{display:flex;align-items:center;gap:14px;min-width:0}
.rx6-top-row2{margin-top:10px;gap:8px;overflow-x:auto;max-width:100%}
.rx6-brand{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1;color:#fff;flex:none;text-shadow:0 2px 24px rgba(120,160,255,.35)}
@media (max-width:767px){.rx6-brand{display:none}}
.rx6-seg{display:flex;gap:2px;padding:4px;border-radius:14px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);overflow-x:auto;min-width:0;max-width:100%}
.rx6-seg-b{flex:none;height:34px;padding:0 13px;border-radius:10px;font-weight:600;font-size:14px;color:var(--mute);white-space:nowrap;transition:background .2s,color .2s}
.rx6-seg-b:hover{color:#fff;background:rgba(255,255,255,.06)}
.rx6-seg-on,.rx6-seg-on:hover{color:#0b0f1c;background:#f4f6ff;box-shadow:0 4px 18px rgba(160,190,255,.3)}
.rx6-tog{flex:none;display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 13px 0 9px;border-radius:12px;font-size:13.5px;font-weight:600;color:var(--mute);background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);transition:all .2s}
.rx6-tog:hover{color:#fff;border-color:var(--line-2)}
.rx6-tog:disabled{opacity:.45}
.rx6-tog-on{color:#fff;border-color:rgba(251,191,36,.55);background:linear-gradient(180deg,rgba(251,191,36,.16),rgba(251,191,36,.06));box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.rx6-logos{display:flex}
.rx6-logos img{width:20px;height:20px;border-radius:6px;border:1.5px solid #0b0f1c;margin-left:-6px}
.rx6-logos img:first-child{margin-left:0}
.rx6-tick{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--line-2);position:relative}
.rx6-tog-on .rx6-tick{background:var(--gold);border-color:var(--gold)}
.rx6-tog-on .rx6-tick::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #0b0f1c;border-width:0 2px 2px 0;transform:rotate(45deg)}
.rx6-who{margin-top:8px;font-size:12px;color:rgba(222,229,255,.5)}
.rx6-who-a{text-decoration:underline;text-underline-offset:2px}.rx6-who-a:hover{color:#fff}
@media (max-width:767px){.rx6-who{display:none}}
/* ---- history */
.rx6-hist{position:relative;flex:none}
.rx6-crumbs{display:flex;align-items:center;gap:2px;height:36px;padding:0 3px;border-radius:12px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.rx6-back{display:flex;align-items:center;justify-content:center;width:30px;height:28px;border-radius:9px;color:#fff;flex:none}
.rx6-back:hover{background:rgba(255,255,255,.1)}.rx6-back:disabled{color:rgba(255,255,255,.25)}
.rx6-crumb{display:flex;align-items:center;gap:6px;height:28px;padding:0 9px 0 6px;border-radius:9px;font-size:13px;font-weight:600;color:var(--mute);min-width:0;max-width:11rem}
button.rx6-crumb:hover{background:rgba(255,255,255,.08);color:#fff}
.rx6-crumb-on{color:#fff;background:rgba(255,255,255,.1)}
.rx6-crumb-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rx6-crumb-img{width:15px;height:22px;border-radius:3px;object-fit:cover;flex:none}
.rx6-sep{color:rgba(255,255,255,.25);font-size:12px}
@media (max-width:767px){.rx6-crumbs>.rx6-crumb:not(.rx6-crumb-on),.rx6-crumbs>.rx6-sep{display:none}.rx6-crumb{max-width:8.5rem}}
.rx6-hist-btn{display:flex;align-items:center;gap:3px;height:28px;padding:0 7px;border-radius:9px;color:var(--mute);flex:none}
.rx6-hist-btn:hover{background:rgba(255,255,255,.1);color:#fff}
.rx6-hist-n{font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:6px;background:rgba(255,255,255,.1);display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.rx6-hist-menu{position:fixed;z-index:60;width:300px;max-width:calc(100vw - 32px);max-height:340px;overflow-y:auto;padding:6px;margin-top:6px;border-radius:14px;background:var(--glass-2);border:1px solid var(--line);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 24px 60px rgba(0,0,0,.6)}
.rx6-hist-item{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border-radius:9px;text-align:left;font-size:13.5px;font-weight:500;color:var(--text)}
.rx6-hist-item:hover{background:rgba(255,255,255,.07)}
.rx6-hist-cur{background:rgba(255,255,255,.06)}
.rx6-hist-img{width:22px;height:33px;border-radius:3px;object-fit:cover;flex:none}
.rx6-hist-kind{width:40px;flex:none;font-size:11px;color:var(--mute);text-align:center}
.rx6-hist-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rx6-hist-here{font-size:11px;color:var(--gold);flex:none}
/* ---- rail, minimap, where */
.rx6-rail{position:absolute;z-index:25;right:16px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;padding:5px;border-radius:16px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.rx6-zb{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:11px;color:#fff}
.rx6-zb:hover{background:rgba(255,255,255,.1)}
.rx6-rail-track{position:relative;width:34px;height:130px}
.rx6-rail-line{position:absolute;left:50%;top:8px;bottom:8px;width:1px;background:linear-gradient(to bottom,rgba(255,255,255,.35),rgba(255,255,255,.08))}
.rx6-rail-mark{position:absolute;left:50%;top:calc(8px + (1 - var(--k)) * (100% - 16px));width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:99px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.12),0 0 16px rgba(170,200,255,.9)}
.rx6-rail-stop{position:absolute;left:0;right:0;top:calc(8px + (1 - var(--k)) * (100% - 16px));height:18px;margin-top:-9px;display:flex;align-items:center;justify-content:center}
.rx6-rail-dot{width:5px;height:5px;border-radius:99px;background:rgba(255,255,255,.45)}
.rx6-rail-t{position:absolute;right:44px;white-space:nowrap;font-size:12.5px;font-weight:600;color:var(--mute);padding:4px 9px;border-radius:8px;background:var(--glass-2);border:1px solid var(--line);opacity:0;transform:translateX(4px);transition:opacity .18s,transform .18s;pointer-events:none;max-width:12rem;overflow:hidden;text-overflow:ellipsis}
.rx6-rail:hover .rx6-rail-t{opacity:1;transform:none}
.rx6-rail-on .rx6-rail-t{color:#fff}
@media (max-width:1023px){.rx6-rail{top:auto;bottom:86px;transform:none;right:12px}.rx6-rail-track{display:none}.rx6-rail-t{display:none}}
.rx6-mini{position:absolute;z-index:25;left:16px;bottom:16px;transition:opacity .35s,transform .35s;padding:6px;border-radius:14px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
@media (max-width:1023px){.rx6-mini{left:12px;bottom:86px;padding:4px;border-radius:10px}}
.rx6-where{position:absolute;z-index:24;left:50%;bottom:74px;transform:translateX(-50%);display:flex;align-items:center;gap:9px;height:36px;padding:0 14px;border-radius:12px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);white-space:nowrap;pointer-events:none;animation:rx6fade .3s ease both}
.rx6-where-n{font-weight:700;font-size:14px}
.rx6-where-c{font-size:12.5px;color:var(--mute)}
@media (max-width:1023px){.rx6-where{display:none}}
.rx6-dot{width:8px;height:8px;border-radius:99px;flex:none;display:inline-block}
.rx6-toast{position:absolute;left:50%;top:120px;z-index:70;transform:translateX(-50%);padding:9px 16px;border-radius:12px;background:#f4f6ff;color:#0b0f1c;font-size:13.5px;font-weight:700;box-shadow:0 20px 40px rgba(0,0,0,.45);pointer-events:none;animation:rx6pop .25s cubic-bezier(.2,.9,.3,1.2) both}
.rx6-hint{position:absolute;z-index:22;left:50%;bottom:78px;transform:translateX(-50%);font-size:13px;color:rgba(222,229,255,.7);pointer-events:none;white-space:nowrap;text-shadow:0 2px 12px #000;transition:opacity .6s}
@media (max-width:1023px){.rx6-hint{bottom:190px;font-size:12.5px;white-space:normal;text-align:center;width:calc(100% - 48px);max-width:24rem}}
.rx6-loading{position:absolute;left:50%;top:50%;z-index:40;transform:translate(-50%,-50%);padding:10px 16px;border-radius:12px;background:var(--glass-2);border:1px solid var(--line);font-weight:600;font-size:14px;pointer-events:none}
.rx6-mini-off{opacity:0;transform:translateY(8px);pointer-events:none}
@keyframes rx6fade{from{opacity:0}to{opacity:1}}
@keyframes rx6pop{from{opacity:0;transform:translate(-50%,6px) scale(.97)}to{opacity:1;transform:translate(-50%,0)}}
/* ---- cards */
.rx6-layer{position:absolute;inset:0;z-index:20;pointer-events:none}
.rx6-anchor{position:absolute;left:0;top:0;will-change:transform;pointer-events:auto}
.rx6-card{width:340px;border-radius:18px;overflow:hidden;background:rgba(9,12,23,.78);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08);color:var(--text);user-select:text;animation:rx6card .32s cubic-bezier(.2,.8,.2,1) both;transform-origin:var(--ox,0) 50%}
@keyframes rx6card{from{opacity:0;transform:scale(.94) translateY(6px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
.rx6-card-pinned{border-color:color-mix(in srgb,var(--isl) 55%,rgba(255,255,255,.2));box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 40px color-mix(in srgb,var(--isl) 22%,transparent),inset 0 1px 0 rgba(255,255,255,.1)}
.rx6-card-hero{position:relative;height:150px;background:color-mix(in srgb,var(--isl) 30%,#0b0f1c)}
.rx6-card-peek .rx6-card-hero{height:118px}
.rx6-card-bd{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 25%}
.rx6-card-veil{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(9,12,23,.1) 0%,rgba(9,12,23,.35) 45%,rgba(9,12,23,.96) 100%)}
.rx6-card-head{position:absolute;left:16px;right:16px;bottom:12px}
.rx6-card-where{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:rgba(255,255,255,.78);margin-bottom:4px}
.rx6-card-t{font-size:23px;font-weight:800;line-height:1.02;letter-spacing:-.015em;color:#fff;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rx6-card-meta{margin-top:4px;font-size:13px;color:rgba(230,235,255,.7)}
.rx6-card-tools{position:absolute;right:8px;top:8px}
.rx6-icon{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;color:#fff;background:rgba(0,0,0,.4);backdrop-filter:blur(8px)}
.rx6-icon:hover{background:rgba(0,0,0,.65)}
.rx6-card-body{padding:12px 16px 14px}
.rx6-card-row{display:flex;align-items:center;gap:10px}
.rx6-match{font-size:14px;color:var(--mute)}
.rx6-match b{font-size:20px;font-weight:800;margin-right:2px}
.rx6-card-svc{margin-left:auto}
.rx6-why{margin-top:10px;font-size:13.5px;line-height:1.45;color:rgba(230,235,255,.84);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rx6-why-wait{color:var(--mute)}
.rx6-people{color:var(--mute)}
.rx6-acts{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rx6-doors{margin-top:14px}
.rx6-doors-wait{height:58px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.07),rgba(255,255,255,.03));background-size:200% 100%;animation:rx6shine 1.2s linear infinite}
@keyframes rx6shine{to{background-position:-200% 0}}
.rx6-doors-h{font-size:12.5px;font-weight:600;color:var(--mute);margin-bottom:7px}
.rx6-doors-list{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rx6-door{display:flex;align-items:center;gap:8px;min-width:0;padding:5px 8px 5px 5px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);text-align:left;transition:border-color .2s,background .2s}
.rx6-door:hover{border-color:color-mix(in srgb,var(--door) 70%,transparent);background:color-mix(in srgb,var(--door) 14%,transparent)}
.rx6-door-img{width:26px;height:39px;border-radius:4px;object-fit:cover;flex:none;background:rgba(255,255,255,.06);box-shadow:0 0 0 1px color-mix(in srgb,var(--door) 60%,transparent)}
.rx6-door-txt{min-width:0;display:flex;flex-direction:column}
.rx6-door-to{font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rx6-door-t{font-size:11.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rx6-open{display:inline-block;margin-top:12px;font-size:12.5px;font-weight:600;color:var(--mute);text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(255,255,255,.25)}
.rx6-open:hover{color:#fff}
.rx6-peek-hint{margin-top:8px;font-size:12px;color:var(--mute)}
.rx6-card-sheet{position:absolute;left:10px;right:10px;bottom:86px;width:auto;max-height:50%;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;animation:rx6sheet .34s cubic-bezier(.2,.8,.2,1) both}
.rx6-card-sheet .rx6-card-hero{height:96px}
.rx6-card-sheet.rx6-card-peek{cursor:pointer}
.rx6-card-sheet.rx6-card-peek .rx6-card-hero{height:84px}
.rx6-card-sheet.rx6-card-peek .rx6-card-body{padding:10px 16px 12px}
.rx6-card-sheet .rx6-card-t{font-size:20px}
@keyframes rx6sheet{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.rx6-drawer{position:absolute;z-index:26;top:112px;right:66px;bottom:16px;width:360px;pointer-events:none;display:flex;flex-direction:column;justify-content:center}
.rx6-drawer .rx6-card{pointer-events:auto;width:100%}
.rx6-drawer-empty{pointer-events:none;padding:18px;border-radius:18px;border:1px dashed rgba(255,255,255,.14);color:var(--mute);font-size:13.5px;line-height:1.45;text-align:center;background:rgba(9,12,23,.35);backdrop-filter:blur(10px)}
.rx6-cap{position:absolute;left:0;top:0;will-change:transform;pointer-events:auto}
.rx6-cap-b{display:flex;align-items:center;gap:6px;max-width:170px;height:26px;padding:0 9px;border-radius:9px;background:rgba(9,12,23,.72);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-size:12px;font-weight:600;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:rx6fade .22s ease both}
.rx6-cap-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.rx6-cap-m{font-weight:800;flex:none}
@media (prefers-reduced-motion:reduce){.rx6-card,.rx6-card-sheet,.rx6-cap-b,.rx6-where,.rx6-toast{animation:none}}
`
export function Styles6() {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: the page's own static styles.
	return <style dangerouslySetInnerHTML={{ __html: CSS6 }} />
}
