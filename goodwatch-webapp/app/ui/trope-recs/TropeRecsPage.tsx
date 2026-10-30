// By your tropes (/watch/for-you/tropes): unseen picks ranked by the member's top tropes, as a poster grid.
// - Every poster has one quiet gray line under it: "#n · match · N of your tropes". A tap opens the pick's sheet
//   (PickSheet.tsx) with how each of the member's tropes shows up in it; each trope there links to its own picks.
// - ?trope=<key> narrows the grid to one trope: a header with its name, the member's rank for it, how many of their
//   titles with it they loved, and the opening line of its TV Tropes description, with the way back to all picks.
// - "Your tropes ▾" opens a plain list of the member's top tropes to pick one from. All / Movies / Shows is ?kind=.
// No amber, no chips. Guests, and members without enough scored titles for a trope profile, get a short prompt.
import { Link, useSearchParams } from "@remix-run/react"
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react"
import { ratePath } from "~/domain/member-paths"
import {
	type MemberTropeRef,
	REC_KINDS,
	type RecKind,
	findTrope,
	rankLine,
	readRecsQuery,
	tropeRecsPath,
} from "~/domain/trope-recs"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { DISPLAY, Empty, GuestPage } from "~/ui/my-pages/bits"
import { usePathViewer } from "~/ui/navigation/NavigationContext"
import { Segmented } from "~/ui/profile/parts"
import { teaser } from "~/ui/profile/tropes/model"
import { LicenseCredit } from "~/ui/profile/tropes/parts"
import { useUser } from "~/utils/auth"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { openingLead } from "~/utils/trope-opening"
import { RecsSwitch } from "./RecsSwitch"
import {
	NotYourTrope,
	type RecTitle,
	useMyTropes,
	useRecs,
	useTropeDescription,
} from "./api"
import { cardTitle } from "./card"

const loadSheet = reloadOnStaleChunk(() => import("./PickSheet"))
const PickSheet = lazy(loadSheet)

/** Posters per step of "Show more". */
const STEP = 36
const WRAP = "mx-auto max-w-[1600px] px-4 pb-28 md:px-8 lg:pb-10"
const QUIET_BUTTON =
	"min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold text-gray-200 ring-1 ring-white/15 hover:bg-white/10"

export function TropeRecsPage() {
	const { user, loading } = useUser()
	if (!user)
		return loading ? (
			<div className={WRAP}>
				<GridSkeleton />
			</div>
		) : (
			<GuestPage
				name="By your tropes"
				line="Picks ranked by the TV Tropes you love most."
				words={{
					title: "Sign up to get picks by your tropes",
					detail:
						"Score the movies and shows you've seen, and GoodWatch finds the tropes you love and the unseen titles full of them.",
				}}
			/>
		)
	return <MemberView />
}

function MemberView() {
	const viewer = usePathViewer()
	const [search, setSearch] = useSearchParams()
	const query = readRecsQuery(search)
	const mine = useMyTropes()
	const tropes = mine.data?.tropes ?? []
	const known = !!mine.data && !mine.data.pending
	const trope = findTrope(tropes, query.trope)
	const unknownTrope = known && !!query.trope && !trope
	const recs = useRecs(
		query.kind,
		trope?.id ?? null,
		known && tropes.length > 0 && !unknownTrope && (!query.trope || !!trope),
	)
	const setKind = (kind: RecKind) => {
		const next = new URLSearchParams(search)
		if (kind === "all") next.delete("kind")
		else next.set("kind", kind)
		setSearch(next, { replace: true, preventScrollReset: true })
	}

	// A new trope starts at the top of the page.
	const shownTrope = trope?.id ?? null
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		window.scrollTo({ top: 0 })
	}, [shownTrope])

	if (mine.isError)
		return (
			<div className={WRAP}>
				<Problem retry={() => mine.refetch()} />
			</div>
		)
	if (!known)
		return (
			<div className={WRAP}>
				<GridSkeleton note="Reading your tropes…" />
			</div>
		)
	if (!tropes.length)
		return (
			<div className={WRAP}>
				<Empty title="Score a few more titles first">
					<p>
						Picks by your tropes need a trope profile: the tropes in at least
						ten of the titles you scored, compared with how you scored them.
					</p>
					<Link
						to={ratePath(viewer)}
						prefetch="intent"
						className="mt-4 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/10"
					>
						Rate more
					</Link>
				</Empty>
			</div>
		)

	return (
		<div className={WRAP}>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<RecsSwitch here="tropes" />
				<Segmented
					label="Movies or shows"
					value={query.kind}
					onChange={setKind}
					options={REC_KINDS}
				/>
			</div>
			{trope ? (
				<TropeHead trope={trope} kind={query.kind} />
			) : (
				<h2 className="text-sm text-gray-400">
					{unknownTrope
						? "That trope isn't among your top tropes."
						: "In match order. Tap a poster for why, then a trope for more like it."}
				</h2>
			)}
			<YourTropes
				key={shownTrope ?? "all"}
				tropes={tropes}
				current={shownTrope}
				kind={query.kind}
			/>
			{unknownTrope ? (
				<Link
					to={tropeRecsPath({ kind: query.kind })}
					className={`${QUIET_BUTTON} inline-flex items-center`}
				>
					← All picks for you
				</Link>
			) : recs.error instanceof NotYourTrope ? (
				<Empty title="That trope left your top tropes">
					<p>Your profile changed since the link was made.</p>
				</Empty>
			) : recs.isError ? (
				<Problem retry={() => recs.refetch()} />
			) : !recs.data || recs.data.pending ? (
				<GridSkeleton note="Getting your picks ready…" />
			) : recs.data.titles.length === 0 ? (
				<Empty title="No unseen picks here">
					<p>
						{query.kind === "all"
							? "You've seen or hidden every title we'd pick for these tropes."
							: `Nothing unseen among the ${query.kind === "movie" ? "movies" : "shows"}. Try All.`}
					</p>
				</Empty>
			) : (
				<Picks
					key={`${shownTrope}|${query.kind}`}
					titles={recs.data.titles}
					single={!!trope}
					tropeCount={tropes.length}
					kind={query.kind}
				/>
			)}
		</div>
	)
}

/** Shown above the grid when it's narrowed to one trope. */
function TropeHead({ trope, kind }: { trope: MemberTropeRef; kind: RecKind }) {
	const viewer = usePathViewer()
	const handle = viewer.kind === "member" ? viewer.handle : null
	const description = useTropeDescription(handle, trope.id).data?.entries[
		trope.id
	]
	const line = description
		? teaser(
				description.opening
					? openingLead(description.opening)
					: description.text,
			)
		: null
	return (
		<header>
			<Link
				to={tropeRecsPath({ kind })}
				prefetch="intent"
				className="inline-flex min-h-9 items-center text-sm font-bold text-gray-400 hover:text-white"
			>
				← All picks for you
			</Link>
			<h2 className={`${DISPLAY} mt-1 text-3xl text-white sm:text-4xl`}>
				{trope.name}
			</h2>
			<p className="mt-1 max-w-2xl text-sm text-gray-400">
				Your #{trope.rank} trope · you scored {trope.loved} of {trope.count}{" "}
				titles with it 8+.
			</p>
			{line && (
				<p className="mt-2 max-w-2xl text-sm text-gray-500">
					{line}{" "}
					<a
						href={description?.url || trope.id}
						target="_blank"
						rel="noreferrer noopener"
						className="whitespace-nowrap text-gray-400 underline decoration-gray-600 underline-offset-2 hover:text-white"
					>
						TV Tropes
					</a>
				</p>
			)}
			{line && <LicenseCredit />}
		</header>
	)
}

/** "Your tropes ▾": a plain gray list of the member's top tropes, each a link to its picks. */
function YourTropes({
	tropes,
	current,
	kind,
}: {
	tropes: MemberTropeRef[]
	current: string | null
	kind: RecKind
}) {
	const [open, setOpen] = useState(false)
	return (
		<div className="mt-1 mb-4">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-controls="your-tropes"
				className="min-h-9 cursor-pointer text-sm text-gray-400 hover:text-white"
			>
				Your tropes {open ? "▴" : "▾"}
			</button>
			{open && (
				<ol
					id="your-tropes"
					className="mt-2 columns-2 gap-6 text-sm sm:columns-3 lg:columns-4"
				>
					{tropes.map((t) => (
						<li key={t.id} className="break-inside-avoid">
							<Link
								to={tropeRecsPath({ trope: t.id, kind })}
								aria-current={t.id === current ? "page" : undefined}
								className={`inline-flex min-h-8 items-baseline gap-1 text-left hover:text-white ${t.id === current ? "font-bold text-white" : "text-gray-400"}`}
							>
								<span className="text-gray-600 tabular-nums">{t.rank}.</span>
								{t.name}
							</Link>
						</li>
					))}
				</ol>
			)}
		</div>
	)
}

function Picks({
	titles,
	single,
	tropeCount,
	kind,
}: {
	titles: RecTitle[]
	single: boolean
	tropeCount: number
	kind: RecKind
}) {
	const [shown, setShown] = useState(STEP)
	// Selected by title id: a refetch that drops or moves the title closes the sheet instead of showing another one.
	const [openId, setOpenId] = useState<RecTitle["id"] | null>(null)
	const index = openId === null ? -1 : titles.findIndex((t) => t.id === openId)
	const pick = index < 0 ? null : titles[index]
	const visible = useMemo(() => titles.slice(0, shown), [titles, shown])
	return (
		<>
			<ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
				{visible.map((t, i) => (
					<li key={t.id} className="flex min-w-0 flex-col gap-1">
						{/* A tap opens the sheet; the card's own link stays for middle-click and new tabs. */}
						<div
							className="cursor-pointer"
							onPointerDown={() => void loadSheet().catch(() => {})}
							onClickCapture={(e) => {
								if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
									return
								e.preventDefault()
								e.stopPropagation()
								setOpenId(t.id)
							}}
						>
							<MovieTvCard
								details={cardTitle(t)}
								mediaType={t.kind}
								actions={false}
								posterPriority={i < 6 ? "eager" : undefined}
								skipOffscreen={i >= 18}
							/>
						</div>
						<RankLine
							place={i + 1}
							match={t.match}
							matched={single ? undefined : t.matchedCount}
						/>
					</li>
				))}
			</ol>
			{titles.length > shown && (
				<p className="flex justify-center pt-6">
					<button
						type="button"
						onClick={() => setShown((n) => n + STEP)}
						className={QUIET_BUTTON}
					>
						Show {Math.min(STEP, titles.length - shown)} more
					</button>
				</p>
			)}
			{pick && (
				<Suspense fallback={null}>
					<PickSheet
						key={pick.id}
						pick={pick}
						place={index + 1}
						tropeCount={tropeCount}
						kind={kind}
						onClose={() => setOpenId(null)}
					/>
				</Suspense>
			)}
		</>
	)
}

/** "#1 · 94 · 5 of your tropes" in gray under the poster, the number brighter; never on the title band. */
function RankLine({
	place,
	match,
	matched,
}: { place: number; match: number; matched?: number }) {
	return (
		<p
			className="flex items-baseline gap-1.5 text-[11px] text-gray-500 tabular-nums"
			aria-label={rankLine(place, match, matched)}
		>
			<span className="font-bold">#{place}</span>
			<span className="text-gray-300">{match}</span>
			{matched !== undefined && (
				<span className="min-w-0 truncate">· {matched} of your tropes</span>
			)}
		</p>
	)
}

function GridSkeleton({ note }: { note?: string }) {
	return (
		<div aria-busy="true">
			{note && (
				// biome-ignore lint/a11y/useSemanticElements: a live status line, as elsewhere on the site
				<p role="status" className="mb-4 text-sm text-gray-400">
					{note}
				</p>
			)}
			<ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
				{Array.from({ length: 12 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders without identity
					<li key={i} className="flex flex-col gap-1">
						<span className="block aspect-[2/3] animate-pulse rounded-lg bg-white/[0.06]" />
						<span className="block h-3 w-1/2 rounded bg-white/[0.04]" />
					</li>
				))}
			</ol>
		</div>
	)
}

function Problem({ retry }: { retry: () => void }) {
	return (
		<Empty title="Your picks could not load">
			<p>Something went wrong on our side.</p>
			<button type="button" onClick={retry} className={`${QUIET_BUTTON} mt-4`}>
				Try again
			</button>
		</Empty>
	)
}
