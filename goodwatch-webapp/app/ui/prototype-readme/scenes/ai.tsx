// PROTOTYPE (README clip "ai"): the intro's "Use with AI" evening with The Penguin, as a plain conversation and
// without its heading. One ChatGPT-style window fills the picture; each ask is typed into the composer and sent, its
// bubble lands, ChatGPT calls GoodWatch, the GoodWatch card deals in and the answer streams in word by word. The
// thread scrolls up as it grows. Then it rests on the finished chat; the recorder fades the tail into the empty
// first frame. Pieces and look come from the intro (scenes/ai/gpt.tsx, examples.ts).
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useRef,
} from "react"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { PENGUIN } from "~/ui/living-room/intro/scenes/ai/examples"
import {
	AppCall,
	Banner,
	Chips,
	GptWindow,
	SourceRow,
	WatchButton,
	fromIntro,
} from "~/ui/living-room/intro/scenes/ai/gpt"
import { Typed, at, titleOf, typedEnd } from "~/ui/living-room/intro/scenes/ai/kit"
import { goodwatchScoreDisplay, scoreLabels } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import "./ai.css"

/** An answer: words, the bold ones marked with `*`. */
type Answer = string

const PER = 38
const WORD = 60
/** One exchange's clock (ms at k = 1): typed, sent, bubble, the call, the card, the answer streaming in. */
function beat(start: number, ask: string, answer: Answer) {
	const typed = typedEnd(ask, start, PER)
	const send = typed + 380
	const bubble = send + 60
	const call = bubble + 380
	const done = call + 700
	const card = done + 60
	const words = answer.split(" ").length
	const say = card + 520
	return { ask, answer, start, send, bubble, call, done, card, say, end: say + words * WORD }
}
type Beat = ReturnType<typeof beat>

const A1 = "Start *The* *Penguin.* It's on your Wishlist and on your HBO Max."
const PICK = beat(450, "what should i start tonight?", A1)
/** The score word is filled in from the data; the timing only needs the word count. */
const TRUST = beat(PICK.end + 500, "is it actually good?", "Yes: 95% with critics, and *{score}* on GoodWatch.")
const LOGGED = beat(TRUST.end + 500, "ok watched ep 1. 8/10", "Logged with an 8. Episode 2 is up next.")
const BEATS = [PICK, TRUST, LOGGED]
/** The last word lands at LOGGED.end; then the finished chat rests. The recorder fades the last 600 ms into frame 0. */
export const AI_MS = Math.ceil((LOGGED.end + 3300) / 100) * 100
const MY_SCORE = 8

/** Words that fade in one after another, as an answer streams. */
function Stream({ text, from }: { text: string; from: number }) {
	return (
		<p className="intro-ai-chat-answer">
			{text.split(" ").map((w, i) => {
				const bold = w.startsWith("*")
				const word = w.replace(/\*/g, "")
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: words of a fixed string
					<span key={i}>
						<span className="intro-ai-fade rm-ai-word" style={at(from + i * WORD, 220)}>
							{bold ? <b>{word}</b> : word}
						</span>{" "}
					</span>
				)
			})}
		</p>
	)
}

/** A small card in the poster-grid look: a poster thumb, an eyebrow and a line of things. */
function Strip({ poster, eyebrow, from, children }: { poster: string; eyebrow: ReactNode; from: number; children: ReactNode }) {
	return (
		<div className="intro-ai-feat rm-ai-strip intro-ai-deal" style={at(from, 650)}>
			<img className="rm-ai-thumb" src={tmdbImageUrl(poster, "w185")} alt="" />
			<div className="rm-ai-strip-tx">
				<p className="intro-ai-eyebrow">{eyebrow}</p>
				{children}
			</div>
		</div>
	)
}

/** Scroll wrappers, one per reveal: each moves the thread up by what its element needs to show (measured). */
function useScroll(view: RefObject<HTMLDivElement | null>, thread: RefObject<HTMLDivElement | null>) {
	useLayoutEffect(() => {
		const v = view.current
		const t = thread.current
		if (!v || !t) return
		const measure = () => {
			const viewH = v.clientHeight
			const pad = viewH * 0.04
			let shown = 0
			for (const w of v.querySelectorAll<HTMLElement>("[data-scroll]")) {
				const el = t.querySelector<HTMLElement>(`[data-reveal="${w.dataset.scroll}"]`)
				if (!el) continue
				const bottom = el.offsetTop + el.offsetHeight
				const need = Math.max(shown, bottom - viewH + pad)
				w.style.setProperty("--dy", `${-(need - shown)}px`)
				shown = need
			}
		}
		measure()
		document.fonts?.ready.then(measure)
		const ro = new ResizeObserver(measure)
		ro.observe(t)
		return () => ro.disconnect()
	}, [view, thread])
}

function Exchange({ b, tool, card, id }: { b: Beat; tool: string; card: ReactNode; id: number }) {
	return (
		<>
			<p className="intro-ai-chat-user intro-ai-rise" data-reveal={`${id}-bubble`} style={at(b.bubble, 450)}>
				<span className="intro-ai-bubble-text">{b.ask}</span>
			</p>
			<div data-reveal={`${id}-call`}>
				<AppCall from={b.call} done={b.done} tool={tool} />
			</div>
			<div data-reveal={`${id}-card`}>{card}</div>
			{b.answer && (
				<div data-reveal={`${id}-say`}>
					<Stream text={b.answer} from={b.say} />
				</div>
			)}
		</>
	)
}

/** The composer: "Ask anything" between asks; each ask types in, then the send button is pressed and it clears. */
function Composer() {
	const placeholder = BEATS.reduceRight<ReactNode>(
		(inner, b) => (
			<span
				key={b.start}
				className="rm-ai-gap"
				style={
					{
						"--d": `${b.start - 60}ms`,
						"--dur": `${b.send + 200 - (b.start - 60)}ms`,
					} as CSSProperties
				}
			>
				{inner}
			</span>
		),
		<span className="intro-ai-chat-ph">Ask anything</span>,
	)
	return (
		<div className="intro-ai-chat-comp">
			<span className="intro-ai-chat-plus" aria-hidden="true">
				+
			</span>
			<span className="intro-ai-chat-field">
				<span className="rm-ai-field-layer">{placeholder}</span>
				{BEATS.map((b) => (
					<span key={b.start} className="rm-ai-field-layer intro-ai-out" style={at(b.send, 120)}>
						<span className="rm-ai-typed">
							<Typed text={b.ask} start={b.start} per={PER} />
						</span>
					</span>
				))}
			</span>
			<span className="intro-ai-chat-send" aria-hidden="true">
				{BEATS.map((b) => (
					<span key={b.send} className="intro-ai-chat-press" style={at(b.send - 80, 260)} />
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

export function ReadmeAi({ data }: SceneProps) {
	const view = useRef<HTMLDivElement>(null)
	const thread = useRef<HTMLDivElement>(null)
	useScroll(view, thread)
	const peng = titleOf(data, "The Penguin")
	if (!peng) return null
	const penguin = fromIntro(peng, PENGUIN.match)
	const stream = PENGUIN.stream
	const reveals = BEATS.flatMap((b, i) => [
		{ id: `${i}-bubble`, t: b.bubble },
		{ id: `${i}-call`, t: b.call },
		{ id: `${i}-card`, t: b.card },
		...(b.answer ? [{ id: `${i}-say`, t: b.say }] : []),
	])
	const rows = (
		<div ref={thread} className="rm-ai-thread">
			<Exchange
				id={0}
				b={PICK}
				tool="watch next"
				card={
					<Banner card={penguin} from={PICK.card} eyebrow="From your Wishlist · on your services">
						<p className="intro-ai-meta">2024 · Show · {penguin.match}% taste match</p>
						<WatchButton logo={stream.logo} service={stream.service} from={PICK.card + 330} />
					</Banner>
				}
			/>
			<Exchange
				id={1}
				b={{ ...TRUST, answer: TRUST.answer.replace("{score}", String(goodwatchScoreDisplay(penguin.score))) }}
				tool="title details, scores"
				card={
					<Strip poster={penguin.poster} eyebrow="The Penguin · one score from all of them" from={TRUST.card}>
						<SourceRow s={PENGUIN.sources} score={penguin.score} from={TRUST.card + 250} />
					</Strip>
				}
			/>
			<Exchange
				id={2}
				b={LOGGED}
				tool="log a watch, score"
				card={
					<Strip poster={penguin.poster} eyebrow="Logged · The Penguin · S1 E1" from={LOGGED.card}>
						<Chips
							from={LOGGED.card + 300}
							items={[{ lead: `★ ${MY_SCORE}`, text: scoreLabels[MY_SCORE] }, { text: "Up next: S1 E2" }]}
						/>
					</Strip>
				}
			/>
		</div>
	)
	// Nest the scroll wrappers, the first reveal outermost.
	const scrolled = reveals.reduceRight<ReactNode>(
		(inner, r) => (
			<div key={r.id} data-scroll={r.id} className="rm-ai-scroll" style={at(r.t - 60, 560)}>
				{inner}
			</div>
		),
		rows,
	)
	return (
		<div
			className="intro-ai rm-ai"
			role="img"
			aria-label="A ChatGPT-style chat using GoodWatch: what should I start tonight? GoodWatch picks The Penguin from the Wishlist on HBO Max; is it actually good? 95% with critics and its GoodWatch score; ok watched ep 1, 8/10: logged, episode 2 is up next."
		>
			<GptWindow className="rm-ai-win" composer={<Composer />}>
				<div ref={view} className="rm-ai-view">
					{scrolled}
				</div>
				<div className="rm-ai-topfade" />
			</GptWindow>
		</div>
	)
}
