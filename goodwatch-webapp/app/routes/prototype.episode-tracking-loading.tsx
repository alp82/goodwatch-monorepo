// THROWAWAY: compare episode loading on the actual details page, using live catalog data and real components.
// /prototype/episode-tracking-loading?show=1396&variant=A|B&history=seen|fresh
// Only demo member state and the completion of loading are simulated; writes never reach a server.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import {
	QueryClient,
	QueryClientProvider,
	useQueryClient,
} from "@tanstack/react-query"
import type { User } from "@supabase/auth-js"
import {
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { getDetailsForShow } from "~/server/details.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { getShowTrackingPage } from "~/server/show-tracking.server"
import { packEpisodeGrid, unpackEpisodeGrid } from "~/utils/episode-grid-wire"
import { AuthContext } from "~/utils/auth"
import { LocaleContext } from "~/utils/locale"
import Details from "~/ui/details/Details"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import EpisodeList from "~/ui/tracking/EpisodeList"
import { getShowStore, queryKeyShowTracking } from "~/ui/tracking/store"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import type { ShowTrackingPage } from "~/domain/tracking/show-page"
import { serverShow, utcDay } from "~/domain/tracking/machine"
import { applyShowEvent } from "~/domain/tracking/storage"
import { watchStateEntryOf } from "~/domain/tracking/show-page"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"

const EMPTY_MEMBER = {
	scores: {},
	wishlist: {},
	watchState: {},
	favorites: {},
	skipped: {},
	notInterested: {},
}

const AUTO_MS = 4000
const REVEAL_MS = 320

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const showId = /^\d+$/.test(params.get("show") ?? "")
		? params.get("show")!
		: "1396"
	const [media, grid, tracking] = await Promise.all([
		getDetailsForShow({ showId, country: "DE", language: "en" }),
		getEpisodeGrid({ showId }),
		getShowTrackingPage(
			"00000000-0000-4000-8000-000000000000",
			Number(showId),
			undefined,
			"en",
		),
	])
	const previewTracking: ShowTrackingPage = {
		...tracking,
		state: null,
		log: [],
	}
	if (params.get("history") !== "fresh") {
		const now = Date.now()
		const event = { type: "pressSeen" as const, today: utcDay(now) }
		const watched = applyShowEvent({
			showId: Number(showId),
			show: serverShow(tracking.episodes, event, utcDay(now)),
			state: null,
			log: [],
			flags: { score: null, wantToSee: false, notInterested: false },
			event,
			actionId: "preview-seen-only-in-memory",
			now,
		})
		previewTracking.state = watched.changes.state
		previewTracking.log = watched.changes.insert
	}
	return json(
		{
			media,
			grid: grid && packEpisodeGrid(grid),
			tracking: previewTracking,
		},
		{
			headers: {
				"Cache-Control": "private, no-store",
				"X-Robots-Tag": "noindex, nofollow",
			},
		},
	)
}

export const meta = () => [
	{ title: "Episode loading comparison | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const shouldRevalidate = ({
	currentUrl,
	nextUrl,
}: { currentUrl: URL; nextUrl: URL }) =>
	currentUrl.searchParams.get("show") !== nextUrl.searchParams.get("show") ||
	currentUrl.searchParams.get("history") !== nextUrl.searchParams.get("history")

type Data = ReturnType<typeof useLoaderData<typeof loader>>
type Variant = "A" | "B"

export default function EpisodeLoadingComparison() {
	const data = useLoaderData<typeof loader>()
	const [params, setParams] = useSearchParams()
	const variant: Variant = params.get("variant") === "B" ? "B" : "A"
	const [replay, setReplay] = useState(0)
	const choose = (value: Variant) => {
		const next = new URLSearchParams(params)
		next.set("variant", value)
		setParams(next, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const key = (event: KeyboardEvent) => {
			if (
				(event.target as HTMLElement).closest(
					"input, textarea, select, [contenteditable], [role=grid]",
				)
			)
				return
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
			const next = new URLSearchParams(params)
			next.set("variant", variant === "A" ? "B" : "A")
			setParams(next, { replace: true, preventScrollReset: true })
		}
		window.addEventListener("keydown", key)
		return () => window.removeEventListener("keydown", key)
	}, [params, setParams, variant])
	return (
		<Comparison
			key={`${data.media.details.tmdb_id}-${variant}-${replay}`}
			data={data}
			variant={variant}
			replay={replay}
			onReplay={() => setReplay((n) => n + 1)}
			onVariant={choose}
		/>
	)
}

function Comparison({
	data,
	variant,
	replay,
	onVariant,
	onReplay,
}: {
	data: Data
	variant: Variant
	replay: number
	onVariant: (value: Variant) => void
	onReplay: () => void
}) {
	const outerAuth = useContext(AuthContext)
	const outerQueries = useQueryClient()
	const showId = data.media.details.tmdb_id
	// Only the episodes' reveal is simulated: tracking is known from the start, so the hero never changes.
	const [loaded, setLoaded] = useState(false)
	const [deadline, setDeadline] = useState<number | null>(null)
	const [wanted, setWanted] = useState(false)
	const want = useCallback(() => setWanted(true), [])
	const previewId = useId()
	const grid = useMemo(
		() => data.grid && unpackEpisodeGrid(data.grid),
		[data.grid],
	)
	const [user] = useState(
		() =>
			({
				// A fresh member per replay, so that no store request outlives its comparison.
				id: `episode-loading-preview-${showId}-${variant}-${replay}-${previewId}`,
				email: "preview@example.com",
			}) as User,
	)
	const memberData = useMemo(() => {
		const entry = watchStateEntryOf(data.tracking)
		return {
			...EMPTY_MEMBER,
			watchState: entry ? { [`show-${showId}`]: entry } : {},
		}
	}, [data.tracking, showId])
	const [queries] = useState(() => {
		const client = new QueryClient({
			defaultOptions: outerQueries.getDefaultOptions(),
		})
		client.setQueryData(getQueryKeyUserData(user.id), memberData)
		client.setQueryData(
			[...queryKeyShowTracking(user.id, showId), "en"],
			data.tracking,
		)
		getShowStore(user.id, showId).load(data.tracking)
		return client
	})
	const [mounted, setMounted] = useState(false)
	useEffect(() => {
		const original = window.fetch
		window.fetch = async (input, init) => {
			const url = new URL(
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url,
				window.location.origin,
			)
			const method =
				init?.method ?? (input instanceof Request ? input.method : "GET")
			if (
				url.origin === window.location.origin &&
				url.pathname.startsWith("/api/")
			) {
				if (method !== "GET" && method !== "HEAD")
					return Response.json(
						{ error: "Read-only episode loading preview" },
						{ status: 405 },
					)
				if (url.pathname === "/api/tracking/show")
					return Response.json(data.tracking)
				if (url.pathname === "/api/user-data") return Response.json(memberData)
			}
			return original(input, init)
		}
		setMounted(true)
		return () => {
			window.fetch = original
		}
	}, [data.tracking, memberData])
	useEffect(() => {
		if (deadline === null || loaded) return
		const timer = window.setTimeout(
			() => setLoaded(true),
			Math.max(0, deadline - Date.now()),
		)
		return () => window.clearTimeout(timer)
	}, [deadline, loaded])

	const episodeGrid = grid ? <EpisodeGrid grid={grid} /> : null
	const episodes =
		variant === "A" ? (
			<div data-loading-comparison="A">
				<OnDemand
					media={data.media}
					grid={grid}
					userId={user.id}
					wanted={wanted}
					loaded={loaded}
					onWanted={want}
				>
					{episodeGrid}
				</OnDemand>
			</div>
		) : (
			<Reserved media={data.media} grid={grid} loaded={loaded}>
				{episodeGrid}
			</Reserved>
		)
	return (
		<>
			{mounted && (
				<QueryClientProvider client={queries}>
					<AuthContext.Provider value={{ ...outerAuth, user, loading: false }}>
						<LocaleContext.Provider
							value={{ locale: { language: "en", country: "DE" } }}
						>
							<Details
								media={data.media}
								country="DE"
								episodeGrid={grid}
								episodesSection={episodes}
							/>
						</LocaleContext.Provider>
					</AuthContext.Provider>
				</QueryClientProvider>
			)}
			<Controls
				variant={variant}
				showId={showId}
				loaded={loaded}
				deadline={deadline}
				wanted={wanted}
				onVariant={onVariant}
				onFinish={() => setLoaded(true)}
				onAuto={() => setDeadline(Date.now() + AUTO_MS)}
				onReplay={onReplay}
			/>
		</>
	)
}

/** A: today's grid until the member asks; the real list opens once they have asked and loading is through. */
function OnDemand({
	media,
	grid,
	userId,
	wanted,
	loaded,
	onWanted,
	children,
}: {
	media: Data["media"]
	grid: EpisodeGridData | null
	userId: string
	wanted: boolean
	loaded: boolean
	onWanted: () => void
	children: React.ReactNode
}) {
	useEffect(() => {
		// The hero's and the page navigation's episode links ask through the production store's event.
		window.addEventListener("gw:open-episodes", onWanted)
		return () => window.removeEventListener("gw:open-episodes", onWanted)
	}, [onWanted])
	const preview = (
		<div>
			<div className="mb-3 flex h-10 justify-end">
				<button
					type="button"
					disabled={wanted}
					className="rounded-lg bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-60"
					onClick={() => {
						onWanted()
						// The store keeps this request until the list takes it, so focus and jump survive the wait.
						getShowStore(userId, media.details.tmdb_id).openEpisode(null)
					}}
				>
					{wanted ? "Loading episodes…" : "Track episodes"}
				</button>
			</div>
			{children}
		</div>
	)
	return wanted && loaded ? (
		<EpisodeList media={media} grid={grid}>
			{preview}
		</EpisodeList>
	) : (
		preview
	)
}

type Block = {
	x: number
	y: number
	w: number
	h: number
	r: string
	text?: string
	textClass?: string
}

/** What the skeleton draws: the list's heading, switches, season labels, tiles, season scores and notes. */
const SKELETON_PARTS = [
	"#episode-list-title",
	"[data-jump-next]",
	"[data-view-toggle] button",
	"[data-season-press] > span",
	"[data-morph-cell]",
	"[data-season-row] span.justify-end > *",
	"[data-episode-list] > p",
	// A show with one season lists its episodes as rows instead of a grid.
	"[data-episode-list=rows] [data-episode]",
].join(",")

/**
 * B: the real list is laid out from the start, transparent and inert, so it holds its exact place. A skeleton
 * traced from that layout sits over it, and the list fades in where it already is.
 */
function Reserved({
	media,
	grid,
	loaded,
	children,
}: {
	media: Data["media"]
	grid: EpisodeGridData | null
	loaded: boolean
	children: React.ReactNode
}) {
	const root = useRef<HTMLDivElement>(null)
	const [blocks, setBlocks] = useState<Block[]>([])
	const [height, setHeight] = useState(0)
	const [gone, setGone] = useState(false)
	useLayoutEffect(() => {
		const host = root.current
		if (!host || loaded) return
		let frame = 0
		const trace = () => {
			frame = 0
			const origin = host.getBoundingClientRect()
			const found: Block[] = []
			for (const element of Array.from(
				host.querySelectorAll<HTMLElement>(SKELETON_PARTS),
			)) {
				const box = element.getBoundingClientRect()
				if (!box.width || !box.height) continue
				const at = { x: box.left - origin.left, y: box.top - origin.top }
				if (element.id === "episode-list-title") {
					// The heading is the same for every show, so it stays as words.
					found.push({
						...at,
						w: box.width,
						h: box.height,
						r: "0",
						text: element.textContent ?? "",
						textClass: element.className,
					})
				} else if (element.tagName === "SPAN" || element.tagName === "P") {
					// Words become one bar per line, a little shorter than the line.
					const range = document.createRange()
					range.selectNodeContents(element)
					for (const line of Array.from(range.getClientRects())) {
						if (!line.width) continue
						const h = Math.max(6, line.height * 0.55)
						found.push({
							x: line.left - origin.left,
							y: line.top - origin.top + (line.height - h) / 2,
							w: line.width,
							h,
							r: "4px",
						})
					}
				} else {
					found.push({
						...at,
						w: box.width,
						h: box.height,
						r: getComputedStyle(element).borderRadius || "6px",
					})
				}
			}
			setBlocks(found)
			setHeight(origin.height)
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(trace)
		}
		trace()
		const resize = new ResizeObserver(later)
		resize.observe(host)
		// The ratings grid measures itself after its first paint and places its tiles by transform.
		const changes = new MutationObserver(later)
		changes.observe(host, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["style", "data-measured", "data-morph"],
		})
		return () => {
			cancelAnimationFrame(frame)
			resize.disconnect()
			changes.disconnect()
		}
	}, [loaded])
	useEffect(() => {
		if (!loaded) return
		const timer = window.setTimeout(() => setGone(true), REVEAL_MS + 80)
		return () => window.clearTimeout(timer)
	}, [loaded])
	return (
		<div
			ref={root}
			data-loading-comparison="B"
			data-loading={!loaded}
			className="relative"
		>
			{/* Hidden tiles must be at their final positions when the skeleton traces their boxes. */}
			<style>
				{
					'[data-loading-comparison="B"][data-loading="true"] .episode-rating-tile{transition:none!important}'
				}
			</style>
			<div
				{...(!loaded ? { inert: "" } : {})}
				aria-hidden={!loaded || undefined}
				style={{
					opacity: loaded ? 1 : 0,
					transition: `opacity ${REVEAL_MS}ms ease-out`,
				}}
			>
				<EpisodeList media={media} grid={grid}>
					{children}
				</EpisodeList>
			</div>
			{!gone && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						opacity: loaded ? 0 : 1,
						transition: `opacity ${REVEAL_MS * 0.7}ms ease-in`,
					}}
				>
					<style>
						{
							"@keyframes gwp-skeleton{0%,100%{opacity:.5}50%{opacity:1}}.gwp-skeleton{animation:gwp-skeleton 1.6s ease-in-out infinite both}@media (prefers-reduced-motion:reduce){.gwp-skeleton{animation:none;opacity:.75}}"
						}
					</style>
					{blocks.map((block, index) =>
						block.text ? (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: positions are redrawn whole each trace
								key={index}
								className={`${block.textClass} absolute whitespace-nowrap text-white`}
								style={{ left: block.x, top: block.y, margin: 0 }}
							>
								{block.text}
							</span>
						) : (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: positions are redrawn whole each trace
								key={index}
								className="gwp-skeleton absolute bg-white/[0.07]"
								style={{
									left: block.x,
									top: block.y,
									width: block.w,
									height: block.h,
									borderRadius: block.r,
									// A slow wave down the list, rather than every tile pulsing together.
									animationDelay: `${height ? Math.round((block.y / height) * 700) : 0}ms`,
								}}
							/>
						),
					)}
				</div>
			)}
			{!loaded && (
				<span role="status" className="sr-only">
					Loading episodes
				</span>
			)}
		</div>
	)
}

/** Development comparison controls; the route itself 404s in production. */
function Controls({
	variant,
	showId,
	loaded,
	deadline,
	wanted,
	onVariant,
	onFinish,
	onAuto,
	onReplay,
}: {
	variant: Variant
	showId: number
	loaded: boolean
	deadline: number | null
	wanted: boolean
	onVariant: (value: Variant) => void
	onFinish: () => void
	onAuto: () => void
	onReplay: () => void
}) {
	const [collapsed, setCollapsed] = useState(false)
	const collapse = (value: boolean) => {
		setCollapsed(value)
	}
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (deadline === null || loaded) return
		const timer = window.setInterval(() => setNow(Date.now()), 200)
		return () => window.clearInterval(timer)
	}, [deadline, loaded])
	const left =
		deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
	const loading = loaded
		? "Loaded"
		: left !== null
			? `Loading · ${left}s`
			: "Loading held"
	const state =
		variant === "A"
			? `${loading} · ${wanted ? (loaded ? "list open" : "Track episodes pressed") : "not opened"}`
			: loaded
				? "Loaded · list revealed"
				: `${loading} · skeleton`
	const dot = loaded
		? "bg-green-400"
		: left !== null
			? "bg-amber-400 animate-pulse"
			: "bg-gray-400"
	const shape =
		"inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold disabled:cursor-default disabled:opacity-35 sm:h-8"
	const button = `${shape} bg-white/10 text-gray-200 hover:bg-white/20 disabled:hover:bg-white/10`

	if (collapsed)
		return (
			<button
				type="button"
				data-prototype-controls
				onClick={() => collapse(false)}
				aria-label="Show the comparison controls"
				className="fixed bottom-3 right-3 z-[200] inline-flex h-10 items-center gap-2 rounded-full bg-gray-950/95 px-3.5 text-xs font-semibold text-gray-200 shadow-xl ring-1 ring-fuchsia-400/50"
			>
				<span className={`h-2 w-2 rounded-full ${dot}`} />
				<span className="text-fuchsia-300">Dev</span>
				{variant} · {loading}
			</button>
		)

	return (
		<div
			data-prototype-controls
			role="region"
			aria-label="Episode loading comparison controls"
			className="fixed inset-x-2 bottom-2 z-[200] rounded-2xl bg-gray-950/95 p-2.5 text-xs text-gray-200 shadow-2xl ring-1 ring-fuchsia-400/40 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[25rem]"
		>
			<div className="flex items-center gap-2 px-1 pb-2">
				<span className="rounded border border-dashed border-fuchsia-400/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
					Dev comparison
				</span>
				<span
					className="flex min-w-0 items-center gap-1.5 text-gray-300"
					aria-live="polite"
				>
					<span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
					<span className="truncate">{state}</span>
				</span>
				<button
					type="button"
					onClick={() => collapse(true)}
					aria-label="Hide the comparison controls"
					className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
				>
					<svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
						<path
							d="M5 8l5 5 5-5"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			</div>
			<div
				role="radiogroup"
				aria-label="Variant"
				className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1"
			>
				{(["A", "B"] as const).map((value) => (
					<button
						key={value}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a two-way switch drawn as buttons, as the site's other switches
						role="radio"
						aria-checked={variant === value}
						onClick={() => onVariant(value)}
						className={`flex h-10 flex-col items-start justify-center rounded-lg px-2.5 text-left sm:h-11 ${variant === value ? "bg-white text-gray-900" : "text-gray-300 hover:bg-white/10"}`}
					>
						<span className="font-bold">
							{value} · {value === "A" ? "Open on demand" : "Reserved skeleton"}
						</span>
						<span
							className={`text-[10px] ${variant === value ? "text-gray-600" : "text-gray-500"}`}
						>
							{value === "A"
								? "Track episodes opens the list"
								: "Reveals in place when loaded"}
						</span>
					</button>
				))}
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				<button
					type="button"
					onClick={onFinish}
					disabled={loaded}
					className={`${shape} bg-amber-400 text-gray-950 hover:bg-amber-300 disabled:hover:bg-amber-400`}
				>
					Finish loading
				</button>
				<button
					type="button"
					onClick={onAuto}
					disabled={loaded || deadline !== null}
					className={button}
				>
					{left !== null && !loaded ? `Loading in ${left}s` : "Load in 4s"}
				</button>
				<button type="button" onClick={onReplay} className={button}>
					Replay
				</button>
				<button
					type="button"
					onClick={() =>
						document
							.getElementById("actors_and_crew")
							?.scrollIntoView({ block: "start" })
					}
					className={button}
				>
					Read cast
				</button>
				<select
					aria-label="Show"
					value={showId}
					onChange={(event) => {
						const url = new URL(window.location.href)
						url.searchParams.set("show", event.target.value)
						window.location.assign(url)
					}}
					className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-white/10 px-2 text-xs font-semibold text-gray-200 sm:h-8"
				>
					<option value="87108">Chernobyl · 1 season</option>
					<option value="1396">Breaking Bad · 5 seasons</option>
					<option value="1622">Supernatural · 15 seasons</option>
				</select>
			</div>
			<p className="mt-1.5 hidden px-1 text-[10px] text-gray-500 sm:block">
				Read-only member · Left and Right arrow keys switch variants
			</p>
		</div>
	)
}
