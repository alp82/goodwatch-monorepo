// PROTOTYPE - throwaway (#545). What every variant shares: the row of talked-about titles, the vendor marks, the
// official embeds that mount after consent, one live player at a time, and the state panel. The variants differ in
// how and where they ask for consent, and in what the facade says.
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react"
import {
	type Post,
	TALKED_ABOUT,
	TMDB_IMAGE,
	type TalkedAbout,
	VENDORS,
	type Vendor,
} from "./data"

// ── Vendor marks (inline, so a facade loads nothing from the vendor) ─────────────────────────────────────────────

export function VendorMark({ vendor, className = "h-4 w-4" }: { vendor: Vendor; className?: string }) {
	if (vendor === "youtube")
		return (
			<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
				<path
					fill="#ff0033"
					d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
				/>
				<path fill="#fff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
			</svg>
		)
	if (vendor === "tiktok") {
		const d =
			"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
		return (
			<svg viewBox="-1 -1 26 26" className={className} aria-hidden="true">
				<path fill="#25f4ee" d={d} transform="translate(-0.8 -0.6)" />
				<path fill="#fe2c55" d={d} transform="translate(0.8 0.6)" />
				<path fill="#fff" d={d} />
			</svg>
		)
	}
	return (
		<svg viewBox="0 0 600 530" className={className} aria-hidden="true">
			<path
				fill="#1185fe"
				d="M135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.45-163.25-81.433-5.956-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"
			/>
		</svg>
	)
}

// ── The official embeds, mounted only after consent ──────────────────────────────────────────────────────────────

export const embedSrc = (post: Post, autoplay: boolean, frameId = "") => {
	if (post.vendor === "youtube")
		return `https://www.youtube-nocookie.com/embed/${post.videoId}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`
	if (post.vendor === "tiktok")
		return `https://www.tiktok.com/player/v1/${post.postId}?rel=0&description=1&music_info=1${autoplay ? "&autoplay=1" : ""}`
	return `https://embed.bsky.app/embed/${post.uri}?id=${frameId}&colorMode=dark`
}

/** The vendor's own player or widget, unmodified, nothing laid over it. */
export function LiveEmbed({ post, autoplay = true }: { post: Post; autoplay?: boolean }) {
	const frameId = useId().replace(/[^a-z0-9]/gi, "")
	const [height, setHeight] = useState(220)
	useEffect(() => {
		if (post.vendor !== "bluesky") return
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== "https://embed.bsky.app" || event.data?.id !== frameId) return
			if (event.data.height) setHeight(event.data.height)
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [post.vendor, frameId])

	const common = {
		src: embedSrc(post, autoplay, frameId),
		title: `${VENDORS[post.vendor].name}: ${post.label}`,
		referrerPolicy: "strict-origin-when-cross-origin" as const,
		className: "block h-full w-full border-0",
	}
	if (post.vendor === "bluesky")
		return (
			<div style={{ height }} className="w-full overflow-hidden rounded-xl bg-[#161e27]">
				<iframe {...common} scrolling="no" />
			</div>
		)
	return (
		<div className={`${post.vendor === "tiktok" ? "aspect-[9/16]" : "aspect-video"} w-full overflow-hidden rounded-xl bg-black`}>
			<iframe {...common} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
		</div>
	)
}

// ── One live player at a time ────────────────────────────────────────────────────────────────────────────────────

const PlayerContext = createContext<{ playing: string | null; setPlaying: (id: string | null) => void }>({
	playing: null,
	setPlaying: () => {},
})

export function PlayerProvider({ children }: { children: ReactNode }) {
	const [playing, setPlaying] = useState<string | null>(null)
	const value = useMemo(() => ({ playing, setPlaying }), [playing])
	return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

/** A video's live state. Starting one video puts the one playing before back behind its facade. */
export function usePlayer(id: string) {
	const { playing, setPlaying } = useContext(PlayerContext)
	return { live: playing === id, start: () => setPlaying(id), stop: () => setPlaying(null) }
}

// ── The facade's artwork: GoodWatch's own TMDB image, never the vendor's thumbnail ───────────────────────────────

export function Artwork({
	title,
	post,
	children,
	className = "",
}: { title: TalkedAbout; post: Post; children?: ReactNode; className?: string }) {
	const tall = post.vendor === "tiktok"
	return (
		<div
			className={`relative w-full overflow-hidden rounded-xl bg-neutral-800 ${tall ? "aspect-[9/16]" : "aspect-video"} ${className}`}
		>
			<img
				src={`${TMDB_IMAGE}/${tall ? "w342" : "w780"}${tall ? title.posterPath : title.backdropPath}`}
				alt=""
				loading="lazy"
				className="absolute inset-0 h-full w-full object-cover opacity-70"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
			<div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
				<VendorMark vendor={post.vendor} className="h-3.5 w-3.5" />
				{VENDORS[post.vendor].name}
			</div>
			{children}
		</div>
	)
}

/** The facade's own words about a post: who posted it and GoodWatch's label. */
export function PostCaption({ post }: { post: Post }) {
	return (
		<div className="min-w-0">
			<div className="truncate text-sm font-semibold text-white">{post.label}</div>
			<div className="truncate text-xs text-neutral-300">{post.author}</div>
		</div>
	)
}

// ── The host: a "Talked about now" row ───────────────────────────────────────────────────────────────────────────

export function TalkedAboutRow({
	header,
	renderPost,
	footer,
}: {
	header?: ReactNode
	renderPost: (post: Post, title: TalkedAbout) => ReactNode
	footer?: ReactNode
}) {
	return (
		<PlayerProvider>
			<section className="py-4">
				<div className="mb-3 flex items-baseline justify-between gap-4 px-4 sm:px-6">
					<h2 className="text-2xl font-bold text-white">Talked about now</h2>
					<span className="text-sm text-neutral-400">This week</span>
				</div>
				{header}
				<div className="flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:scroll-px-6 sm:px-6">
					{TALKED_ABOUT.map((title) => (
						<article key={title.tmdbId} className="w-[280px] shrink-0 snap-start sm:w-[320px]">
							<div className="mb-3 flex gap-3">
								<img
									src={`${TMDB_IMAGE}/w92${title.posterPath}`}
									alt=""
									className="h-[69px] w-[46px] shrink-0 rounded-md object-cover"
								/>
								<div className="min-w-0">
									<a
										href={`/${title.type}/${title.tmdbId}`}
										className="block truncate text-base font-semibold text-white hover:underline"
									>
										{title.title}
									</a>
									<p className="line-clamp-2 text-xs leading-snug text-neutral-400">{title.why}</p>
								</div>
							</div>
							<div className="flex flex-col gap-3">
								{title.posts.map((post) => (
									<div key={post.id} data-post={post.id}>
										{renderPost(post, title)}
									</div>
								))}
							</div>
						</article>
					))}
				</div>
				{footer}
			</section>
		</PlayerProvider>
	)
}

// ── Stored consent for the hand-built variants ───────────────────────────────────────────────────────────────────

// Each variant keeps its own key, so switching variants starts each from its own state.
const listeners = new Set<() => void>()
const emit = () => {
	for (const listener of listeners) listener()
}

export function readStored<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(key)
		return raw ? (JSON.parse(raw) as T) : null
	} catch {
		return null
	}
}

export function writeStored(key: string, value: unknown) {
	localStorage.setItem(key, JSON.stringify(value))
	emit()
}

export function useStored<T>(key: string, fallback: T): [T, (next: T) => void] {
	const raw = useSyncExternalStore(
		(listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		() => localStorage.getItem(key),
		() => null,
	)
	const value = useMemo(() => (raw ? (JSON.parse(raw) as T) : fallback), [raw])
	const set = useCallback((next: T) => writeStored(key, next), [key])
	return [value, set]
}

/** False on the server and in the first client render, so stored consent never causes a hydration mismatch. */
export function useHydrated() {
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	return hydrated
}

// ── The state panel: what is stored, and which outside hosts this page has contacted ─────────────────────────────

const FIRST_PARTY = ["image.tmdb.org"]
const EMBED_HOSTS = ["youtube-nocookie.com", "youtube.com", "ytimg.com", "googlevideo.com", "tiktok.com", "tiktokcdn.com", "bsky.app", "bsky.social"]

function useContactedHosts() {
	const [hosts, setHosts] = useState<string[]>([])
	useEffect(() => {
		const seen = new Set<string>()
		const add = (entries: PerformanceEntryList) => {
			let changed = false
			for (const entry of entries) {
				try {
					const host = new URL(entry.name).host
					if (host === location.host || seen.has(host)) continue
					seen.add(host)
					changed = true
				} catch {}
			}
			if (changed) setHosts([...seen])
		}
		add(performance.getEntriesByType("resource"))
		const observer = new PerformanceObserver((list) => add(list.getEntries()))
		observer.observe({ type: "resource", buffered: true })
		return () => observer.disconnect()
	}, [])
	return hosts
}

export function StatePanel({
	variant,
	question,
	cost,
	analytics,
	stored,
	onReset,
	actions,
}: {
	variant: string
	question: string
	cost: string
	analytics: string
	stored: unknown
	onReset: () => void
	actions?: ReactNode
}) {
	const hosts = useContactedHosts()
	const outside = hosts.filter((h) => !FIRST_PARTY.some((f) => h.endsWith(f)))
	const vendorHosts = outside.filter((h) => EMBED_HOSTS.some((f) => h.endsWith(f)))
	const otherHosts = outside.filter((h) => !vendorHosts.includes(h))
	return (
		<div className="mx-4 mt-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/20 p-3 text-xs text-neutral-300 sm:mx-6">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<span className="rounded bg-fuchsia-500 px-1.5 py-0.5 font-bold text-black">PROTOTYPE #545 · {variant}</span>
				<span className="hidden text-neutral-200 sm:inline">{question}</span>
			</div>
			<div className="mt-2 grid gap-2 sm:grid-cols-3">
				<div className="hidden sm:block">
					<div className="font-semibold text-neutral-100">Bundle cost</div>
					<div>{cost}</div>
				</div>
				<div className="hidden sm:block">
					<div className="font-semibold text-neutral-100">Analytics consent</div>
					<div>{analytics}</div>
				</div>
				<div>
					<div className="font-semibold text-neutral-100">Embed vendors this page contacted</div>
					<div className={`font-mono ${vendorHosts.length ? "text-amber-300" : "text-emerald-300"}`} data-testid="vendor-hosts">
						{vendorHosts.length ? vendorHosts.join(", ") : "none"}
					</div>
					{otherHosts.length > 0 && (
						<div className="mt-1 font-mono text-[11px] text-neutral-500">other: {otherHosts.join(", ")}</div>
					)}
				</div>
			</div>
			<div className="mt-2 flex flex-wrap items-start gap-2">
				<code className="min-w-0 flex-1 break-all rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-emerald-300">
					{JSON.stringify(stored)}
				</code>
				{actions}
				<button
					type="button"
					onClick={onReset}
					className="rounded bg-neutral-800 px-2 py-1 font-semibold text-neutral-100 ring-1 ring-neutral-600 hover:bg-neutral-700"
				>
					Reset &amp; reload
				</button>
			</div>
		</div>
	)
}
