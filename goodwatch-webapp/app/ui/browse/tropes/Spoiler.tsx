// How a trope write-up holds its spoilers back. A hidden run stays as the real words in the real line with their
// color taken away, so it keeps exactly their width, line breaks and the paragraph's height. Over it, a canvas draws
// drifting light specks, each placed by a seeded random walk per line fragment, so nothing tiles or repeats; on reveal
// they scatter and fade while the words come in. A shown run keeps a faint dotted underline and tint, and another
// click (or Enter) hides it again. The page switch shows or hides them all; a run can still be flipped on its own.
//
// The canvas draws only while the write-up is on screen; with reduced motion it draws still frames and changes
// without easing.
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
import { type Example, segments } from "~/domain/tropes/pages"

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const REVEAL_MS = 520

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
	transition: color ${REVEAL_MS}ms ${EASE}, background-color ${REVEAL_MS}ms ${EASE}, text-decoration-color ${REVEAL_MS}ms ${EASE};
}
.gw-sp:not([data-shown]) { color: transparent; user-select: none; background-color: rgb(140 150 175 / 0.07); }
.gw-sp:not([data-shown]):hover { background-color: rgb(140 150 175 / 0.15); }
.gw-sp[data-shown] {
	text-decoration-color: color-mix(in srgb, var(--tint) 60%, transparent);
	background-color: color-mix(in srgb, var(--tint) 9%, transparent);
}
.gw-sp[data-shown]:hover { background-color: color-mix(in srgb, var(--tint) 17%, transparent); }
.gw-sp:focus-visible { outline: 2px solid rgb(251 191 36); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) { .gw-sp { transition: none; } }
`

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

/** A write-up with its spoilers held back. A click on a hidden run flips it; the page switch flips them all. */
export function WriteUp({
	e,
	tint,
	className = "",
}: {
	e: Pick<Example, "text" | "spoilers">
	tint: string
	className?: string
}) {
	const { shown: all } = useContext(SpoilerContext)
	// Runs flipped against the page switch; the switch clears them.
	const [flip, setFlip] = useState<Set<number>>(() => new Set())
	useEffect(() => setFlip(new Set()), [all])
	const segs = segments(e)
	const has = segs.some((s) => s.spoiler)
	const p = useRef<HTMLParagraphElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)
	useSpecks(has, p, canvas)
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
					<span
						key={s.at}
						// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an inline run of text that acts as a button
						role="button"
						tabIndex={0}
						aria-pressed={shown}
						aria-label={shown ? undefined : "Spoiler. Press to show it."}
						title={shown ? "Spoiler. Click to hide it again." : undefined}
						data-spoil=""
						data-shown={shown ? "" : undefined}
						className="gw-sp"
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
			{has && (
				<canvas
					ref={canvas}
					aria-hidden
					className="pointer-events-none absolute top-0 left-0 block h-full w-full"
				/>
			)}
		</p>
	)
}

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
}

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

const easeOut = (t: number) => 1 - (1 - t) ** 3

function build(el: HTMLElement, frags: Frag[], seed: number): Run {
	const level = el.hasAttribute("data-shown") ? 0 : 1
	const specks = frags.map((f, i) => {
		const r = rng(seed * 131 + i * 7919 + Math.round(f.w))
		const n = Math.max(6, Math.min(1400, Math.round((f.w * f.h) / 9)))
		return Array.from({ length: n }, () => {
			const ang = r() * Math.PI * 2
			const sp = 3 + r() * 11
			return {
				x: r() * f.w,
				y: r() * f.h,
				vx: Math.cos(ang) * sp,
				vy: Math.sin(ang) * sp,
				s: r() < 0.18 ? 1.6 : r() < 0.55 ? 1.1 : 0.8,
				a: 0.35 + r() * 0.65,
				tw: 1.5 + r() * 3.5,
				ph: r() * Math.PI * 2,
			}
		})
	})
	return { el, frags, level, from: level, to: level, start: 0, specks }
}

/** Draws the specks over a write-up's hidden runs. */
function useSpecks(
	on: boolean,
	p: RefObject<HTMLParagraphElement | null>,
	canvas: RefObject<HTMLCanvasElement | null>,
) {
	useEffect(() => {
		const host = p.current
		const c = canvas.current
		if (!on || !host || !c) return
		const ctx = c.getContext("2d")
		if (!ctx) return
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
				const run = build(el, frags, i + 1 + (el.textContent?.length ?? 0) * 31)
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
					ctx.restore()
				})
			}
			return busy
		}

		const loop = (now: number) => {
			raf = 0
			const dt = Math.min(0.05, (now - last) / 1000)
			last = now
			const busy = paint(now, dt)
			if (visible && (!reduce || busy)) raf = requestAnimationFrame(loop)
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
	}, [on, p, canvas])
}

/** The page-level switch above the examples. Both labels share one cell, so it keeps one width when it flips. */
export function SpoilerSwitch({ tint }: { tint: string }) {
	const { shown, set } = useContext(SpoilerContext)
	return (
		<button
			type="button"
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA switch pattern on a styled button
			role="switch"
			aria-checked={shown}
			aria-label="Show spoilers"
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
