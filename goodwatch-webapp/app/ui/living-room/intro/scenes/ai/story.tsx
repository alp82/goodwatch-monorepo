// One evening with The Penguin in three asks (pick → trust → done): each ask is typed big in the middle of the
// picture, then shrinks into the chat as the user's bubble, followed by the GoodWatch call and its answer card.
// Headline "Use with AI" on top; at the end it moves to the middle over a lone "Ask anything" composer. A flying ask
// measures where its bubble sits (layout offsets, so running transforms don't disturb it) and flies there exactly.
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
} from "react"
import { useFilmPhone } from "~/ui/living-room/intro/parts/film-phone"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { goodwatchScoreDisplay, scoreLabels } from "~/utils/ratings"
import { PENGUIN } from "./examples"
import {
	AppCall,
	Banner,
	Chips,
	GptWindow,
	Page,
	SourceRow,
	WatchButton,
	fromIntro,
} from "./gpt"
import { Typed, at, titleOf, typedEnd } from "./kit"
import "./story.css"

/** One ask's clock: typed big, flies into the chat, lands as the bubble, then the call, card and words. */
type AskBeat = ReturnType<typeof askBeat>
function askBeat(start: number, ask: string, per = 24, dfly = 460) {
	const typed = typedEnd(ask, start, per)
	const fly = typed + 260
	const land = fly + dfly
	return {
		ask,
		per,
		type: start,
		fly,
		dfly,
		land,
		call: land - 80,
		done: land + 400,
		card: land + 420,
		answer: land + 820,
	}
}

const PICK = askBeat(600, "what should i start tonight?")
const TRUST = askBeat(PICK.answer + 250, "is it actually good?")
const LOGGED = askBeat(TRUST.answer + 250, "ok watched ep 1. 8/10")
/** When the story's last answer has settled. */
export const STORY_END = LOGGED.answer + 250
const BEATS = [PICK, TRUST, LOGGED]
const MY_SCORE = 8

/** Where a flying ask lands: the bubble's text box, measured without transforms. */
function offsetIn(el: HTMLElement, root: HTMLElement) {
	let x = 0
	let y = 0
	let n: HTMLElement | null = el
	while (n && n !== root) {
		x += n.offsetLeft
		y += n.offsetTop
		n = n.offsetParent as HTMLElement | null
	}
	if (n !== root) return null
	return { x, y, w: el.offsetWidth, h: el.offsetHeight }
}

/** Points every [data-fly=id] at its [data-land=id]: --fx, --fy (px) and --fs (scale) for the fly keyframes. */
function useFlyTargets(ref: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		const root = ref.current
		if (!root) return
		const measure = () => {
			for (const el of root.querySelectorAll<HTMLElement>("[data-fly]")) {
				const id = el.dataset.fly
				const t = root.querySelector<HTMLElement>(`[data-land="${id}"]`)
				const a = offsetIn(el, root)
				const b = t ? offsetIn(t, root) : null
				if (!a || !b || !a.w) continue
				el.style.setProperty("--fx", `${b.x + b.w / 2 - (a.x + a.w / 2)}px`)
				el.style.setProperty("--fy", `${b.y + b.h / 2 - (a.y + a.h / 2)}px`)
				el.style.setProperty("--fs", `${b.w / a.w}`)
			}
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(root)
		document.fonts?.ready.then(measure)
		return () => ro.disconnect()
	}, [ref])
}

/** The chapter's root (black stage) that also aims the flying asks. */
export function StoryRoot({
	children,
	label,
}: { children: ReactNode; label: string }) {
	const ref = useRef<HTMLDivElement>(null)
	useFlyTargets(ref)
	return (
		<div ref={ref} className="intro-ai" role="img" aria-label={label}>
			{children}
		</div>
	)
}

/** An ask typed big in the middle, then shrinking into its bubble. */
function BigAsk({
	id,
	text,
	appear,
	fly,
	dfly,
	per,
	size,
}: {
	id: string
	text: string
	appear: number
	fly: number
	dfly: number
	/** Letter interval. */
	per: number
	/** Font size, e.g. "4.4cqw". */
	size: string
}) {
	return (
		<div className="intro-ai-mid" aria-hidden="true">
			<span className="intro-ai-ask-in" style={at(appear - 120, 140)}>
				<span
					className="intro-ai-ask"
					data-fly={id}
					style={{ ...at(fly, dfly), fontSize: size }}
				>
					<Typed text={text} start={appear} per={per} />
				</span>
			</span>
		</div>
	)
}

/** The dark veil behind a big ask: in at `from`, out at `to`. */
function Scrim({ from, to, dur }: { from: number; to: number; dur: number }) {
	return (
		<div className="intro-ai-layer intro-ai-fade" style={at(from, 220)}>
			<div
				className="intro-ai-layer intro-ai-out intro-ai-scrim"
				style={{ ...at(to, dur), opacity: 0.72 }}
			/>
		</div>
	)
}

/** The landing spot of an ask: an invisible bubble with the same text. */
function Ghost({ id, text }: { id: string; text: string }) {
	return (
		<p className="intro-ai-chat-user intro-ai-ghost">
			<span className="intro-ai-bubble-text" data-land={id}>
				{text}
			</span>
		</p>
	)
}

/** The pill composer, idle ("Ask anything"), pressing send at each `presses` time. */
function IdleComposer({
	presses = [],
	caretAt,
}: { presses?: number[]; caretAt?: number }) {
	return (
		<div className="intro-ai-chat-comp">
			<span className="intro-ai-chat-plus" aria-hidden="true">
				+
			</span>
			<span className="intro-ai-chat-field">
				<span className="intro-ai-chat-ph">
					{caretAt != null && (
						<i className="intro-ai-comp-caret" style={at(caretAt)} />
					)}
					Ask anything
				</span>
			</span>
			<span className="intro-ai-chat-mic" aria-hidden="true">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0M12 18v3"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
					/>
				</svg>
			</span>
			<span className="intro-ai-chat-send" aria-hidden="true">
				{presses.map((t) => (
					<span key={t} className="intro-ai-chat-press" style={at(t, 240)} />
				))}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M12 18V6m0 0-5 5m5-5 5 5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
		</div>
	)
}

/** "Use with AI" on top; at `fin` it moves to the middle and grows. */
export function Headline({ fin }: { fin: number }) {
	return (
		<h2
			className="intro-ai-head intro-ai-top intro-ai-to intro-ai-head-move"
			style={at(fin, 850)}
		>
			<span className="intro-ai-rise" style={at(100)}>
				Use with
			</span>{" "}
			<span className="intro-ai-rise intro-ai-amber" style={at(240)}>
				AI
			</span>
		</h2>
	)
}

/** The clean last frame: one composer under the headline, its caret blinking. */
export function Final({ fin }: { fin: number }) {
	return (
		<div className="intro-ai-end intro-ai-rise" style={at(fin + 300, 750)}>
			<IdleComposer caretAt={fin + 300} />
		</div>
	)
}

/** One story exchange: the bubble lands as its big ask arrives, then the call, the card, the words. */
function StoryExchange({
	b,
	tool,
	card,
	answer,
}: { b: AskBeat; tool: string; card: ReactNode; answer: ReactNode }) {
	return (
		<div className="intro-ai-chat-ex">
			<p
				className="intro-ai-chat-user intro-ai-fade"
				style={at(b.fly + b.dfly * 0.62, b.dfly * 0.38)}
			>
				<span className="intro-ai-bubble-text">{b.ask}</span>
			</p>
			<AppCall from={b.call} done={b.done} tool={tool} />
			{card}
			<p
				className="intro-ai-chat-answer intro-ai-rise"
				style={at(b.answer, 600)}
			>
				{answer}
			</p>
		</div>
	)
}

/** The three story asks, big, with their veils. Render above the window. */
export function StoryAsks() {
	const phone = useFilmPhone()
	return (
		<>
			{BEATS.map((b, i) => (
				<div key={b.ask}>
					<Scrim from={b.type - 160} to={b.fly} dur={b.dfly * 0.8} />
					<BigAsk
						id={`s${i}`}
						text={b.ask}
						appear={b.type}
						fly={b.fly}
						dfly={b.dfly}
						per={b.per}
						size={phone ? "6.4cqw" : "4.6cqw"}
					/>
				</div>
			))}
		</>
	)
}

/** The chat window with the story's thread; `wrapClass` and `wrapStyle` style an extra wrapper around it. */
export function StoryWindow({
	data,
	fin,
	wrapClass = "",
	wrapStyle,
}: {
	data: IntroData
	fin: number
	wrapClass?: string
	wrapStyle?: CSSProperties
}) {
	const peng = titleOf(data, "The Penguin")
	if (!peng) return null
	const penguin = fromIntro(peng, PENGUIN.match)
	const stream = PENGUIN.stream
	return (
		<div className="intro-ai-layer intro-ai-out" style={at(fin, 450)}>
			<div className={`intro-ai-layer ${wrapClass}`} style={wrapStyle}>
				<GptWindow
					className="intro-ai-chat-wide intro-ai-deal"
					style={at(0, 700)}
					composer={<IdleComposer presses={BEATS.map((b) => b.fly)} />}
				>
					<div className="intro-ai-chat-scroll" style={at(TRUST.fly)}>
						<div className="intro-ai-chat-scroll" style={at(LOGGED.fly)}>
							<Page i={0}>
								<StoryExchange
									b={PICK}
									tool="watch next"
									card={
										<Banner
											card={penguin}
											from={PICK.card}
											eyebrow="From your Wishlist · on your services"
										>
											<p className="intro-ai-meta">
												2024 · Show · {penguin.match}% taste match
											</p>
											<WatchButton
												logo={stream.logo}
												service={stream.service}
												from={PICK.card + 330}
											/>
										</Banner>
									}
									answer={
										<>
											Start <b>The Penguin</b>. It&apos;s on your Wishlist and
											on your HBO Max.
										</>
									}
								/>
							</Page>
							<Page i={1}>
								<StoryExchange
									b={TRUST}
									tool="title details, scores"
									card={
										<Banner
											card={penguin}
											from={TRUST.card}
											eyebrow="One score from all of them"
										>
											<SourceRow
												s={PENGUIN.sources}
												score={penguin.score}
												from={TRUST.card + 250}
											/>
										</Banner>
									}
									answer={
										<>
											Yes: 95% with critics, and{" "}
											<b>{goodwatchScoreDisplay(penguin.score)}</b> on
											GoodWatch.
										</>
									}
								/>
							</Page>
							<Page i={2}>
								<StoryExchange
									b={LOGGED}
									tool="log a watch, score"
									card={
										<Banner
											card={penguin}
											from={LOGGED.card}
											eyebrow="Logged · S1 E1 · After Hours"
										>
											<p className="intro-ai-meta">Sam's watch history</p>
											<Chips
												from={LOGGED.card + 380}
												items={[
													{
														lead: `★ ${MY_SCORE}`,
														text: scoreLabels[MY_SCORE],
													},
													{ text: "Up next: S1 E2" },
												]}
											/>
										</Banner>
									}
									answer={<>Logged with an 8. Episode 2 is up next.</>}
								/>
							</Page>
						</div>
					</div>
					<div className="intro-ai-layer intro-ai-ghosts">
						{BEATS.map((b, i) => (
							<div key={b.ask} className="intro-ai-layer">
								<div className="intro-ai-chat-ex">
									<Ghost id={`s${i}`} text={b.ask} />
								</div>
							</div>
						))}
					</div>
				</GptWindow>
			</div>
		</div>
	)
}
