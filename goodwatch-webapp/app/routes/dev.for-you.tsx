// Development only: For you's browse rule and the scale of the taste match on the signed-in viewer's own taste, for
// tuning both. Two columns for the filter bar's state in the URL: the plain order of the chosen sort, and the For you
// order. The loader sends the percentile and score of every passing title, so changing a number ranks the whole list
// again in the browser with the same rankForYou the server uses, and shows every match again with the same shownMatch.
// Each row shows the match as it was (round(50 + 0.49 * percentile)) next to the match under the scale on the page,
// and a table counts the passing titles per band of both. The numbers here change nothing for anyone: to keep a
// curve, copy them into the constants in app/domain/for-you.ts; to keep a scale, into app/domain/taste-match.ts.
// Returns 404 in production.
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useFetcher, useLoaderData } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import {
	BROWSE_LIFT_EXPONENT,
	BROWSE_LIFT_FULL,
	BROWSE_LIFT_START,
	BROWSE_QUALITY_FLOOR,
	browseLift,
	browseLiftRange,
	rankForYou,
} from "~/domain/for-you"
import {
	MATCH_ANCHORS,
	MATCH_CEILINGS,
	type MatchScaleOptions,
	matchCeiling,
	percentileOfStep,
	rankStep,
	shownMatch,
} from "~/domain/taste-match"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import {
	SnapshotNotLoaded,
	discoverFilterDefaults,
	getForYouPreview,
} from "~/server/discover-results.server"
import { loadTaste } from "~/server/taste/index.server"
import {
	MAX_KEYS,
	type TitleCard,
	getTitleCards,
} from "~/server/title-cards.server"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import { DISCOVER_SORTS, FilterBar, useFilterState } from "~/ui/filter-bar"
import type { TitleKey } from "~/utils/title-key"

/** How many rows each column shows. */
const TOP = 60
const POSTER = "https://image.tmdb.org/t/p/w92"

/** What a row shows of a title. */
interface RowTitle {
	key: TitleKey
	title: string
	year: number | null
	poster: string | null
}

const DEFAULTS = {
	start: BROWSE_LIFT_START,
	full: BROWSE_LIFT_FULL,
	exponent: BROWSE_LIFT_EXPONENT,
	floor: BROWSE_QUALITY_FLOOR,
}
type Tuning = typeof DEFAULTS

/** The scale of the match as the page tunes it: the match of each anchor and the ceiling of each step. */
const SCALE_DEFAULTS = {
	anchors: MATCH_ANCHORS.map((anchor) => anchor.match),
	ceilings: MATCH_CEILINGS.map((step) => step.ceiling),
}
type ScaleTuning = typeof SCALE_DEFAULTS

const scaleOptions = (scale: ScaleTuning): MatchScaleOptions => ({
	anchors: MATCH_ANCHORS.map((anchor, i) => ({
		...anchor,
		match: scale.anchors[i],
	})),
	ceilings: MATCH_CEILINGS.map((step, i) => ({
		...step,
		ceiling: scale.ceilings[i],
	})),
})

/** The match as it was shown before the scale: 50 to 99, even in the percentile. */
const oldMatch = rankStep

/** The bands the table counts titles in. */
const BANDS: { label: string; from: number; to: number }[] = [
	{ label: "50s", from: 50, to: 59 },
	{ label: "60s", from: 60, to: 69 },
	{ label: "70s", from: 70, to: 79 },
	{ label: "80s", from: 80, to: 89 },
	{ label: "90–94", from: 90, to: 94 },
	{ label: "95–98", from: 95, to: 98 },
	{ label: "99", from: 99, to: 99 },
]

/** The share of the pool at or above a percentile, as "top 1%" reads: 2 significant digits. */
const topShare = (percentile: number) =>
	`${Number((100 - percentile).toPrecision(2))}%`

function notInProduction() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
}

const rowTitle = (card: TitleCard): RowTitle => ({
	key: card.key,
	title: card.title,
	year: card.release_year,
	poster: card.poster_path,
})

async function rowTitles(
	keys: TitleKey[],
	ctx: ViewerContext,
): Promise<RowTitle[]> {
	const taste = await loadTaste(ctx.viewer)
	const unique = [...new Set(keys)]
	const batches: TitleKey[][] = []
	for (let at = 0; at < unique.length; at += MAX_KEYS)
		batches.push(unique.slice(at, at + MAX_KEYS))
	const cards = await Promise.all(
		batches.map((batch) => getTitleCards(batch, ctx, taste)),
	)
	return cards.flat().map(rowTitle)
}

/** The titles the browse rule may lift: a known GoodWatch score of at least the floor. */
const liftableOf = (scores: number[], floor: number) =>
	Uint8Array.from(scores, (score) => (score >= 0 && score >= floor ? 1 : 0))

export async function loader({ request }: LoaderFunctionArgs) {
	notInProduction()
	const ctx = await getViewerContext(request)
	const defaults = discoverFilterDefaults(ctx)
	if (ctx.viewer.kind !== "member")
		return json({ member: false as const, defaults })
	const params = new URL(request.url).searchParams
	try {
		const preview = await getForYouPreview(ctx, {
			state: filterStateFromParams(params, defaults),
			sort: sortFromParams(params, false),
		})
		// The titles of both columns under the constants; the page asks for the ones other numbers bring in.
		const forYou = rankForYou(
			preview.keys,
			preview.percentiles,
			"browse",
			liftableOf(preview.scores, BROWSE_QUALITY_FLOOR),
		)
		const titles = await rowTitles(
			[...preview.keys.slice(0, TOP), ...forYou.order.slice(0, TOP)],
			ctx,
		)
		return json({ member: true as const, defaults, preview, titles })
	} catch (error) {
		if (error instanceof SnapshotNotLoaded)
			throw new Response("Starting up, try again shortly", { status: 503 })
		throw error
	}
}

// The row fields for titles the tuned numbers brought into the top.
export async function action({ request }: ActionFunctionArgs) {
	notInProduction()
	const body = (await request.json()) as { keys: number[] }
	const ctx = await getViewerContext(request)
	const keys = (body.keys ?? [])
		.filter((key) => Number.isSafeInteger(key) && key > 0)
		.slice(0, MAX_KEYS)
	return json({ titles: await rowTitles(keys, ctx) })
}

export default function DevForYou() {
	const data = useLoaderData<typeof loader>()
	const filters = useFilterState({ defaults: data.defaults })
	const counts = useDiscoverResults({
		query: filters.query,
		forYou: false,
		guest: null,
		enabled: data.member,
	})
	const [tuning, setTuning] = useState<Tuning>(DEFAULTS)
	const [scale, setScale] = useState<ScaleTuning>(SCALE_DEFAULTS)
	const preview = data.member ? data.preview : null
	// The liked count the ceiling is worked out from: the viewer's own until another one is typed in.
	const [likedTyped, setLikedTyped] = useState<number | null>(null)
	const liked = likedTyped ?? preview?.liked ?? 0
	const options = useMemo(() => scaleOptions(scale), [scale])

	// Every passing title with a match, per band, as it was shown and as the scale on the page shows it.
	const bands = useMemo(() => {
		const was = new Array<number>(BANDS.length).fill(0)
		const now = new Array<number>(BANDS.length).fill(0)
		let matched = 0
		const bandOf = (match: number) =>
			BANDS.findIndex((band) => match >= band.from && match <= band.to)
		for (const percentile of preview?.percentiles ?? []) {
			if (percentile < 0) continue
			matched++
			was[bandOf(oldMatch(percentile))]++
			now[bandOf(shownMatch(percentile, liked, options))]++
		}
		return { was, now, matched }
	}, [preview, liked, options])

	// The whole list again for every change of a number: rankForYou is linear in it.
	const ranking = useMemo(() => {
		if (!preview) return null
		const indexes = preview.keys.map((_, i) => i)
		return rankForYou(
			indexes,
			preview.percentiles,
			"browse",
			liftableOf(preview.scores, tuning.floor),
			tuning,
		)
	}, [preview, tuning])

	// Row fields: the loader's, and those fetched for titles that entered the top since.
	const more = useFetcher<typeof action>()
	const [fetched, setFetched] = useState<RowTitle[]>([])
	const answer = more.data
	useEffect(() => {
		if (answer) setFetched((had) => [...had, ...answer.titles])
	}, [answer])
	const titles = useMemo(() => {
		const byKey = new Map<TitleKey, RowTitle>()
		for (const title of fetched) byKey.set(title.key, title)
		if (data.member)
			for (const title of data.titles) byKey.set(title.key, title)
		return byKey
	}, [data, fetched])
	const top = ranking?.order.slice(0, TOP) ?? []
	const missing = preview
		? top.map((i) => preview.keys[i]).filter((key) => !titles.has(key))
		: []
	const missingKey = missing.join(",")
	// Asks for the missing row fields once the previous answer is in. A title missing from the catalog stays a key.
	const [asked, setAsked] = useState("")
	useEffect(() => {
		if (!missingKey || missingKey === asked || more.state !== "idle") return
		setAsked(missingKey)
		more.submit(JSON.stringify({ keys: missingKey.split(",").map(Number) }), {
			method: "POST",
			encType: "application/json",
		})
	}, [missingKey, asked, more.state, more.submit])

	if (!data.member || !preview || !ranking)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-gray-400">
				Sign in to tune For you: it ranks by your own taste.
			</p>
		)

	const range = browseLiftRange(tuning)
	const set = (name: keyof Tuning) => (value: number) =>
		setTuning((now) => ({ ...now, [name]: value }))
	const row = (index: number, position: number, from?: number) => (
		<Row
			key={preview.keys[index]}
			position={position}
			title={titles.get(preview.keys[index])}
			titleKey={preview.keys[index]}
			score={preview.scores[index]}
			percentile={preview.percentiles[index]}
			match={
				preview.percentiles[index] < 0
					? null
					: shownMatch(preview.percentiles[index], liked, options)
			}
			floor={tuning.floor}
			from={from}
		/>
	)

	return (
		<div className="mx-auto max-w-7xl px-4 pt-5 pb-24 lg:pt-8">
			<h1 className="brand-header text-4xl text-white">For you, tuned</h1>
			<p className="mt-1 text-xs text-gray-500">
				{preview.keys.length.toLocaleString("en")} titles pass the filters, in{" "}
				{DISCOVER_SORTS[preview.sortUsed].label} order
				{filters.sort === "match" &&
					" (Best match has no plain order to blend into, so this is Popular)"}
				{" · "}
				{preview.hasTaste
					? `${ranking.movedUp.toLocaleString("en")} moved up`
					: "you have no taste yet, so nothing moves: rate a few titles you love"}
			</p>
			<div className="mt-7">
				<FilterBar filters={filters} counts={counts.data ?? null} />
			</div>

			<section className="mt-7 flex flex-wrap items-end gap-x-6 gap-y-4">
				<NumberField
					label="Start"
					hint={`percentile; climbs from the top ${topShare(range.start)}`}
					value={tuning.start}
					min={0}
					max={100}
					step={1}
					onChange={set("start")}
				/>
				<NumberField
					label="Full"
					hint={`percentile; the top ${topShare(range.full)} go to the top`}
					value={tuning.full}
					min={0}
					max={100}
					step={1}
					onChange={set("full")}
				/>
				<NumberField
					label="Exponent"
					hint="1 is a straight line"
					value={tuning.exponent}
					min={0.1}
					max={10}
					step={0.1}
					onChange={set("exponent")}
				/>
				<NumberField
					label="Quality floor"
					hint="least GoodWatch score"
					value={tuning.floor}
					min={0}
					max={100}
					step={1}
					onChange={set("floor")}
				/>
				<button
					type="button"
					onClick={() => setTuning(DEFAULTS)}
					className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-gray-200 ring-1 ring-white/10 cursor-pointer hover:bg-white/10"
				>
					Back to the constants
				</button>
			</section>

			<LiftPlot tuning={tuning} liked={liked} options={options} />

			<section className="mt-9">
				<h2 className="text-[15px] font-bold text-white">
					The scale of the match
				</h2>
				<p className="text-xs text-gray-500">
					The match is linear in log10 of the share of well-known titles that
					fit at least as well, through these anchors. For you does not read it:
					it ranks by the percentile, so these numbers move no title.
				</p>
				<div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-4">
					{MATCH_ANCHORS.map((anchor, i) => (
						<NumberField
							key={anchor.share}
							label={`Top ${Number((anchor.share * 100).toPrecision(2))}%`}
							hint="match"
							value={scale.anchors[i]}
							min={50}
							max={99}
							step={1}
							onChange={(value) =>
								setScale((now) => ({
									...now,
									anchors: now.anchors.map((was, j) => (j === i ? value : was)),
								}))
							}
						/>
					))}
				</div>
				<p className="mt-5 text-xs text-gray-500">
					The highest match a taste shows, by the liked titles it is built from.
					The part above 50 is scaled down to it, so titles stay apart.
				</p>
				<div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-4">
					{MATCH_CEILINGS.map((step, i) => (
						<NumberField
							key={step.liked}
							label={`${step.liked} liked`}
							hint="ceiling"
							value={scale.ceilings[i]}
							min={50}
							max={99}
							step={1}
							onChange={(value) =>
								setScale((now) => ({
									...now,
									ceilings: now.ceilings.map((was, j) =>
										j === i ? value : was,
									),
								}))
							}
						/>
					))}
					<NumberField
						label="Liked titles"
						hint={`yours: ${preview.liked}; ceiling ${Number(matchCeiling(liked, options.ceilings).toFixed(1))}`}
						value={liked}
						min={0}
						max={5000}
						step={1}
						onChange={setLikedTyped}
					/>
					<button
						type="button"
						onClick={() => {
							setScale(SCALE_DEFAULTS)
							setLikedTyped(null)
						}}
						className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm font-bold text-gray-200 ring-1 ring-white/10 cursor-pointer hover:bg-white/10"
					>
						Back to the constants
					</button>
				</div>
				<table className="mt-5 text-sm tabular-nums text-gray-200">
					<caption className="mb-2 text-left text-xs text-gray-500">
						{bands.matched.toLocaleString("en")} passing titles with a match,
						per band: as it was shown, and under the scale above with{" "}
						{liked.toLocaleString("en")} liked titles
					</caption>
					<thead>
						<tr className="text-xs text-gray-500">
							<th className="pr-6 text-left font-normal">Match</th>
							{BANDS.map((band) => (
								<th key={band.label} className="px-3 text-right font-normal">
									{band.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						<tr>
							<th className="pr-6 text-left font-normal text-gray-400">Old</th>
							{bands.was.map((count, i) => (
								<td key={BANDS[i].label} className="px-3 text-right">
									{count.toLocaleString("en")}
								</td>
							))}
						</tr>
						<tr>
							<th className="pr-6 text-left font-bold text-amber-200">New</th>
							{bands.now.map((count, i) => (
								<td
									key={BANDS[i].label}
									className="px-3 text-right text-amber-200"
								>
									{count.toLocaleString("en")}
								</td>
							))}
						</tr>
					</tbody>
				</table>
			</section>

			<div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
				<section>
					<h2 className="mb-3 text-[15px] font-bold text-white">
						{DISCOVER_SORTS[preview.sortUsed].label}, plain
					</h2>
					<ol className="flex flex-col gap-1">
						{preview.keys.slice(0, TOP).map((_, i) => row(i, i + 1))}
					</ol>
				</section>
				<section>
					<h2 className="mb-3 text-[15px] font-bold text-amber-200">
						With For you
					</h2>
					<ol className="flex flex-col gap-1">
						{top.map((index, j) => row(index, j + 1, index + 1))}
					</ol>
				</section>
			</div>
		</div>
	)
}

function NumberField({
	label,
	hint,
	value,
	min,
	max,
	step,
	onChange,
}: {
	label: string
	hint: string
	value: number
	min: number
	max: number
	step: number
	onChange: (value: number) => void
}) {
	return (
		<label className="flex flex-col gap-1 text-sm font-bold text-white">
			{label}
			<input
				type="number"
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={(event) => {
					const next = event.target.valueAsNumber
					if (Number.isFinite(next))
						onChange(Math.max(min, Math.min(max, next)))
				}}
				className="h-10 w-28 rounded-xl border-0 bg-white/[0.06] px-3 text-sm tabular-nums text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-amber-400"
			/>
			<span className="text-xs font-normal text-gray-500">{hint}</span>
		</label>
	)
}

/** The lift per rank step: the percentile in the 50 even steps the rule reads, with the match each step shows. */
function LiftPlot({
	tuning,
	liked,
	options,
}: {
	tuning: Tuning
	liked: number
	options: MatchScaleOptions
}) {
	const steps = Array.from({ length: 50 }, (_, i) => 50 + i)
	return (
		<section className="mt-7">
			<h2 className="text-[15px] font-bold text-white">Lift per percentile</h2>
			<p className="text-xs text-gray-500">
				A title at place i of the sort lands at i × (1 − lift). The rule reads
				the percentile in 50 even steps; the numbers under the bars are
				percentiles. Hover a bar for its numbers.
			</p>
			<div
				className="mt-3 flex h-28 items-end gap-px"
				role="img"
				aria-label="Lift per percentile from 0 to 100"
			>
				{steps.map((step) => {
					const from = percentileOfStep(step)
					// The middle of the step, so rounding can't put it in the step below.
					const lift = browseLift(Math.min(100, (step - 50) / 0.49), tuning)
					return (
						<div
							key={step}
							title={`from percentile ${from.toFixed(1)} (match ${shownMatch(from, liked, options)}%, was ${step}%): lift ${lift.toFixed(2)}, lands at ${(1 - lift).toFixed(2)} of its place`}
							className="flex h-full flex-1 items-end rounded-t-sm bg-white/[0.04]"
						>
							<div
								className="w-full rounded-t-sm bg-amber-500"
								style={{ height: `${lift * 100}%` }}
							/>
						</div>
					)
				})}
			</div>
			<div className="mt-1 flex gap-px text-[10px] tabular-nums text-gray-500">
				{steps.map((step) => (
					<span key={step} className="flex-1 text-center">
						{step % 5 === 0 || step === 99
							? Math.round(percentileOfStep(step))
							: ""}
					</span>
				))}
			</div>
		</section>
	)
}

function Row({
	position,
	title,
	titleKey,
	score,
	percentile,
	match,
	floor,
	from,
}: {
	position: number
	title: RowTitle | undefined
	titleKey: TitleKey
	/** -1 when unknown. */
	score: number
	/** Below 0 without a match. */
	percentile: number
	/** The match under the scale on the page; null without one. */
	match: number | null
	floor: number
	/** For the For you column: the title's place in the plain order. */
	from?: number
}) {
	const lifted = from !== undefined && from > position
	return (
		<li className="flex h-14 items-center gap-3 rounded-xl bg-white/[0.03] pr-3 text-sm ring-1 ring-white/5">
			<span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-500">
				{position}
			</span>
			<span className="h-12 w-8 shrink-0 overflow-hidden rounded bg-white/5">
				{title?.poster && (
					<img
						src={`${POSTER}${title.poster}`}
						alt=""
						loading="lazy"
						className="h-full w-full object-cover"
					/>
				)}
			</span>
			<span className="min-w-0 flex-1 truncate text-gray-100">
				{title?.title ?? titleKey}
				{title?.year && (
					<span className="ml-1.5 text-xs text-gray-500">{title.year}</span>
				)}
			</span>
			<span
				title="GoodWatch score"
				className={`w-8 shrink-0 text-right tabular-nums ${score >= floor ? "text-gray-200" : "text-gray-600"}`}
			>
				{score < 0 ? "–" : score}
			</span>
			<span
				title="Taste match as it was shown"
				className="w-11 shrink-0 text-right tabular-nums text-gray-500 line-through"
			>
				{match === null ? "" : `${oldMatch(percentile)}%`}
			</span>
			<span
				title={
					match === null
						? "No taste match"
						: `Taste match: top ${topShare(percentile)} of well-known titles`
				}
				className="w-11 shrink-0 text-right tabular-nums text-amber-300"
			>
				{match === null ? "–" : `${match}%`}
			</span>
			{from !== undefined && (
				<span
					title="Place in the plain order"
					className={`w-24 shrink-0 text-right text-xs tabular-nums ${lifted ? "text-amber-300" : "text-gray-500"}`}
				>
					{from === position ? "stayed" : `from ${from.toLocaleString("en")}`}
				</span>
			)}
		</li>
	)
}
