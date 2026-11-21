// PROTOTYPE - throwaway (prototype/explore-r11). How a trope write-up holds its spoilers back.
//
// Round 11 (the owner on round 10's specks: "pattern repeats way too often, looks very repetitive, show me a few
// alternatives"; "spoilers should still be faintly marked as such after revealing so that another click brings the
// spoiler state back"; "i like the specks + page switch idea"). Every style keeps a hidden run as the real words in
// the real line with their color taken away, so it holds exactly their width, line breaks and the paragraph's height.
// What covers them is the style:
// - "specks": a canvas of drifting light specks, each one placed by a seeded random walk per line fragment, so nothing
//   tiles or repeats; on reveal they scatter outward and fade while the words come in.
// - "frost": the words' own shapes, blurred to a soft glow (a text shadow over transparent text) with fine grain;
//   on reveal the blur sharpens into the words.
// - "scramble": the line filled with characters that keep changing, set in the text's own font; on reveal they fade
//   while the real words come in.
// - "ink": a bar of ink in the trope's color with ragged edges; on reveal it pulls back to the right.
// A shown run keeps a faint dotted underline and tint, and another click (or Enter) hides it again. The page switch
// (above the examples, with every style) shows or hides them all; a run can still be flipped on its own after it.
//
// Canvas styles draw one canvas per write-up, over the paragraph, only while it is on screen; with reduced motion
// they draw still frames and change without easing.
import {
	type CSSProperties,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	type RefObject,
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import type { Example } from "../tropes/model"

export interface SpoilerProps {
	e: Pick<Example, "text" | "spoilers">
	tint: string
	className?: string
}

export type SpoilLook = "specks" | "frost" | "scramble" | "ink"

type Seg = { text: string; spoiler: boolean; at: number }

/** The write-up as plain and spoiler runs, in order. */
export function segments(e: SpoilerProps["e"]): Seg[] {
	const out: Seg[] = []
	let at = 0
	for (const [from, end] of e.spoilers) {
		if (from > at) out.push({ text: e.text.slice(at, from), spoiler: false, at })
		out.push({ text: e.text.slice(from, end), spoiler: true, at: from })
		at = end
	}
	if (at < e.text.length) out.push({ text: e.text.slice(at), spoiler: false, at })
	return out
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const REVEAL_MS = 520
// Fine grain for "frost": fractal noise, stitched, so its tile never shows.
const GRAIN =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")"

const CSS = `
.gw-sp {
	border-radius: 3px;
	cursor: pointer;
	-webkit-box-decoration-break: clone;
	box-decoration-break: clone;
	text-decoration-line: underline;
	text-decoration-style: dotted;
	text-decoration-thickness: 1px;
	text-underline-offset: 3px;
	text-decoration-color: transparent;
	text-shadow: 0 0 0 transparent;
	transition: color ${REVEAL_MS}ms ${EASE}, text-shadow ${REVEAL_MS}ms ${EASE}, background-color ${REVEAL_MS}ms ${EASE}, text-decoration-color ${REVEAL_MS}ms ${EASE};
}
.gw-sp:not([data-shown]) { color: transparent; user-select: none; }
.gw-sp[data-shown] {
	text-decoration-color: color-mix(in srgb, var(--tint) 60%, transparent);
	background-color: color-mix(in srgb, var(--tint) 9%, transparent);
}
.gw-sp[data-shown]:hover { background-color: color-mix(in srgb, var(--tint) 17%, transparent); }
.gw-sp:focus-visible { outline: 2px solid rgb(251 191 36); outline-offset: 1px; }
.gw-sp-specks:not([data-shown]), .gw-sp-scramble:not([data-shown]) { background-color: rgb(140 150 175 / 0.07); }
.gw-sp-specks:not([data-shown]):hover, .gw-sp-scramble:not([data-shown]):hover { background-color: rgb(140 150 175 / 0.15); }
.gw-sp-frost:not([data-shown]) {
	text-shadow: 0 0 7px rgb(206 214 234 / 0.9);
	background-color: rgb(140 150 175 / 0.08);
	background-image: ${GRAIN};
	background-size: 160px 160px;
}
.gw-sp-frost:not([data-shown]):hover { text-shadow: 0 0 6px rgb(226 232 248 / 0.95); }
@media (prefers-reduced-motion: reduce) { .gw-sp { transition: none; } }
`

/** The spoiler rules; rendered once per write-up that has spoilers (duplicates are harmless). */
// Set as raw HTML: React escapes quotes in style text on the server but not in the browser, which fails hydration.
// oxlint-disable-next-line react/no-danger -- our own constant CSS, no user input
const Style = () => <style dangerouslySetInnerHTML={{ __html: CSS }} />

const SpoilerContext = createContext<{ shown: boolean; set: (v: boolean) => void }>({
	shown: false,
	set: () => {},
})

/** The page holds the switch's state; the write-ups and the switch read it. */
export function SpoilerScope({ children }: { children: ReactNode }) {
	const [shown, set] = useState(false)
	return <SpoilerContext.Provider value={{ shown, set }}>{children}</SpoilerContext.Provider>
}

/** A write-up in one spoiler style. A click on a run flips it; the page switch flips them all. */
export function Spoiled({ e, tint, className = "", look }: SpoilerProps & { look: SpoilLook }) {
	const { shown: all } = useContext(SpoilerContext)
	// Runs flipped against the page switch; the switch clears them.
	const [flip, setFlip] = useState<Set<number>>(() => new Set())
	useEffect(() => setFlip(new Set()), [all])
	const segs = segments(e)
	const has = segs.some((s) => s.spoiler)
	const p = useRef<HTMLParagraphElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)
	const drawn = look !== "frost" && has
	useSpoilCanvas(drawn ? look : null, tint, p, canvas)
	const toggle = (at: number) =>
		setFlip((f) => {
			const n = new Set(f)
			if (n.has(at)) n.delete(at)
			else n.add(at)
			return n
		})
	return (
		<p ref={p} className={`relative ${className}`}>
			{has && <Style />}
			{segs.map((s) => {
				if (!s.spoiler) return <span key={s.at}>{s.text}</span>
				const shown = all !== flip.has(s.at)
				return (
					// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an inline run of text that acts as a button
					<span
						key={s.at}
						role="button"
						tabIndex={0}
						aria-pressed={shown}
						aria-label={shown ? undefined : "Spoiler. Press to show it."}
						title={shown ? "Spoiler. Click to hide it again." : undefined}
						data-spoil=""
						data-shown={shown ? "" : undefined}
						className={`gw-sp gw-sp-${look}`}
						style={{ "--tint": tint } as CSSProperties}
						onClick={(ev: MouseEvent) => {
							ev.preventDefault()
							ev.stopPropagation()
							toggle(s.at)
						}}
						onKeyDown={(k: KeyboardEvent) => {
							if (k.key === "Enter" || k.key === " ") {
								k.preventDefault()
								toggle(s.at)
							}
						}}
					>
						<span aria-hidden={!shown}>{s.text}</span>
					</span>
				)
			})}
			{drawn && (
				<canvas
					ref={canvas}
					aria-hidden
					className="pointer-events-none absolute top-0 left-0 block h-full w-full"
				/>
			)}
		</p>
	)
}

// ---- The canvas styles -------------------------------------------------------------------------------------------

type Frag = { x: number; y: number; w: number; h: number }
type Speck = {
	x: number
	y: number
	vx: number
	vy: number
	s: number
	a: number
	tw: number
	ph: number
}
type Run = {
	el: HTMLElement
	frags: Frag[]
	level: number
	from: number
	to: number
	start: number
	specks: Speck[][]
	glyphs: { chars: string[]; next: Float32Array; font: string; size: number }[]
	edges: number[][]
}

const GLYPHS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ#%&*+=?@$<>/"

/** Seeded random numbers (mulberry32), so a run looks the same between frames and never like its neighbor. */
function rng(seed: number) {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const hexRgb = (hex: string): [number, number, number] => {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
	if (!m) return [148, 163, 184]
	const n = Number.parseInt(m[1], 16)
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

function build(look: SpoilLook, el: HTMLElement, frags: Frag[], seed: number): Run {
	const shown = el.hasAttribute("data-shown")
	const level = shown ? 0 : 1
	const run: Run = {
		el,
		frags,
		level,
		from: level,
		to: level,
		start: 0,
		specks: [],
		glyphs: [],
		edges: [],
	}
	frags.forEach((f, i) => {
		const r = rng(seed * 131 + i * 7919 + Math.round(f.w))
		if (look === "specks") {
			const n = Math.max(6, Math.min(1400, Math.round((f.w * f.h) / 9)))
			const list: Speck[] = []
			for (let k = 0; k < n; k++) {
				const ang = r() * Math.PI * 2
				const sp = 3 + r() * 11
				list.push({
					x: r() * f.w,
					y: r() * f.h,
					vx: Math.cos(ang) * sp,
					vy: Math.sin(ang) * sp,
					s: r() < 0.18 ? 1.6 : r() < 0.55 ? 1.1 : 0.8,
					a: 0.35 + r() * 0.65,
					tw: 1.5 + r() * 3.5,
					ph: r() * Math.PI * 2,
				})
			}
			run.specks.push(list)
		} else if (look === "scramble") {
			const cs = getComputedStyle(el)
			const size = Number.parseFloat(cs.fontSize) || 15
			const font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`
			const cols = Math.max(1, Math.floor(f.w / (size * 0.56)))
			const chars = Array.from({ length: cols }, () => GLYPHS[Math.floor(r() * GLYPHS.length)])
			const next = new Float32Array(cols).map(() => r() * 900)
			run.glyphs.push({ chars, next, font, size })
		} else if (look === "ink") {
			// Ragged top and bottom edges, a point every few pixels, fixed per run.
			const pts: number[] = []
			const step = 5
			for (let x = 0; x <= f.w; x += step) pts.push(x, (r() - 0.5) * 2.2)
			for (let x = f.w; x >= 0; x -= step) pts.push(x, f.h + (r() - 0.5) * 2.2)
			run.edges.push(pts)
		}
	})
	return run
}

/** Draws the canvas styles over a write-up's hidden runs. */
function useSpoilCanvas(
	look: SpoilLook | null,
	tint: string,
	p: RefObject<HTMLParagraphElement | null>,
	canvas: RefObject<HTMLCanvasElement | null>,
) {
	useEffect(() => {
		const host = p.current
		const c = canvas.current
		if (!look || !host || !c) return
		const ctx = c.getContext("2d")
		if (!ctx) return
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const [tr, tg, tb] = hexRgb(tint)
		// Ink: the trope's color pressed into the dark page.
		const ink = `rgb(${Math.round(tr * 0.45 + 16 * 0.55)} ${Math.round(tg * 0.45 + 20 * 0.55)} ${Math.round(tb * 0.45 + 31 * 0.55)})`
		let runs: Run[] = []
		let raf = 0
		let visible = false
		let last = performance.now()

		const measure = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1)
			const box = c.getBoundingClientRect()
			c.width = Math.max(1, Math.round(box.width * dpr))
			c.height = Math.max(1, Math.round(box.height * dpr))
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			const els = Array.from(host.querySelectorAll<HTMLElement>("[data-spoil]"))
			runs = els.map((el, i) => {
				const frags = Array.from(el.getClientRects())
					.filter((r) => r.width > 1)
					.map((r) => ({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }))
				const old = runs[i]
				const run = build(look, el, frags, i + 1 + (el.textContent?.length ?? 0) * 31)
				if (old)
					Object.assign(run, { level: old.level, from: old.from, to: old.to, start: old.start })
				return run
			})
		}

		const paint = (now: number, dt: number) => {
			ctx.clearRect(0, 0, c.width, c.height)
			let busy = false
			for (const run of runs) {
				const to = run.el.hasAttribute("data-shown") ? 0 : 1
				if (to !== run.to) {
					run.from = run.level
					run.to = to
					run.start = now
				}
				if (run.level !== run.to) {
					const t = reduce ? 1 : Math.min(1, (now - run.start) / REVEAL_MS)
					run.level = run.from + (run.to - run.from) * easeOut(t)
					if (t >= 1) run.level = run.to
					busy = true
				}
				const lv = run.level
				if (lv <= 0.001) continue
				run.frags.forEach((f, i) => {
					ctx.save()
					if (look === "specks") {
						ctx.beginPath()
						ctx.rect(f.x - 6, f.y - 6, f.w + 12, f.h + 12)
						ctx.clip()
						ctx.fillStyle = "rgb(234 238 252)"
						const scatter = (1 - lv) * 14
						for (const s of run.specks[i] ?? []) {
							if (!reduce) {
								s.x = (s.x + s.vx * dt + f.w) % f.w
								s.y = (s.y + s.vy * dt + f.h) % f.h
							}
							const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin((now / 1000) * s.tw + s.ph)
							ctx.globalAlpha = s.a * tw * lv
							const len = Math.hypot(s.vx, s.vy) || 1
							ctx.fillRect(
								f.x + s.x + (s.vx / len) * scatter,
								f.y + s.y + (s.vy / len) * scatter,
								s.s,
								s.s,
							)
						}
					} else if (look === "scramble") {
						const g = run.glyphs[i]
						if (g) {
							ctx.beginPath()
							ctx.rect(f.x, f.y, f.w, f.h)
							ctx.clip()
							ctx.font = g.font
							ctx.textBaseline = "alphabetic"
							ctx.fillStyle = `rgb(${Math.round(150 + tr * 0.35)} ${Math.round(160 + tg * 0.3)} ${Math.round(180 + tb * 0.25)})`
							ctx.globalAlpha = 0.6 * lv
							const cw = f.w / g.chars.length
							const base = f.y + (f.h + g.size * 0.68) / 2
							for (let k = 0; k < g.chars.length; k++) {
								if (!reduce) {
									g.next[k] -= dt * 1000
									if (g.next[k] <= 0) {
										g.chars[k] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
										g.next[k] = 120 + Math.random() * 900
									}
								}
								ctx.fillText(g.chars[k], f.x + k * cw, base)
							}
						}
					} else if (look === "ink") {
						const pts = run.edges[i]
						if (pts) {
							// On reveal the ink pulls back to the right.
							const cut = f.x + f.w * (1 - lv)
							ctx.beginPath()
							ctx.rect(cut, f.y - 4, f.w * lv + 4, f.h + 8)
							ctx.clip()
							ctx.globalAlpha = Math.min(1, 0.25 + lv)
							ctx.fillStyle = ink
							ctx.beginPath()
							ctx.moveTo(f.x + pts[0], f.y + pts[1])
							for (let k = 2; k < pts.length; k += 2) ctx.lineTo(f.x + pts[k], f.y + pts[k + 1])
							ctx.closePath()
							ctx.fill()
						}
					}
					ctx.restore()
				})
			}
			return busy
		}

		const animated = !reduce && (look === "specks" || look === "scramble")
		const loop = (now: number) => {
			raf = 0
			const dt = Math.min(0.05, (now - last) / 1000)
			last = now
			const busy = paint(now, dt)
			if (visible && (animated || busy)) raf = requestAnimationFrame(loop)
		}
		const kick = () => {
			if (!raf) {
				last = performance.now()
				raf = requestAnimationFrame(loop)
			}
		}

		measure()
		paint(performance.now(), 0)
		const io = new IntersectionObserver((entries) => {
			visible = entries.some((e) => e.isIntersecting)
			if (visible) kick()
		})
		io.observe(host)
		const ro = new ResizeObserver(() => {
			measure()
			kick()
		})
		ro.observe(host)
		// A run flipped (its data-shown changed): animate it.
		const mo = new MutationObserver(kick)
		mo.observe(host, { attributes: true, subtree: true, attributeFilter: ["data-shown"] })
		document.fonts?.ready.then(() => {
			measure()
			kick()
		})
		return () => {
			cancelAnimationFrame(raf)
			io.disconnect()
			ro.disconnect()
			mo.disconnect()
		}
	}, [look, tint, p, canvas])
}

/** The page-level switch, above the examples with every style. */
export function SpoilerSwitch({ tint }: { tint: string }) {
	const { shown, set } = useContext(SpoilerContext)
	return (
		<button
			type="button"
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA switch pattern on a styled button
			role="switch"
			aria-checked={shown}
			onClick={() => set(!shown)}
			className="inline-flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 text-sm font-semibold text-gray-200 ring-1 ring-white/10 transition-[background-color] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
			style={{ "--tint": tint } as CSSProperties}
		>
			<span
				aria-hidden
				className={`relative h-5 w-9 rounded-full transition-[background-color] duration-[320ms] ${shown ? "bg-[color-mix(in_oklab,var(--tint)_70%,#1b2232)]" : "bg-white/15"}`}
			>
				<span
					className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-[translate] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${shown ? "translate-x-4" : ""}`}
				/>
			</span>
			{/* Both words take the same cell, so the button keeps one width when it flips. */}
			<span className="grid">
				<span
					aria-hidden={!shown}
					className={`col-start-1 row-start-1 ${shown ? "" : "invisible"}`}
				>
					Spoilers shown
				</span>
				<span aria-hidden={shown} className={`col-start-1 row-start-1 ${shown ? "invisible" : ""}`}>
					Spoilers hidden
				</span>
			</span>
		</button>
	)
}
