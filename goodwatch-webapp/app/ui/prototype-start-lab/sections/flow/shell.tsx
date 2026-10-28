// PROTOTYPE (start page lab) · Round 17: the opening flow's shell: the old TV's boot screen (boot-overlay) over stage m
// as it is (JkStage + SpotlightCard + MoodButtonPicker, composed here, not forked), and the flow's steps on top:
// 0 "ask" (search or mood), 1 "pick" (tap three you loved), 2 "for you". Each variant (FlowSpec) decides when the card
// shows, where the search block sits, and how the room's light and camera follow the steps. The room's reveal is two
// layers drawn over it (`over`: a night layer at an opacity, a warm glow for the boot's hand-off) and a scale on the
// room's box (the camera), so only opacity and transform ever animate. Each visit starts fresh (its own flow state,
// cleared on load), and "Replay opening" plays it again.
import { ArrowPathIcon, ChevronLeftIcon } from "@heroicons/react/20/solid"
import { createContext, type CSSProperties, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { inertProps } from "../stage/ab-shared"
import { SpotlightCard } from "../stage/j"
import { type JkFlow, type JkView, JkStage, type Reg } from "../stage/jk-shared"
import { MoodButtonPicker } from "../stage/jl-picker"
import { BootOverlay, type Handoff } from "./boot-overlay"
import { BootStrip, type StripMode } from "./boot-strip"

const NIGHT = "#050a16"
/** The searchbar's event for Enter, its button, and the picker's Done (sections/searchbar/shared.tsx `JK_REVEAL`). */
const REVEAL = "start-lab:jk-reveal"

export type Step = 0 | 1 | 2
export type Phase = "boot" | "live"
/** What the shell reads from the stage's flow. */
export type Snap = { view: JkView; loved: number; moody: boolean }

export type FlowSpec = {
	key: string
	handoff: Handoff
	/** "always": today's page; "after": the card waits for the first search or mood; "swap": the card takes the search block's place (D). */
	card: "always" | "after" | "swap"
	/** C: the search block sits in the middle of the screen until the first search. */
	center?: boolean
	/**
	 * Round 18 (f-i): no full-screen boot. The boot plays in a strip in the header's place (boot-strip) while the page
	 * assembles under it from the first paint (CSS only: the room up from black, the search block centered as in C,
	 * its parts in a short stagger), then hands over to the real header this way. `handoff` and `boot*` are unused.
	 */
	strip?: StripMode
	/** The night over the room (0 lit, 1 black) and the camera's scale, during the boot and per step. */
	bootDim: number
	bootCam: number
	dim: (step: Step, s: Snap) => number
	cam: (step: Step, s: Snap) => number
}

type Ctx = {
	spec: FlowSpec
	step: Step
	phase: Phase
	dim: number
	/** D: how far the card moves up to sit where the search block was (px). */
	swapY: number
	setSnap: (s: Snap) => void
	fRef: { current: JkFlow | null }
}
const FlowCtx = createContext<Ctx | null>(null)
const useFlowCtx = () => {
	const c = useContext(FlowCtx)
	if (!c) throw new Error("outside the opening flow")
	return c
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** An element's top within `stop` from the offset chain, so transforms (the lift, the swap) don't count. */
function topIn(el: HTMLElement, stop: HTMLElement) {
	let y = 0
	let n: HTMLElement | null = el
	while (n && n !== stop) {
		y += n.offsetTop
		n = n.offsetParent as HTMLElement | null
	}
	return y
}

const CSS = `.fl-root section[aria-label="Find something to watch"] > div:first-of-type{transform:scale(var(--fl-cam,1));transform-origin:50% 52%;transition:transform 2.4s cubic-bezier(.22,.7,.2,1)}
.fl-dim{position:absolute;inset:0;pointer-events:none;background:${NIGHT};transition:opacity 1.4s ease-in-out}
.fl-warm{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 46% at 50% 48%,rgb(251 191 36/.34) 0,rgb(251 160 60/.14) 46%,rgb(251 160 60/0) 78%);transition:opacity 3.4s cubic-bezier(.3,0,.2,1)}
.fl-card{transition:opacity .55s ease-out,transform .7s cubic-bezier(.2,.8,.2,1)}
.fl-v-c .jk-top,.fl-v-d .jk-top{transition:transform .9s cubic-bezier(.2,.8,.2,1),opacity .45s ease-out}
.fl-v-c[data-lift][data-step="0"] .jk-top{transform:translateY(var(--fl-lift,0px))}
.fl-v-c:not([data-live]) .jk-top{transition:none}
.fl-v-d .jk-top{padding-top:64px}
@media (min-width:640px){.fl-v-d .jk-top{padding-top:100px}}
@media (min-width:1024px){.fl-v-d .jk-top{padding-top:calc(clamp(20px,3vh,48px) + 60px)}}
.fl-v-d:not([data-step="0"]) .jk-top{opacity:0}
.fl-v-d:not([data-step="0"]) .jk-top *{pointer-events:none!important}
@keyframes fl-q{from{opacity:0;transform:translateY(6px)}}
.fl-early{--fl-pad:12px}
@media (min-width:640px){.fl-early{--fl-pad:44px}}
@media (min-width:1024px){.fl-early{--fl-pad:clamp(20px,3vh,48px)}}
@media (min-width:1024px) and (max-height:820px){.fl-early{--fl-pad:20px}}
.fl-early .jk-top{transition:none}
.fl-early[data-step="0"] .jk-top{transform:translateY(calc(.46 * (100svh - 64px) - 50% - var(--fl-pad) / 2))}
.fl-early:not([data-step="0"]) .jk-top{transition:transform .9s cubic-bezier(.2,.8,.2,1)}
.fl-early[data-measure] .jk-top,.fl-early[data-measure] .jk-top>*{transform:none!important;translate:none!important}
@keyframes fl-in{from{opacity:0;translate:0 14px}}
@keyframes fl-fade{from{opacity:0}}
@keyframes fl-night{from{opacity:1}}
@keyframes fl-cam{from{transform:scale(calc(var(--fl-cam,1) * 1.05))}}
.fl-early .jk-top>div[aria-hidden]:first-child{animation:fl-fade .9s ease-out .05s both}
.fl-early .jk-top>h1{animation:fl-in .55s cubic-bezier(.2,.8,.2,1) .15s both}
.fl-early .jk-top>.jk-field-gap{animation:fl-in .55s cubic-bezier(.2,.8,.2,1) .27s both}
.fl-early .jk-top>.jk-gap{animation:fl-in .55s cubic-bezier(.2,.8,.2,1) .39s both}
.fl-early .fl-dim{animation:fl-night 1.3s cubic-bezier(.4,0,.2,1) both}
.fl-early section[aria-label="Find something to watch"]>div:first-of-type{animation:fl-cam 1.8s cubic-bezier(.22,.7,.2,1) both}
.fl-q{animation:fl-q .45s ease-out both}
@media (prefers-reduced-motion:reduce){.fl-root section > div:first-of-type,.fl-card,.fl-v-c .jk-top,.fl-early .jk-top,.fl-v-d .jk-top{transition:opacity .3s ease-out!important}.fl-dim{transition-duration:.4s}.fl-early .jk-top>*{animation:fl-fade .3s ease-out both!important}.fl-early section>div:first-of-type{animation:none!important}.fl-early .fl-dim{animation-duration:.5s}.fl-warm{transition-duration:.8s}.fl-q{animation:none}}`

/** The background layers over the room (JkStage's `over`): the night at the step's opacity, and the boot's glow handing over. */
function FlowBg() {
	const { dim, phase, spec } = useFlowCtx()
	return (
		<>
			<div aria-hidden className="fl-dim" style={{ opacity: dim }} />
			{spec.handoff === "glow" && !spec.strip ? <div aria-hidden className="fl-warm" style={{ opacity: phase === "boot" ? 1 : 0 }} /> : null}
		</>
	)
}

/** The card (stage m's SpotlightCard as it is), shown, hidden or moved per step, and the flow's snapshot for the shell. */
function FlowModule({ f, reg }: { f: JkFlow; reg: Reg }) {
	const { spec, step, setSnap, fRef, swapY } = useFlowCtx()
	fRef.current = f
	const moody = f.source.kind === "mood" || f.source.kind === "mix"
	useEffect(() => setSnap({ view: f.view, loved: f.loved.length, moody }), [f.view, f.loved.length, moody, setSnap])
	const hidden = spec.card !== "always" && step === 0
	const y = spec.card === "swap" ? -swapY : 0
	return (
		<div
			data-fl-card=""
			className="fl-card relative"
			{...inertProps(hidden)}
			style={{ opacity: hidden ? 0 : 1, transform: `translateY(${y + (hidden ? 28 : 0)}px)` }}
		>
			<SpotlightCard f={f} reg={reg} />
		</div>
	)
}

const QUESTIONS = ["What are you in the mood for?", "Which of these did you love?", "Here's what to watch"] as const

/** D: the step indicator over the one place the steps take turns in, with Back. */
function AskHeader({ top }: { top: number }) {
	const { step, fRef } = useFlowCtx()
	const back = () => {
		const f = fRef.current
		if (!f) return
		if (step === 2) f.backToResults()
		else if (step === 1) f.clear()
	}
	return (
		<div className="pointer-events-none absolute inset-x-0 z-50 px-4 sm:px-6" style={{ top }}>
			<div className="relative mx-auto flex h-12 max-w-[880px] items-center justify-center">
				{step > 0 ? (
					<button
						type="button"
						onClick={back}
						className="pointer-events-auto absolute left-0 inline-flex h-9 items-center gap-0.5 rounded-full bg-gray-900/90 pl-1.5 pr-3 text-sm font-semibold text-gray-200 ring-1 ring-white/12 outline-none can-hover:hover:bg-gray-800 can-hover:hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<ChevronLeftIcon className="h-5 w-5" aria-hidden />
						<span className="hidden sm:inline">Back</span>
					</button>
				) : null}
				<div className="flex flex-col items-center gap-1 text-center" aria-live="polite">
					<span className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 3`}>
						{[0, 1, 2].map((i) => (
							<span
								key={i}
								aria-hidden
								className={`block h-1.5 rounded-full transition-[background-color,width] duration-300 ${i === step ? "w-5 bg-amber-400" : i < step ? "w-1.5 bg-amber-400/70" : "w-1.5 bg-white/25"}`}
							/>
						))}
					</span>
					<p key={step} className="fl-q text-[15px] font-semibold leading-5 text-white [text-shadow:0_1px_10px_rgb(0_0_0/.9)] sm:text-base">
						{QUESTIONS[step]}
					</p>
				</div>
			</div>
		</div>
	)
}

/**
 * Whether the guest has asked (not just typed): the results are on show and the field isn't focused and the picker
 * panel is closed, or Enter / the button / Done fired. Stays true until the stage is back to its empty state.
 */
function useAsked(view: JkView) {
	const [asked, setAsked] = useState(false)
	useEffect(() => {
		if (view === "empty") {
			setAsked(false)
			return
		}
		if (asked) return
		const check = () => {
			const typing = document.activeElement?.matches?.("[data-jk-bar-input]")
			const open = document.querySelector("[data-jk-picker-open]")
			if (!typing && !open) setAsked(true)
		}
		check()
		const t = setInterval(check, 200)
		const on = () => setAsked(true)
		window.addEventListener(REVEAL, on)
		return () => {
			clearInterval(t)
			window.removeEventListener(REVEAL, on)
		}
	}, [view, asked])
	return asked
}

/**
 * Round 18: the strip openings center the search block from the first paint (CSS), but the stage measures its gap
 * (the room's placement) and its obstacles from on-screen boxes, and must see the block where it rests. While the
 * block is lifted, each time the stage may have measured (mount, its first observer round, its 400 ms timer, a
 * resize) the lift is switched off for one synchronous measuring pass: no frame is painted in between, and the step 0
 * lift has no transition, so nothing moves. Once the block has moved up for good, one more pass.
 */
function useUnliftedMeasures(root: { current: HTMLDivElement | null }, on: boolean, step: Step) {
	const lifted = on && step === 0
	useEffect(() => {
		const r = root.current
		if (!on || !r) return
		if (!lifted) {
			const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 950)
			return () => clearTimeout(t)
		}
		let busy = false
		const pass = () => {
			if (busy) return
			busy = true
			r.setAttribute("data-measure", "")
			window.dispatchEvent(new Event("resize"))
			r.removeAttribute("data-measure")
			busy = false
		}
		pass()
		let f2 = 0
		const f1 = requestAnimationFrame(() => {
			f2 = requestAnimationFrame(pass)
		})
		const ts = [setTimeout(pass, 450), setTimeout(pass, 1200)]
		// After the stage's own listeners (theirs were added first): a real resize is measured again, unlifted.
		window.addEventListener("resize", pass)
		const ro = new ResizeObserver(() => pass())
		const top = r.querySelector(".jk-top")
		const sec = r.querySelector("section")
		if (top) ro.observe(top)
		if (sec) ro.observe(sec)
		return () => {
			cancelAnimationFrame(f1)
			cancelAnimationFrame(f2)
			for (const t of ts) clearTimeout(t)
			window.removeEventListener("resize", pass)
			ro.disconnect()
		}
	}, [root, on, lifted])
}

function FlowRun({ spec, first, onReplay }: { spec: FlowSpec; first: boolean; onReplay: () => void }) {
	const k = `flow-${spec.key}`
	// Every visit starts from the first step: the stage's saved state goes before the stage reads it.
	useState(() => {
		if (typeof window !== "undefined") {
			try {
				sessionStorage.removeItem(`start-lab-stage-${k}`)
			} catch {}
		}
		return 0
	})
	const root = useRef<HTMLDivElement>(null)
	const fRef = useRef<JkFlow | null>(null)
	const [snap, setSnapState] = useState<Snap>({ view: "empty", loved: 0, moody: false })
	const setSnap = useCallback(
		(s: Snap) => setSnapState((p) => (p.view === s.view && p.loved === s.loved && p.moody === s.moody ? p : s)),
		[],
	)
	const asked = useAsked(snap.view)
	const step: Step = snap.view === "foryou" ? 2 : snap.view !== "empty" && asked ? 1 : 0
	const [phase, setPhase] = useState<Phase>("boot")
	const [overlay, setOverlay] = useState(true)
	const live = useCallback(() => setPhase("live"), [])
	const done = useCallback(() => setOverlay(false), [])

	// C's lift (search block to the middle) and D's swap (card up into the block's place), from the offset chain.
	const [lift, setLift] = useState<number | null>(null)
	const [swapY, setSwapY] = useState(0)
	const [headTop, setHeadTop] = useState(0)
	useIso(() => {
		const r = root.current
		const sec = r?.querySelector<HTMLElement>("section")
		const top = r?.querySelector<HTMLElement>(".jk-top")
		if (!r || !sec || !top) return
		const measure = () => {
			const pad = Number.parseFloat(getComputedStyle(top).paddingTop) || 0
			const y0 = topIn(top, sec)
			if (spec.center) {
				const room = window.innerHeight - 64 // the lab bar
				const h = top.offsetHeight - pad
				setLift(Math.max(0, Math.round(room * 0.46 - h / 2 - (y0 + pad))))
			}
			if (spec.card === "swap") {
				const card = r.querySelector<HTMLElement>("[data-fl-card]")
				if (card) setSwapY(Math.max(0, Math.round(topIn(card, sec) - (y0 + pad))))
				setHeadTop(Math.round(y0 + pad - 60))
			}
		}
		// C waits until the stage has measured its gap and obstacles (they read on-screen boxes, which the lift would move).
		const t = setTimeout(measure, spec.center ? 450 : 0)
		window.addEventListener("resize", measure)
		return () => {
			clearTimeout(t)
			window.removeEventListener("resize", measure)
		}
	}, [spec])
	// D: once the card sits in its new place, the stage measures its slots' obstacles again (a resize does it).
	useEffect(() => {
		if (spec.card !== "swap" || !swapY) return
		const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60)
		return () => clearTimeout(t)
	}, [spec.card, swapY])

	// D: the hidden search block is out of the keyboard's reach too.
	useEffect(() => {
		if (spec.card !== "swap") return
		const top = root.current?.querySelector<HTMLElement>(".jk-top")
		if (!top) return
		if (step > 0) top.setAttribute("inert", "")
		else top.removeAttribute("inert")
	}, [spec.card, step])

	// Round 18: a strip opening lights the room by the step from the first paint (its fade-up is CSS, .fl-early).
	const boot = phase === "boot" && !spec.strip
	const dim = boot ? spec.bootDim : spec.dim(step, snap)
	const cam = boot ? spec.bootCam : spec.cam(step, snap)
	useUnliftedMeasures(root, !!spec.strip, step)
	const ctx: Ctx = { spec, step, phase, dim, swapY, setSnap, fRef }
	return (
		<FlowCtx.Provider value={ctx}>
			<div
				ref={root}
				className={`fl-root relative fl-v-${spec.key}${spec.strip ? " fl-early" : ""}`}
				data-step={step}
				{...(lift !== null ? { "data-lift": "" } : {})}
				{...(phase === "live" ? { "data-live": "" } : {})}
				style={{ "--fl-cam": cam, "--fl-lift": `${lift ?? 0}px` } as CSSProperties}
			>
				{/* As HTML: React would escape the selectors' quotes and > in the server's text. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
				<JkStage
					k={k}
					placement="card"
					over={() => <FlowBg />}
					module={(f, reg) => <FlowModule f={f} reg={reg} />}
					picker={(f, reg) => <MoodButtonPicker f={f} reg={reg} />}
				/>
				{spec.card === "swap" ? <AskHeader top={headTop} /> : null}
				<button
					type="button"
					onClick={onReplay}
					title="Replay opening"
					aria-label="Replay opening"
					className="fixed right-2 top-[72px] z-[2147482000] flex h-8 w-8 items-center justify-center rounded-full bg-gray-950/70 text-gray-300 ring-1 ring-white/15 outline-none can-hover:hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ArrowPathIcon className="h-4 w-4" aria-hidden />
				</button>
			</div>
			{overlay && spec.strip ? (
				<BootStrip mode={spec.strip} first={first} root={root} onHandoff={live} onDone={done} />
			) : overlay ? (
				<BootOverlay mode={spec.handoff} first={first} root={root} onHandoff={live} onDone={done} />
			) : null}
		</FlowCtx.Provider>
	)
}

/** One opening flow: a run, replayed from the start by remounting it. */
export function OpeningFlow({ spec }: { spec: FlowSpec }) {
	const [run, setRun] = useState(0)
	const replay = useCallback(() => {
		window.scrollTo({ top: 0 })
		setRun((r) => r + 1)
	}, [])
	return <FlowRun key={run} spec={spec} first={run === 0} onReplay={replay} />
}
