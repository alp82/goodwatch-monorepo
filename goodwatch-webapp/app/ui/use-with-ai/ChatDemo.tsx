// What GoodWatch looks like inside an AI app, for /use-with-ai: a plain chat window (marked as an illustration, with
// no app's look), the poster cards the connector shows (titles from docs/implementation/mcp-poster-grid/fixtures.json)
// and the links every answer carries. Three questions switch the conversation.
import { CheckCircleIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useState } from "react"
import { CHAT_DEMO_QUESTIONS } from "~/ui/connector/example-prompts"

const DARK = {
	name: "Dark",
	year: 2017,
	kind: "Show",
	url: "/show/70523-dark",
	poster: "https://image.tmdb.org/t/p/w185/wSXJHO9WHLb0aCwvQrtco7vOmWA.jpg",
	backdrop: "https://image.tmdb.org/t/p/w780/3jDXL4Xvj3AzDOF6UH1xeyHW8MH.jpg",
	score: 85,
	match: 74,
	tagline: "Everything is connected.",
	episode: "S3 E7 · Between the Time",
	service: "Netflix",
	serviceLogo: "https://image.tmdb.org/t/p/w92/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
}

const WISHLIST = [
	{
		name: "Elling",
		year: 2001,
		url: "/movie/6007-elling",
		poster: "https://image.tmdb.org/t/p/w185/i4o9u93vR7setcwVeL87jGwc8CS.jpg",
		backdrop: "https://image.tmdb.org/t/p/w780/mGTTk3v32wEk8TDkxsfMnlqSb8H.jpg",
		score: 75,
		match: 95,
	},
	{
		name: "Magnolia",
		year: 1999,
		url: "/movie/334-magnolia",
		poster: "https://image.tmdb.org/t/p/w185/tpfC325Jk6S38VTe5dDWjWtoyxr.jpg",
		score: 81,
		match: 93,
	},
	{
		name: "Donnie Darko",
		year: 2001,
		url: "/movie/141-donnie-darko",
		poster: "https://image.tmdb.org/t/p/w185/j2AtZFsflxiluaNtajMTI0Avm8C.jpg",
		score: 80,
		match: 91,
	},
	{
		name: "Loki",
		year: 2021,
		url: "/show/84958-loki",
		poster: "https://image.tmdb.org/t/p/w185/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg",
		score: 80,
		match: 91,
	},
	{
		name: "K-PAX",
		year: 2001,
		url: "/movie/167-k-pax",
		poster: "https://image.tmdb.org/t/p/w185/tafXZX0I6rso7EyoEzfygfTqxq6.jpg",
		score: 59,
		match: 91,
	},
]

/** A plain app window: no maker's colors or logo, and always marked as an illustration. */
export function MockWindow({
	title,
	badge,
	children,
	className = "",
	tone = "dark",
}: {
	title: string
	badge?: ReactNode
	children: ReactNode
	className?: string
	tone?: "dark" | "light"
}) {
	const light = tone === "light"
	return (
		<figure
			className={`overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-1 ${light ? "bg-gray-100 text-gray-800 ring-black/10" : "bg-[#18181b] text-gray-200 ring-white/10"} ${className}`}
		>
			<div
				className={`flex items-center gap-2 border-b px-3 py-2 ${light ? "border-black/10 bg-gray-200/80" : "border-white/10 bg-white/[0.04]"}`}
			>
				<span aria-hidden="true" className="flex gap-1.5">
					<span
						className={`h-2.5 w-2.5 rounded-full ${light ? "bg-gray-400" : "bg-gray-600"}`}
					/>
					<span
						className={`h-2.5 w-2.5 rounded-full ${light ? "bg-gray-400" : "bg-gray-600"}`}
					/>
					<span
						className={`h-2.5 w-2.5 rounded-full ${light ? "bg-gray-400" : "bg-gray-600"}`}
					/>
				</span>
				{badge}
				<span
					className={`min-w-0 flex-1 truncate text-xs font-semibold ${light ? "text-gray-600" : "text-gray-400"}`}
				>
					{title}
				</span>
			</div>
			{children}
			<figcaption
				className={`border-t px-3 py-1 text-[10px] font-semibold tracking-wide uppercase ${light ? "border-black/10 text-gray-500" : "border-white/10 text-gray-500"}`}
			>
				Illustration, not the real app
			</figcaption>
		</figure>
	)
}

function ScoreBadge({
	score,
	size = "md",
}: { score: number; size?: "sm" | "md" }) {
	const tone = score >= 70 ? "bg-emerald-600" : "bg-amber-600"
	const dims = size === "sm" ? "h-9 w-8 text-[11px]" : "h-12 w-10 text-sm"
	return (
		<span
			className={`flex flex-col items-center justify-center rounded-b-lg rounded-t-2xl font-black leading-none text-white shadow ${tone} ${dims}`}
		>
			<span className="opacity-90">G</span>
			<span>{score}</span>
		</span>
	)
}

function Wordmark() {
	return (
		<span className="rounded-lg bg-black/50 px-2 py-1 text-sm font-black tracking-tight text-white">
			Good<span className="text-amber-400">Watch</span>
		</span>
	)
}

/** The tonight card: the next episode of a show you're watching, where it streams, and its scores. */
function TonightCard() {
	return (
		<div className="relative overflow-hidden rounded-xl bg-gray-950">
			<img
				src={DARK.backdrop}
				alt=""
				className="absolute inset-0 h-full w-full object-cover opacity-40"
			/>
			<div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
			<div className="relative flex gap-3 p-3 sm:gap-5 sm:p-5">
				<div className="relative w-20 shrink-0 sm:w-28">
					<img
						src={DARK.poster}
						alt="Dark poster"
						className="w-full rounded-lg ring-1 ring-white/20"
					/>
					<span className="absolute -top-1 right-1">
						<ScoreBadge score={DARK.score} size="sm" />
					</span>
				</div>
				<div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
					<p className="text-xs font-bold text-amber-300 sm:text-sm">
						Next episode · {DARK.episode}
					</p>
					<p className="text-3xl font-black tracking-tight text-white sm:text-4xl">
						{DARK.name}
					</p>
					<p className="hidden text-sm text-gray-200 sm:block">
						{DARK.tagline}
					</p>
					<p className="text-xs text-gray-400 sm:text-sm">
						{DARK.year} · {DARK.kind} · {DARK.match}% taste match
					</p>
					<div className="mt-2 flex flex-wrap gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-lg bg-white py-1 pr-3 pl-1 text-xs font-bold text-black sm:text-sm">
							<img src={DARK.serviceLogo} alt="" className="h-6 w-6 rounded" />▶
							Watch on {DARK.service}
						</span>
						<span className="inline-flex items-center rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-white sm:text-sm">
							Open in GoodWatch
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}

/** The library card: the best match on your Wishlist, then the rest in a row. */
function WishlistCard() {
	const [top, ...rest] = WISHLIST
	return (
		<div className="overflow-hidden rounded-xl bg-gray-950">
			<div className="relative">
				<img
					src={top.backdrop}
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-40"
				/>
				<div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/70 to-transparent" />
				<div className="relative flex items-center gap-3 p-3 sm:gap-5 sm:p-5">
					<div className="relative w-16 shrink-0 sm:w-24">
						<img
							src={top.poster}
							alt="Elling poster"
							className="w-full rounded-lg ring-1 ring-white/20"
						/>
						<span className="absolute -top-1 right-1">
							<ScoreBadge score={top.score} size="sm" />
						</span>
					</div>
					<div className="min-w-0">
						<p className="text-xs font-bold text-amber-300 sm:text-sm">
							Best match on your Wishlist
						</p>
						<p className="text-2xl font-black tracking-tight text-white sm:text-4xl">
							{top.name}
						</p>
						<p className="text-xs text-gray-400 sm:text-sm">
							{top.year} · Movie · {top.match}% taste match
						</p>
					</div>
					<div className="absolute top-3 right-3 hidden sm:block">
						<Wordmark />
					</div>
				</div>
			</div>
			<div className="flex gap-2 overflow-hidden p-3 pt-1 sm:gap-3">
				{rest.map((title) => (
					<div key={title.name} className="w-1/4 min-w-0 shrink-0">
						<div className="relative">
							<img
								src={title.poster}
								alt={`${title.name} poster`}
								className="aspect-[2/3] w-full rounded-md object-cover"
							/>
							<span className="absolute -top-1 right-1">
								<ScoreBadge score={title.score} size="sm" />
							</span>
						</div>
						<p className="mt-1 truncate text-xs font-semibold text-gray-200">
							{title.name}{" "}
							<span className="font-normal text-gray-500">({title.year})</span>
						</p>
					</div>
				))}
			</div>
		</div>
	)
}

function UserBubble({ children }: { children: ReactNode }) {
	return (
		<div className="flex justify-end">
			<p className="max-w-[85%] rounded-2xl rounded-br-md bg-gray-700/80 px-4 py-2 text-sm text-white sm:text-base">
				{children}
			</p>
		</div>
	)
}

function ToolLine({ children }: { children: ReactNode }) {
	return (
		<p className="flex items-center gap-1.5 text-xs text-gray-500">
			<CheckCircleIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
			{children}
		</p>
	)
}

const link =
	"font-semibold text-sky-300 underline decoration-sky-300/40 underline-offset-2"

const SCENES = [
	{
		key: "tonight",
		ask: CHAT_DEMO_QUESTIONS.tonight,
		answer: (
			<>
				<ToolLine>Used GoodWatch: what's next for you</ToolLine>
				<TonightCard />
				<p>
					You're two episodes from the end of{" "}
					<a href={DARK.url} className={link}>
						Dark (2017)
					</a>
					. Episode 7 is on Netflix.
				</p>
			</>
		),
	},
	{
		key: "wishlist",
		ask: CHAT_DEMO_QUESTIONS.wishlist,
		answer: (
			<>
				<ToolLine>Used GoodWatch: your Wishlist</ToolLine>
				<WishlistCard />
				<p>These fit you best:</p>
				<ul className="list-disc space-y-0.5 pl-5">
					{WISHLIST.slice(0, 3).map((title) => (
						<li key={title.name}>
							<a href={title.url} className={link}>
								{title.name} ({title.year})
							</a>{" "}
							<span className="text-gray-400">· {title.match}% match</span>
						</li>
					))}
				</ul>
			</>
		),
	},
	{
		key: "log",
		ask: CHAT_DEMO_QUESTIONS.log,
		answer: (
			<>
				<ToolLine>Used GoodWatch: log a watch</ToolLine>
				<div className="flex items-center gap-3 rounded-xl bg-emerald-950/40 p-3 ring-1 ring-emerald-800/60">
					<img src={DARK.poster} alt="" className="h-16 rounded" />
					<div>
						<p className="font-semibold text-white">Logged: Dark, S3 E7</p>
						<p className="text-sm text-gray-400">
							Up next: S3 E8, the last episode.
						</p>
					</div>
				</div>
				<p>
					Done. One more episode of{" "}
					<a href={DARK.url} className={link}>
						Dark (2017)
					</a>{" "}
					and you've finished the show. Want me to rate it afterwards?
				</p>
			</>
		),
	},
] as const

type SceneKey = (typeof SCENES)[number]["key"]

/** One question and its answer in a neutral chat window. */
function ChatScene({ scene }: { scene: SceneKey }) {
	const found = SCENES.find(({ key }) => key === scene) ?? SCENES[0]
	return (
		<div className="flex flex-col gap-3 p-4 sm:p-5" aria-live="polite">
			<UserBubble>{found.ask}</UserBubble>
			<div className="flex gap-3">
				<span
					aria-hidden="true"
					className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[10px] font-bold text-gray-200"
				>
					AI
				</span>
				<div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-relaxed text-gray-200 sm:text-base">
					{found.answer}
				</div>
			</div>
		</div>
	)
}

/** The chat window with a question picker under it. */
export function ChatDemo({ className = "" }: { className?: string }) {
	const [scene, setScene] = useState<SceneKey>("tonight")
	return (
		<div className={`flex flex-col gap-3 ${className}`}>
			<MockWindow title="Your AI app">
				<ChatScene scene={scene} />
				<div className="mx-4 mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-gray-500 sm:mx-5">
					Ask anything
				</div>
			</MockWindow>
			<fieldset className="flex flex-wrap justify-center gap-2">
				<legend className="sr-only">Pick a question</legend>
				{SCENES.map(({ key, ask }) => (
					<button
						key={key}
						type="button"
						aria-pressed={scene === key}
						onClick={() => setScene(key)}
						className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${scene === key ? "bg-amber-600 text-white" : "bg-white/[0.06] text-gray-300 ring-1 ring-white/10 hover:bg-white/10"}`}
					>
						{ask}
					</button>
				))}
			</fieldset>
		</div>
	)
}
