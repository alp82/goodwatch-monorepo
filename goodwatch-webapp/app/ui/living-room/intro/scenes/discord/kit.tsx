// The Discord bot chapter's shared parts: Discord's look after ui/discord-bot/DiscordMock.tsx (whose cards follow
// app/server/discord/cards.ts), sized in em so a scene scales it with one font-size, and fed from the intro's titles.
import type { CSSProperties, ReactNode } from "react"
import { whiteMark } from "~/ui/brand/white-mark"
import type { IntroCard } from "~/ui/living-room/intro/data"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { goodwatchVibeIndex, scoreWord } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"

// ---------- timing ----------

/** One animation (discord.css `.intro-dc-a`): keyframes name, delay and duration in ms at k = 1. */
export function anim(
	an: string,
	d: number,
	du = 600,
	extra: Record<string, string | number> = {},
): { className: string; style: CSSProperties } {
	return {
		className: "intro-dc-a",
		style: {
			"--an": `intro-dc-${an}`,
			"--d": `${d}ms`,
			"--du": `${du}ms`,
			...extra,
		} as CSSProperties,
	}
}

/** An animation on an element that has its own class and style. */
export const withA = (
	a: ReturnType<typeof anim>,
	className = "",
	style: CSSProperties = {},
) => ({
	className: `${className} ${a.className}`,
	style: { ...style, ...a.style },
})

export const EASE_IN_OUT = "cubic-bezier(.65,0,.35,1)"

// ---------- data ----------

export type DcTitle = {
	name: string
	year: number | null
	score: number
	movie: boolean
	runtime: number | null
	poster: string
	backdrop: string | null
	service: { name: string; logo: string } | null
}

/** The modern shows the intro's data carries for this chapter, then the shared pool. */
const all = (data: IntroData): IntroCard[] => [
	...((data.extra.shows as IntroCard[] | undefined) ?? []),
	...data.pool,
]

/** Shorter service names, as the bot's provider emoji names them. */
const SERVICE_NAMES: Record<string, string> = {
	"Disney Plus": "Disney+",
	"Amazon Prime Video": "Prime Video",
}

/** The service a card shows: the first one of `prefer` the title has, else its first. */
function serviceOf(c: IntroCard, prefer: string[]) {
	const s =
		prefer
			.map((p) => (c.services ?? []).find((x) => x.name === p))
			.find(Boolean) ?? c.services?.[0]
	if (!s?.logo_path) return null
	return { name: SERVICE_NAMES[s.name] ?? s.name, logo: s.logo_path }
}

const toTitle = (c: IntroCard): DcTitle => ({
	name: c.title,
	year: c.release_year ?? null,
	score: Math.round(c.goodwatch_overall_score_normalized_percent ?? 0),
	movie: c.media_type === "movie",
	runtime: c.runtime ?? null,
	poster: c.poster_path ?? "",
	backdrop: c.backdrop_path ?? null,
	service: serviceOf(c, [
		"Netflix",
		"Disney Plus",
		"Amazon Prime Video",
		"HBO Max",
		"Hulu",
	]),
})

/** The named titles that exist in the intro's data (with a poster), in order; then others to fill `count`. */
export function pickTitles(
	data: IntroData,
	names: string[],
	count = names.length,
): DcTitle[] {
	const cards = all(data).filter((c) => c.poster_path)
	const named = names.flatMap((n) => cards.find((c) => c.title === n) ?? [])
	const rest = cards.filter((c) => !named.includes(c) && c.services?.length)
	return [...named, ...rest].slice(0, count).map(toTitle)
}

// ---------- Discord look ----------

const vibe = (score: number) => `var(--color-vibe-${goodwatchVibeIndex(score)})`
const runtime = (m: number) =>
	m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`

/** Example people. Discord's default avatar colours. */
export const PEOPLE = [
	{ name: "sam", color: "#3ba55d" },
	{ name: "Mia", color: "#eb459e" },
	{ name: "Leo", color: "#5865f2" },
]

export function UserAvatar({ name, color }: { name: string; color: string }) {
	return (
		<span
			aria-hidden="true"
			className="intro-dc-avatar"
			style={{ background: color }}
		>
			<b>{name[0].toUpperCase()}</b>
		</span>
	)
}

export function AppAvatar() {
	return (
		<span aria-hidden="true" className="intro-dc-avatar intro-dc-app">
			<img {...whiteMark()} alt="" />
		</span>
	)
}

/** "GoodWatch [APP] Today at 21:04" */
export function AppName() {
	return (
		<span className="intro-dc-msg-name">
			GoodWatch <span className="intro-dc-badge">APP</span>{" "}
			<small>Today at 21:04</small>
		</span>
	)
}

/** "sam used /watch": the line above an app's answer. */
export function Used({
	user,
	command,
	color,
}: { user: string; command: string; color: string }) {
	return (
		<span className="intro-dc-used">
			<span className="intro-dc-mini" style={{ background: color }}>
				{user[0].toUpperCase()}
			</span>
			<b>{user}</b> used <span className="cmd">{command}</span>
		</span>
	)
}

/** "■ 91 · Excellent  ·  2021  ·  TV show" (the bot's titleFacts, without genres, which the intro's data lacks). */
export function Facts({ t, short = false }: { t: DcTitle; short?: boolean }) {
	const parts = [
		t.year ? String(t.year) : null,
		short
			? null
			: t.movie
				? t.runtime
					? runtime(t.runtime)
					: null
				: "TV show",
	]
	return (
		<p className="intro-dc-facts">
			<span className="intro-dc-sq" style={{ background: vibe(t.score) }} />
			<b>
				{t.score} · {scoreWord(t.score)}
			</b>
			{parts.filter(Boolean).map((p) => `  ·  ${p}`)}
		</p>
	)
}

function ServiceLogo({ t }: { t: DcTitle }) {
	return t.service ? (
		<img src={tmdbImageUrl(t.service.logo, "w92")} alt="" />
	) : null
}

function ExternalIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.6}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
		</svg>
	)
}

/** A Discord button (a picture of one). */
export function Btn({
	kind = "secondary",
	link = false,
	icon,
	children,
	className = "",
	style,
}: {
	kind?: "secondary" | "primary"
	link?: boolean
	icon?: ReactNode
	children: ReactNode
	className?: string
	style?: CSSProperties
}) {
	return (
		<span
			className={`intro-dc-btn intro-dc-btn-${kind} ${className}`}
			style={style}
		>
			{icon}
			{children}
			{link && <ExternalIcon />}
		</span>
	)
}

/** The service button under "Where to watch". */
export function ServiceBtn({
	t,
	className,
	style,
}: { t: DcTitle; className?: string; style?: CSSProperties }) {
	if (!t.service) return null
	return (
		<Btn link icon={<ServiceLogo t={t} />} className={className} style={style}>
			{t.service.name}
		</Btn>
	)
}

export function poster(path: string, size = "w185") {
	return tmdbImageUrl(path, size)
}
export function backdrop(path: string, size = "w780") {
	return tmdbImageUrl(path, size)
}
