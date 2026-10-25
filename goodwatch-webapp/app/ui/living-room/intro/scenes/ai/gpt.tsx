// The chat window: a look-alike of ChatGPT's dark web chat (no logo, no wordmark image; captioned as an
// illustration), with the model name top left, grey rounded user bubbles on the right, assistant text without a
// bubble and the app-call line ChatGPT shows when an app runs. The answer cards copy the MCP Apps poster grid
// (server/mcp/poster-grid/widget.css): banner, score tab, logo plate.
import type { CSSProperties, ReactNode } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import type { IntroCard } from "~/ui/living-room/intro/data"
import { goodwatchScoreDisplay, goodwatchVibeIndex } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ChatCard, Sources } from "./examples"
import { Mark, at } from "./kit"
import "./gpt.css"

const img = (path: string | null | undefined, size = "w185") =>
	path ? tmdbImageUrl(path, size) : ""

export const fromIntro = (c: IntroCard, match?: number): ChatCard => ({
	title: c.title,
	year: c.release_year ?? 0,
	poster: c.poster_path ?? "",
	backdrop: c.backdrop_path ?? undefined,
	score: c.goodwatch_overall_score_normalized_percent ?? 0,
	match,
})

/** The cards' GoodWatch score tab: the G over the number, in the score's vibe colour. */
function ScoreTab({
	score,
	className = "",
	style,
}: { score: number; className?: string; style?: CSSProperties }) {
	return (
		<span
			className={`intro-ai-tab ${className}`}
			style={{
				backgroundColor: `var(--color-vibe-${goodwatchVibeIndex(score)})`,
				...style,
			}}
		>
			<GoodWatchG height="0.95em" />
			<span>{goodwatchScoreDisplay(score)}</span>
		</span>
	)
}

function Poster({
	card,
	className = "",
}: { card: ChatCard; className?: string }) {
	return (
		<span className={`intro-ai-poster ${className}`}>
			<img src={img(card.poster)} alt="" draggable={false} />
			<ScoreTab score={card.score} />
		</span>
	)
}

/** The look-alike chat window: header, the thread (children), the composer. */
export function GptWindow({
	className = "",
	style,
	children,
	composer,
}: {
	className?: string
	style?: CSSProperties
	children: ReactNode
	composer: ReactNode
}) {
	return (
		<div className={`intro-ai-chat ${className}`} style={style}>
			<div className="intro-ai-chat-bar">
				<span className="intro-ai-chat-model">
					ChatGPT <Chevron />
				</span>
				<span className="intro-ai-chat-note">Illustration</span>
			</div>
			<div className="intro-ai-chat-view">{children}</div>
			{composer}
		</div>
	)
}

function Chevron() {
	return (
		<svg viewBox="0 0 16 16" className="intro-ai-chat-chev" aria-hidden="true">
			<path
				d="M4 6l4 4 4-4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** ChatGPT's app-call line: the app's icon, "Calling GoodWatch…" pulsing, then "Called GoodWatch" and the tool. */
export function AppCall({
	from,
	done,
	tool,
}: { from: number; done: number; tool: string }) {
	return (
		<p className="intro-ai-chat-call intro-ai-fade" style={at(from, 220)}>
			<span className="intro-ai-chat-app" aria-hidden="true">
				<GoodWatchG height="0.8em" />
			</span>
			<span className="intro-ai-chat-callt">
				<span className="intro-ai-chat-run intro-ai-out" style={at(done, 120)}>
					<span className="intro-ai-chat-pulse">Calling GoodWatch…</span>
				</span>
				<span className="intro-ai-chat-did intro-ai-fade" style={at(done, 200)}>
					Called <b>GoodWatch</b>
					<span className="intro-ai-chat-tool"> · {tool}</span>
				</span>
			</span>
		</p>
	)
}

/** The widget's banner: backdrop, poster with its tab, eyebrow, name, then whatever the answer adds. */
export function Banner({
	card,
	from,
	eyebrow,
	children,
}: {
	card: ChatCard
	from: number
	eyebrow: ReactNode
	children?: ReactNode
}) {
	return (
		<div
			className="intro-ai-chat-card intro-ai-feat intro-ai-chat-ban intro-ai-deal"
			style={at(from, 650)}
		>
			<img
				className="intro-ai-feat-bd"
				src={img(card.backdrop, "w780")}
				alt=""
			/>
			<Mark className="intro-ai-chat-banmark" />
			<div className="intro-ai-chat-banin">
				<Poster card={card} className="intro-ai-chat-pf" />
				<div className="intro-ai-chat-tx">
					<p className="intro-ai-eyebrow">{eyebrow}</p>
					<p className="intro-ai-display intro-ai-chat-name">{card.title}</p>
					{children}
				</div>
			</div>
		</div>
	)
}

/** IMDb, Rotten Tomatoes and Metacritic, then the one GoodWatch number they make. */
export function SourceRow({
	s,
	score,
	from,
}: { s: Sources; score: number; from: number }) {
	const items = [
		{ logo: imdbLogo, n: `${s.imdb}`, wide: true },
		{ logo: rottenLogo, n: `${s.rt}%` },
		{ logo: metacriticLogo, n: `${s.mc}` },
	]
	return (
		<div className="intro-ai-chat-src">
			{items.map((x, i) => (
				<span
					key={x.logo}
					className="intro-ai-chat-chip intro-ai-pop"
					style={at(from + i * 130, 450)}
				>
					<img
						src={x.logo}
						alt=""
						className={x.wide ? "intro-ai-chat-logo-w" : "intro-ai-chat-logo"}
					/>
					{x.n}
				</span>
			))}
			<span
				className="intro-ai-chat-eq intro-ai-fade"
				style={at(from + 430, 250)}
			>
				→
			</span>
			<ScoreTab
				score={score}
				className="intro-ai-chat-bigtab intro-ai-pop"
				style={at(from + 520, 550)}
			/>
		</div>
	)
}

/** Pills under a banner's name (amber lead optional). */
export function Chips({
	items,
	from,
}: { items: { lead?: string; text: string }[]; from: number }) {
	return (
		<div className="intro-ai-pills intro-ai-chat-chips">
			{items.map((c, i) => (
				<span
					key={c.text}
					className="intro-ai-pill intro-ai-pop"
					style={at(from + i * 150, 450)}
				>
					{c.lead && <b>{c.lead}</b>}
					{c.text}
				</span>
			))}
		</div>
	)
}

/** The white Watch button with the service's logo. */
export function WatchButton({
	logo,
	service,
	from,
}: { logo: string; service: string; from: number }) {
	return (
		<span
			className="intro-ai-btn intro-ai-chat-btn intro-ai-pop"
			style={at(from, 450)}
		>
			<img src={img(logo, "w92")} alt="" />
			Watch on {service}
		</span>
	)
}

/** One view of the thread; page i sits i views down, the scroll wrappers above it bring it up. */
export function Page({ i, children }: { i: number; children: ReactNode }) {
	return (
		<div className="intro-ai-chat-page" style={{ "--i": i } as CSSProperties}>
			{children}
		</div>
	)
}
