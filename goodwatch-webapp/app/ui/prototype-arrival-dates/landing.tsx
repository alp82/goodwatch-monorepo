// PROTOTYPE - throwaway (#625). Variation D of prototype C (#489), the landing page the owner chose, copied from
// ui/prototype-new-on-services/d-landing.tsx on branch ghostex/3fbfaf5b. The layout stays: one heading, the ten best
// ranked, the rest as small posters, links to every service and country. Only the words, the grouping, the labels
// and the note on freshness change with what the data can honestly say (see `Mode` and `When` in model.ts).
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { DISPLAY, WRAP, tmdbImage } from "~/ui/my-pages/bits"
import {
	Flag,
	Logo,
	type PageProps,
	PosterImage,
	Score,
	TitleLink,
	VisitorPrompt,
	WantMark,
} from "./bits"
import {
	type Arrival,
	COUNTRIES,
	type Choice,
	type CountryKey,
	DAILY_COUNTRIES,
	type Mode,
	SERVICES,
	STARTED_DAYS,
	WINDOW_DAYS,
	byScore,
	cadenceOf,
	countWords,
	dateWords,
	dayName,
	groupBy,
	isMember,
	listWords,
	modeOf,
	runtimeWords,
	serviceNames,
	servicesByCadence,
	tallyWords,
	wantedOf,
	wantedWords,
	whenStamp,
	whenWords,
} from "./model"

const TOP = 10
/** The day a weekly recheck has looked at every title twice, in the first-week case. */
const FIRST_WEEK_ENDS = STARTED_DAYS - 7

/** "New on Netflix today", "New on MUBI this week", "On Netflix since yesterday" for a wanted title. */
function WhenLine({ arrival }: { arrival: Arrival }) {
	const service = serviceNames(arrival.services)
	if (arrival.want)
		return (
			<span className="truncate text-sky-200">
				{wantedWords(arrival).landed}
			</span>
		)
	if (arrival.when.kind === "none")
		return <span className="truncate">On {service}</span>
	return (
		<span className="truncate">
			New on {service}{" "}
			{arrival.when.kind === "day" ? (
				<b className="font-bold text-gray-100">{whenWords(arrival.when)}</b>
			) : (
				whenWords(arrival.when)
			)}
		</span>
	)
}

function Ranked({ arrival, rank }: { arrival: Arrival; rank: number }) {
	const facts = [
		arrival.type === "movie" ? "Movie" : "Show",
		String(arrival.year),
		runtimeWords(arrival),
	].filter(Boolean)
	return (
		<li>
			<TitleLink
				arrival={arrival}
				className="group flex items-center gap-3 border-b border-white/[0.07] py-2.5 hover:bg-white/[0.04]"
			>
				<span
					className={`${DISPLAY} w-9 shrink-0 text-center text-3xl tabular-nums text-gray-600`}
				>
					{rank}
				</span>
				<span className="relative shrink-0">
					<PosterImage
						arrival={arrival}
						size="w154"
						className="h-24 w-16 rounded-md"
					/>
					{arrival.want && (
						<WantMark className="absolute -left-1.5 -top-1.5 h-6 w-6" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<b className="block truncate text-base text-white group-hover:text-amber-200">
						{arrival.title}
					</b>
					<span className="block truncate text-sm text-gray-400">
						{facts.join(" · ")}
					</span>
					<span
						className="mt-1 flex items-center gap-1.5 text-xs text-gray-400"
						data-when={arrival.when.kind}
					>
						{arrival.services.map((service) => (
							<Logo key={service} service={service} size={20} />
						))}
						<WhenLine arrival={arrival} />
					</span>
				</span>
				<Score score={arrival.score} className="h-9 min-w-11 text-base" />
			</TitleLink>
		</li>
	)
}

function RankedList({ arrivals }: { arrivals: Arrival[] }) {
	return (
		<ol className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-flow-col lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-rows-5">
			{arrivals.slice(0, TOP).map((arrival, index) => (
				<Ranked key={arrival.key} arrival={arrival} rank={index + 1} />
			))}
		</ol>
	)
}

/** Small posters, as below prototype C's ranked list. `stamp` adds the day or week under each title. */
function PosterGrid({
	arrivals,
	stamp = false,
	row = false,
}: { arrivals: Arrival[]; stamp?: boolean; row?: boolean }) {
	return (
		<ul
			className={
				row
					? "mt-2 flex flex-wrap gap-2"
					: "mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10"
			}
		>
			{arrivals.map((arrival) => (
				<li
					key={arrival.key}
					className={row ? "w-[calc(25%-6px)] sm:w-24 lg:w-[110px]" : ""}
				>
					<TitleLink arrival={arrival} className="group block">
						<span className="relative block">
							<PosterImage
								arrival={arrival}
								size="w185"
								className="block aspect-[2/3] w-full rounded-md ring-1 ring-white/10 group-hover:ring-amber-400/70"
							/>
							<Score
								score={arrival.score}
								className="absolute right-1 top-1 h-6 min-w-7 text-xs"
							/>
							{arrival.want && (
								<WantMark className="absolute -left-1 -top-1 h-6 w-6" />
							)}
						</span>
						<span className="mt-1 block truncate text-xs text-gray-300">
							{arrival.title}
						</span>
						{stamp && (
							<span
								className={`block truncate text-[11px] ${arrival.when.kind === "day" ? "font-bold text-gray-300" : "text-gray-500"}`}
							>
								{whenStamp(arrival.when)}
							</span>
						)}
					</TitleLink>
				</li>
			))}
		</ul>
	)
}

const H2 = ({ children }: { children: ReactNode }) => (
	<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{children}</h2>
)
const Sub = ({ children }: { children: ReactNode }) => (
	<p className="mt-1 text-sm text-gray-400">{children}</p>
)

/** Where the page looks, in words: "Netflix in Brazil", "your services". */
const scopeWords = (choice: Choice, services = choice.services) =>
	`${serviceNames(services)} ${COUNTRIES[choice.country].inThe}`

/** What the data allows the page to say about how fresh it is, in one line under the heading. */
function howLine(choice: Choice, mode: Mode) {
	const country = COUNTRIES[choice.country]
	if (mode === "daily")
		return `Updated every day. Last checked ${dateWords(0)}.`
	if (mode === "weekly")
		return choice.variant === "D"
			? `${country.inThe.replace(/^in/, "In")}, every title is checked once a week, so no day is given.`
			: "Every title is checked once a week, so no day is given."
	if (mode === "none") return `Checked on ${dateWords(0)}, 2026.`
	if (choice.variant === "E")
		return "Popular titles are checked daily, the rest once a week."
	const { daily, weekly } = servicesByCadence(choice)
	return `${serviceNames(daily)} ${daily.length > 1 ? "are" : "is"} checked daily, ${serviceNames(weekly)} once a week.`
}

/** The first-week case: why the page holds so little. Said where the eye lands, under the heading. */
function FirstWeek({ choice, mode }: { choice: Choice; mode: Mode }) {
	const started = dateWords(STARTED_DAYS)
	const { daily, weekly } =
		choice.variant === "E" || mode === "none"
			? { daily: choice.services, weekly: [] }
			: servicesByCadence(choice)
	return (
		<div
			className="max-w-2xl rounded-xl bg-gray-950/60 p-3 text-sm leading-relaxed text-gray-200 ring-1 ring-white/15"
			data-first-week
		>
			{daily.length > 0 && (
				<p>
					GoodWatch started checking {scopeWords(choice, daily)}{" "}
					{choice.variant === "E" ? "" : "every day "}on {started}. Titles that
					were there before are not listed as new.
				</p>
			)}
			{weekly.length > 0 && (
				<p className={daily.length ? "mt-1" : ""}>
					GoodWatch started checking {scopeWords(choice, weekly)} on {started}.
					Each title is checked once a week, so the first new titles show here
					on {dateWords(FIRST_WEEK_ENDS)}.
				</p>
			)}
			{choice.variant === "E" && (
				<p className="mt-1">
					Popular titles are checked daily and show from today. The rest are
					checked once a week and show from {dateWords(FIRST_WEEK_ENDS)}.
				</p>
			)}
			{choice.viewer === "member" && (
				<p className="mt-1 text-sky-200">
					What you want to see was checked every day already, so it shows.
				</p>
			)}
		</div>
	)
}

/** What a member waited for, in the place of the heading. */
function Waited({ wanted, mode }: { wanted: Arrival[]; mode: Mode }) {
	const [first, ...others] = wanted
	const words = wantedWords(first)
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
			<div>
				<p className="flex items-center gap-2 text-sm font-bold text-sky-200">
					<span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
					New on your services
				</p>
				<h1
					className={`${DISPLAY} mt-1 text-4xl text-white md:text-6xl`}
					data-heading
				>
					{first.title} is now on {SERVICES[first.services[0]].name}
				</h1>
				<p className="mt-2 text-base text-gray-200">
					{words.lead} it
					{mode !== "daily" && ", so GoodWatch checks it every day"}.{" "}
					{words.landed}.{words.episode && ` ${words.episode}.`}
				</p>
				<TitleLink
					arrival={first}
					className="mt-4 inline-flex h-11 items-center gap-1 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-sm font-black text-gray-950 hover:brightness-110"
				>
					{first.title}
					<ChevronRightIcon className="h-4 w-4" aria-hidden />
				</TitleLink>
			</div>
			{others.length > 0 && (
				<div className="rounded-2xl bg-gray-950/70 p-3 ring-1 ring-sky-300/25 backdrop-blur">
					<h2 className="px-1 text-xs font-black uppercase tracking-[0.18em] text-sky-300">
						Also landed
					</h2>
					<ul className="mt-1 grid grid-cols-[minmax(0,1fr)]">
						{others.map((arrival) => {
							const also = wantedWords(arrival)
							return (
								<li key={arrival.key}>
									<TitleLink
										arrival={arrival}
										className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-white/[0.07]"
									>
										<PosterImage
											arrival={arrival}
											size="w92"
											className="h-14 w-[38px] shrink-0 rounded"
										/>
										<span className="min-w-0 flex-1">
											<b className="block truncate text-sm text-white">
												{arrival.title}
											</b>
											<span className="block truncate text-xs text-sky-200">
												{also.landed}
												{also.episode && ` · ${also.episode}`}
											</span>
										</span>
										<Logo service={arrival.services[0]} size={24} />
									</TitleLink>
								</li>
							)
						})}
					</ul>
				</div>
			)}
		</div>
	)
}

/** Nothing to list: nothing arrived, or the first week of a weekly recheck has not ended. */
function Nothing({ choice, mode, href }: PageProps & { mode: Mode }) {
	const country = COUNTRIES[choice.country]
	const all = choice.services.length === country.services.length
	const waiting = choice.data === "first" && mode === "weekly"
	const first = choice.data === "first"
	return (
		<div
			className="rounded-2xl border border-dashed border-white/15 p-6"
			data-empty
		>
			<h2 className={`${DISPLAY} text-2xl text-white`}>
				{waiting
					? "Nothing to show yet"
					: first
						? `Nothing new since ${dateWords(STARTED_DAYS)}`
						: "Nothing new in the last two weeks"}
			</h2>
			<p className="mt-1 max-w-xl text-sm text-gray-400">
				{waiting
					? `The first weekly check of ${scopeWords(choice)} ends on ${dateWords(FIRST_WEEK_ENDS)}. From then, titles that arrived show here.`
					: `GoodWatch found no new movie or show on ${scopeWords(choice)} since it ${first ? "started checking" : "last looked"}.`}
				{isMember(choice.viewer) &&
					" When a title you want to see lands, My movies and My shows tell you."}
			</p>
			{!all && (
				<Link
					to={href({ services: "" })}
					prefetch="none"
					className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-white/[0.06] px-4 py-2 text-left text-sm font-bold text-gray-100 ring-1 ring-white/10 hover:ring-white/25"
				>
					Look at every service {country.inThe}
				</Link>
			)}
		</div>
	)
}

/** How fresh the list is: what the data allows, said once and plainly. */
function Fresh({ choice, mode }: { choice: Choice; mode: Mode }) {
	const where = scopeWords(choice)
	const member = isMember(choice.viewer)
	const { daily, weekly } = servicesByCadence(choice)
	const parts: string[] = []
	if (mode === "daily")
		parts.push(
			`Every day GoodWatch compares the titles on ${where} with the day before. A title shows on the day it first appears in that list, which can be one day after the service added it.`,
		)
	if (mode === "weekly")
		parts.push(
			`GoodWatch checks every title on ${where} once a week. "This week" means it found the title in the last 7 days, "last week" 7 to 14 days ago. A title may have arrived a few days before it was found, so the page does not say a day.`,
		)
	if (mode === "mixed" && choice.variant === "E")
		parts.push(
			`Titles many people look at are checked every day and show the day they arrived. The others are checked once a week and say "this week" or "last week". The list is ranked by score either way.`,
		)
	if (mode === "mixed" && choice.variant !== "E")
		parts.push(
			`${serviceNames(daily)} ${daily.length > 1 ? "are" : "is"} checked every day, so ${daily.length > 1 ? "their" : "its"} titles show the day they arrived. ${serviceNames(weekly)} ${weekly.length > 1 ? "have" : "has"} fewer titles and ${weekly.length > 1 ? "are" : "is"} checked once a week, so ${weekly.length > 1 ? "their" : "its"} titles say "this week" or "last week".`,
		)
	if (mode === "none")
		parts.push(
			`It holds what GoodWatch found on ${where} in the last ${WINDOW_DAYS} days, best score first. It does not say on which day a title arrived.`,
		)
	if (choice.variant === "D")
		parts.push(
			`GoodWatch checks every day in ${listWords(DAILY_COUNTRIES.map((c) => COUNTRIES[c].inThe.replace(/^in /, "")))}, and once a week in other countries.`,
		)
	parts.push(
		member
			? "Titles you want to see are checked every day, so their day is exact."
			: "A title a member wants to see is checked every day, so its day is exact.",
	)
	return (
		<section className="max-w-2xl" aria-labelledby="fresh-heading" data-fresh>
			<h2 id="fresh-heading" className={`${DISPLAY} text-xl text-white`}>
				How fresh is this list?
			</h2>
			{parts.map((part) => (
				<p key={part} className="mt-1 text-sm leading-relaxed text-gray-400">
					{part}
				</p>
			))}
		</section>
	)
}

/** The list, grouped the way the data allows. */
function Body({ choice, arrivals, mode }: PageProps & { mode: Mode }) {
	const personal = isMember(choice.viewer) && choice.saved
	const country = COUNTRIES[choice.country]
	const ranked = byScore(arrivals)
	const where = `${personal ? "on your services" : `on ${serviceNames(choice.services)}`} ${country.inThe}`
	const heading =
		ranked.length > TOP
			? `The ${TOP} best new arrivals`
			: ranked.length === 1
				? "The one new arrival"
				: `The ${ranked.length} new arrivals, best first`

	if (mode === "weekly") {
		const thisWeek = ranked.filter((a) => a.days < 7)
		const lastWeek = ranked.filter((a) => a.days >= 7)
		return (
			<>
				{thisWeek.length > 0 && (
					<section data-ranked data-week="0">
						<H2>New this week</H2>
						<Sub>
							Found in the last 7 days {where}, best GoodWatch score first.
						</Sub>
						<RankedList arrivals={thisWeek} />
						{thisWeek.length > TOP && (
							<div className="mt-6">
								<h3 className={`${DISPLAY} text-xl text-white`}>
									{thisWeek.length - TOP} more this week
								</h3>
								<PosterGrid arrivals={thisWeek.slice(TOP)} />
							</div>
						)}
					</section>
				)}
				{lastWeek.length > 0 && (
					<section data-week="1">
						<H2>Last week</H2>
						<Sub>Found 7 to 14 days ago, best first.</Sub>
						<PosterGrid arrivals={lastWeek} />
					</section>
				)}
			</>
		)
	}

	return (
		<>
			<section data-ranked>
				<H2>{heading}</H2>
				<Sub>
					By GoodWatch score, {where}.
					{mode === "daily" && " Each says the day it arrived."}
					{mode === "mixed" &&
						choice.variant === "E" &&
						" Popular titles say their day, the others their week."}
					{mode === "mixed" &&
						choice.variant !== "E" &&
						` Titles on ${serviceNames(servicesByCadence(choice).weekly)} say their week.`}
				</Sub>
				<RankedList arrivals={ranked} />
			</section>
			{choice.viewer === "visitor" && <VisitorPrompt className="max-w-xl" />}
			{mode === "daily" && ranked.length > 1 && (
				<section data-days>
					<H2>Day by day</H2>
					<Sub>Every arrival, the latest first.</Sub>
					<div className="mt-1 flex flex-wrap gap-x-8">
						{groupBy(arrivals, (a) => a.days).map(([days, list]) => (
							<div key={days} className="mt-4 w-full sm:w-auto" data-day={days}>
								<h3 className={`${DISPLAY} text-lg text-white`}>
									{dayName(days)}{" "}
									<span className="text-sm font-bold tracking-normal text-gray-500">
										{list.length}
									</span>
								</h3>
								<PosterGrid arrivals={byScore(list)} row />
							</div>
						))}
					</div>
				</section>
			)}
			{mode !== "daily" && ranked.length > TOP && (
				<section data-rest>
					<H2>{ranked.length - TOP} more</H2>
					<PosterGrid arrivals={ranked.slice(TOP)} stamp={mode === "mixed"} />
				</section>
			)}
		</>
	)
}

export function Landing(props: PageProps) {
	const { choice, arrivals, seo, href } = props
	const mode = modeOf(choice)
	// In the first week the page has not looked back 14 days: it counts from the day it started.
	const tally =
		choice.data !== "first"
			? tallyWords(arrivals, mode)
			: arrivals.length
				? `${countWords(arrivals)} since ${dateWords(STARTED_DAYS)}`
				: "Nothing new yet"
	const country = COUNTRIES[choice.country]
	const wanted = wantedOf(arrivals)
	const ranked = byScore(arrivals)
	const lead = wanted[0] ?? ranked[0]
	const personal = isMember(choice.viewer) && choice.saved
	const one = choice.services.length === 1 ? choice.services[0] : null
	const all = choice.services.length === country.services.length
	const crumbs: [string, string | null][] = [
		["Home", "/"],
		[
			personal ? "New on your services" : "New on streaming",
			personal ? null : href({ services: "" }),
		],
		...(personal
			? []
			: ([
					[country.name, one ? href({ services: "" }) : null],
					...(one ? [[SERVICES[one].name, null]] : []),
				] as [string, string | null][])),
	]
	return (
		<div className="pb-28" data-variant={choice.variant} data-mode={mode}>
			<section className="relative overflow-hidden border-b border-white/[0.07]">
				{lead && (
					<img
						src={tmdbImage(lead.backdrop, "w1280")}
						alt=""
						className="absolute inset-0 h-full w-full object-cover object-top opacity-40"
					/>
				)}
				<span className="absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/80 to-gray-900/50" />
				<div className={`${WRAP} relative flex flex-col gap-5 pb-7 pt-4`}>
					<nav
						aria-label="Breadcrumb"
						className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-300"
					>
						{crumbs.map(([label, to], index) => (
							<span key={label} className="flex items-center gap-1.5">
								{index > 0 && (
									<ChevronRightIcon
										className="h-4 w-4 text-gray-500"
										aria-hidden
									/>
								)}
								{to ? (
									<Link
										to={to}
										prefetch="none"
										className="hover:text-white hover:underline"
									>
										{label}
									</Link>
								) : (
									<span className="text-amber-400">{label}</span>
								)}
							</span>
						))}
					</nav>
					{wanted.length > 0 ? (
						<Waited wanted={wanted} mode={mode} />
					) : (
						<h1
							className={`${DISPLAY} flex flex-wrap items-center gap-x-4 gap-y-2 text-5xl text-white md:text-7xl`}
							data-heading
						>
							{one && <Logo service={one} size={56} className="rounded-2xl" />}
							{seo.heading}
						</h1>
					)}
					<p
						className="-mt-2 flex flex-wrap items-center gap-x-2 text-base text-gray-200"
						data-how
					>
						<Flag country={choice.country} />
						{personal
							? `${serviceNames(choice.services)}. ${tally}.`
							: `${tally}.`}{" "}
						<span className="text-gray-400">{howLine(choice, mode)}</span>
					</p>
					{choice.data === "first" && <FirstWeek choice={choice} mode={mode} />}
					{/* Each service is a page of its own, so each key is a link. */}
					<nav aria-label="Services" className="flex flex-wrap gap-2">
						{!personal && (
							<Link
								to={href({ services: "" })}
								prefetch="none"
								preventScrollReset
								aria-current={all ? "page" : undefined}
								className={`flex h-10 items-center rounded-xl px-3 text-sm font-bold ring-1 ${all ? "bg-white text-black ring-white" : "bg-gray-950/60 text-gray-200 ring-white/15 hover:ring-white/40"}`}
							>
								Every service
							</Link>
						)}
						{(personal ? choice.services : country.services).map((service) => {
							const on = one === service
							const weekly =
								choice.variant === "C" &&
								cadenceOf("C", choice.country, service) === "weekly"
							return (
								<Link
									key={service}
									to={href({ services: service })}
									prefetch="none"
									preventScrollReset
									data-service-link={service}
									aria-current={on ? "page" : undefined}
									className={`flex h-10 items-center gap-2 rounded-xl pl-1.5 pr-3 text-sm font-bold ring-1 ${on ? "bg-white text-black ring-white" : "bg-gray-950/60 text-gray-200 ring-white/15 hover:ring-white/40"}`}
								>
									<Logo service={service} />
									{SERVICES[service].name}
									{weekly && (
										<span
											className={`text-xs font-semibold ${on ? "text-gray-600" : "text-gray-400"}`}
										>
											weekly
										</span>
									)}
								</Link>
							)
						})}
					</nav>
				</div>
			</section>
			<div className={`${WRAP} flex flex-col gap-10 pt-7`}>
				{arrivals.length === 0 ? (
					<Nothing {...props} mode={mode} />
				) : (
					<Body {...props} mode={mode} />
				)}
				<Fresh choice={choice} mode={mode} />
				{!personal && (
					<section data-elsewhere>
						<h2 className={`${DISPLAY} text-xl text-white`}>
							New in other countries
						</h2>
						<ul className="mt-2 flex flex-wrap gap-2">
							{(Object.keys(COUNTRIES) as CountryKey[])
								.filter((key) => key !== choice.country)
								.map((key) => (
									<li key={key}>
										<Link
											to={href({ country: key })}
											prefetch="none"
											data-country-link={key}
											className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 hover:ring-white/30"
										>
											<Flag country={key} />
											{one && COUNTRIES[key].services.includes(one)
												? `New on ${SERVICES[one].name} ${COUNTRIES[key].inThe}`
												: `New on streaming ${COUNTRIES[key].inThe}`}
											{choice.variant === "D" && (
												<span className="text-xs font-semibold text-gray-400">
													{DAILY_COUNTRIES.includes(key) ? "daily" : "weekly"}
												</span>
											)}
										</Link>
									</li>
								))}
						</ul>
					</section>
				)}
			</div>
		</div>
	)
}
