// You vs everyone: where the person's ratings part ways with the GoodWatch score ("everyone"). Each title shows both
// scores on one line, so the gap is the story.
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import {
	ALL_TITLE_TYPES,
	type TitleTypeFilter,
	isAllTitleTypes,
	passesTitleType,
} from "~/domain/title-type"
import type {
	EveryoneRow,
	EveryoneView,
	PortraitTitle,
} from "~/server/taste-portrait/view"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { NoTitlesOfType, TypeFilter } from "~/ui/type-filter"
import {
	type Titles,
	YourScore,
	article,
	backdropUrl,
	lowerFirst,
	posterUrl,
	titleHref,
	vibe,
} from "./parts"

const PAGE = 8
const MOST = 30
/** Attributes named in the lead only from this gap on. */
const NAMED_GAP = 3

function Ring({
	t,
	size,
	label = false,
}: { t: PortraitTitle; size: number; label?: boolean }) {
	return (
		<ScoreRing
			media={
				{
					details: { goodwatch_overall_score_normalized_percent: t.score },
				} as Parameters<typeof ScoreRing>[0]["media"]
			}
			size={size}
			label={label}
		/>
	)
}

export function YouVsEveryone({ view }: { view: EveryoneView }) {
	// The type filter stays on the page: the lists are already here, so it isn't in the URL.
	const [type, setType] = useState<TitleTypeFilter>(ALL_TITLE_TYPES)
	const [n, setN] = useState(PAGE)
	const keep = (row: EveryoneRow) => {
		const t = view.titles[row.key]
		return !!t && passesTitleType(type, t)
	}
	const allHigher = view.higher.filter(keep)
	const allLower = view.lower.filter(keep)
	const higher = allHigher.slice(0, n)
	const lower = allLower.slice(0, n)
	const warm = view.attributes.filter((a) => a.delta >= NAMED_GAP)
	const cold = view.attributes.filter((a) => a.delta <= -NAMED_GAP).reverse()
	const hot = higher[0] && view.titles[higher[0].key]
	const colder = lower[0] && view.titles[lower[0].key]
	const gaps = [...view.genres, ...view.attributes].sort(
		(a, b) => b.delta - a.delta,
	)
	const more = n < MOST && (allHigher.length > n || allLower.length > n)
	const filtered = !isAllTitleTypes(type)
	const none = filtered ? (
		<NoTitlesOfType value={type} onReset={setType} where="on this side" />
	) : (
		"None of these in what you've rated."
	)

	return (
		<>
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-16">
				<p className="text-lg font-semibold text-amber-300">
					You and everyone else
				</p>
				<h1 className="mt-2 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
					{view.headline}
				</h1>
				<p className="mt-4 max-w-3xl text-lg text-gray-300 md:text-xl">
					{hot && (
						<>
							You gave{" "}
							<span className="font-semibold text-white">{hot.title}</span>{" "}
							{article(higher[0].mine)} {higher[0].mine} when the crowd
							shrugged.{" "}
						</>
					)}
					{colder && (
						<>
							Everyone loves{" "}
							<span className="font-semibold text-white">{colder.title}</span>.
							You gave it {article(lower[0].mine)} {lower[0].mine}.
						</>
					)}
				</p>
				{(warm.length > 0 || cold.length > 0) && (
					<p className="mt-3 max-w-3xl text-gray-400">
						{warm.length > 0 && (
							<>
								You're warmer than the crowd on{" "}
								{warm
									.slice(0, 3)
									.map((a) => lowerFirst(a.name))
									.join(", ")}
								.{" "}
							</>
						)}
						{cold.length > 0 && (
							<>
								You're colder on{" "}
								{cold
									.slice(0, 3)
									.map((a) => lowerFirst(a.name))
									.join(", ")}
								.
							</>
						)}
					</p>
				)}
				<div className="mt-8 flex flex-wrap items-center gap-2">
					<TypeFilter value={type} onChange={setType} />
					<span className="ml-auto flex items-center gap-4 text-xs text-gray-400">
						<span className="flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-full border-2 border-gray-300" />{" "}
							GoodWatch score
						</span>
						<span className="flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-sm bg-emerald-600" /> Your score
						</span>
					</span>
				</div>
			</section>

			{filtered && !higher.length && !lower.length ? (
				<p className="mx-auto mt-8 max-w-7xl px-4 text-gray-400 md:px-8">
					<NoTitlesOfType
						value={type}
						onReset={setType}
						where="where you and everyone part ways"
					/>
				</p>
			) : (
				<section className="mx-auto mt-8 grid max-w-7xl gap-10 px-4 md:grid-cols-2 md:px-8">
					<Column
						titles={view.titles}
						title="You rate higher than everyone"
						rows={higher}
						tone="up"
						none={none}
					/>
					<Column
						titles={view.titles}
						title="You rate lower than everyone"
						rows={lower}
						tone="down"
						none={none}
					/>
				</section>
			)}
			{more && (
				<div className="mx-auto mt-6 max-w-7xl px-4 md:px-8">
					<button
						type="button"
						onClick={() => setN((x) => Math.min(MOST, x + PAGE))}
						className="min-h-11 cursor-pointer text-sm font-semibold text-amber-300 underline underline-offset-4 md:min-h-0"
					>
						Show more
					</button>
				</div>
			)}

			{gaps.length > 0 && (
				<section className="mx-auto mt-14 max-w-7xl px-4 md:px-8">
					<h2 className="text-2xl font-bold md:text-3xl">
						Where you and the crowd part ways
					</h2>
					<p className="mt-1 text-gray-400">
						Average gap between your score and the GoodWatch score, after
						allowing for how generous you are overall.
					</p>
					<div className="mt-6 grid gap-x-10 gap-y-3 md:grid-cols-2">
						{gaps.map((gap) => (
							<div
								key={gap.id}
								className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm"
							>
								<span className="truncate text-gray-200">{gap.name}</span>
								<span className="relative h-2 rounded-full bg-gray-800">
									<span className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
									<span
										className={`absolute inset-y-0 rounded-full ${gap.delta > 0 ? "bg-emerald-500" : "bg-rose-500"}`}
										style={
											gap.delta > 0
												? {
														left: "50%",
														width: `${Math.min(50, gap.delta * 5)}%`,
													}
												: {
														right: "50%",
														width: `${Math.min(50, -gap.delta * 5)}%`,
													}
										}
									/>
								</span>
								<span
									className={`text-right font-bold tabular-nums ${gap.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
								>
									{gap.delta > 0 ? "+" : ""}
									{gap.delta}
								</span>
							</div>
						))}
					</div>
				</section>
			)}
		</>
	)
}

function Column({
	titles,
	title,
	rows,
	tone,
	none,
}: {
	titles: Titles
	title: string
	rows: EveryoneRow[]
	tone: "up" | "down"
	/** What the column says when it has no rows. */
	none: ReactNode
}) {
	const [lead, ...rest] = rows
	const lt = lead && titles[lead.key]
	return (
		<div className="min-w-0">
			<h2
				className={`mb-4 text-xl font-bold ${tone === "up" ? "text-emerald-300" : "text-rose-300"}`}
			>
				{title}
			</h2>
			{!lt && <p className="text-sm text-gray-400">{none}</p>}
			{lt && (
				<Link
					to={titleHref(lt)}
					className="relative isolate mb-4 block overflow-hidden rounded-2xl border border-gray-800 hover:border-gray-600"
				>
					{lt.backdrop && (
						<img
							src={backdropUrl(lt, "w780")}
							alt=""
							className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
						/>
					)}
					<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
					<div className="flex items-end gap-4 p-4 md:gap-5 md:p-5">
						<img
							src={posterUrl(lt)}
							alt={`Poster for ${lt.title}`}
							className="w-20 shrink-0 rounded-lg border-2 border-gray-700 sm:w-28 md:w-32"
						/>
						<div className="min-w-0 pb-1">
							<p className="text-xl font-bold leading-tight md:text-2xl">
								{lt.title}{" "}
								{lt.year && (
									<span className="font-normal text-gray-400">({lt.year})</span>
								)}
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-3 md:mt-4 md:gap-4">
								<YourScore score={lead.mine} size="lg" label="You" />
								<Ring t={lt} size={48} label />
							</div>
							<p className="mt-3 text-sm text-gray-300">
								{tone === "up"
									? `${lead.delta} points above the crowd, after your usual generosity.`
									: `${-lead.delta} points below the crowd, after your usual generosity.`}
							</p>
						</div>
					</div>
				</Link>
			)}
			<ul className="space-y-3">
				{rest.map((row) => {
					const t = titles[row.key]
					if (!t) return null
					const mine = row.mine * 10
					const lo = Math.min(mine, row.everyone)
					const hi = Math.max(mine, row.everyone)
					return (
						<li key={row.key}>
							<Link
								to={titleHref(t)}
								className="grid grid-cols-[3.5rem_1fr] gap-4 rounded-xl border border-gray-800 bg-gray-950/60 p-2 pr-4 hover:border-gray-600"
							>
								<img
									src={posterUrl(t, "w185")}
									alt=""
									className="aspect-[2/3] w-14 rounded-md object-cover"
									loading="lazy"
								/>
								<div className="min-w-0 self-center">
									<div className="flex items-center justify-between gap-3">
										<p className="truncate font-semibold">
											{t.title}{" "}
											{t.year && (
												<span className="font-normal text-gray-400">
													({t.year})
												</span>
											)}
										</p>
										<span className="flex shrink-0 items-center gap-2">
											<YourScore score={row.mine} size="sm" />
											<Ring t={t} size={30} />
										</span>
									</div>
									<div className="relative mt-3 h-4" aria-hidden>
										<span className="absolute inset-x-0 top-1/2 h-px bg-gray-700" />
										<span
											className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25"
											style={{ left: `${lo}%`, width: `${hi - lo}%` }}
										/>
										<span
											className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-300 bg-gray-900"
											style={{ left: `${row.everyone}%` }}
										/>
										<span
											className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm"
											style={{ left: `${mine}%`, background: vibe(row.mine) }}
										/>
									</div>
								</div>
							</Link>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
