// PROTOTYPE - throwaway (#489, prototype C). Variation D, "Landing page": the page someone lands on from a search
// for "new on Netflix". One heading that answers the search, a ranked list of the ten best arrivals with their
// scores, the rest as small posters, and links to every other service and country, each a page of its own. It bets
// on search traffic and on a short answer over a full list. A member gets the same page with what they waited for
// in the place of the heading.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { DISPLAY, WRAP, tmdbImage } from "~/ui/my-pages/bits"
import {
	Flag,
	Logo,
	Nothing,
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
	type CountryKey,
	SERVICES,
	WINDOW_DAYS,
	byScore,
	dateWords,
	isMember,
	runtimeWords,
	serviceNames,
	wantedOf,
	wantedWords,
} from "./model"

const TOP = 10

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
					<span className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
						{arrival.services.map((service) => (
							<Logo key={service} service={service} size={20} />
						))}
						<span className="truncate">
							{arrival.want
								? wantedWords(arrival).landed
								: `On ${serviceNames(arrival.services)}`}
						</span>
					</span>
				</span>
				<Score score={arrival.score} className="h-9 min-w-11 text-base" />
			</TitleLink>
		</li>
	)
}

/** What a member waited for, in the place of the heading. */
function Waited({ wanted }: { wanted: Arrival[] }) {
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
					{words.lead} it. {words.landed}.
					{words.episode && ` ${words.episode}.`}
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

export function VariantD(props: PageProps) {
	const { choice, arrivals, seo, href } = props
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
		<div className="pb-28" data-variant="D">
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
						<Waited wanted={wanted} />
					) : (
						<div>
							<h1
								className={`${DISPLAY} flex flex-wrap items-center gap-x-4 gap-y-2 text-5xl text-white md:text-7xl`}
								data-heading
							>
								{one && (
									<Logo service={one} size={56} className="rounded-2xl" />
								)}
								{seo.heading}
							</h1>
							<p className="mt-3 flex flex-wrap items-center gap-x-2 text-base text-gray-200">
								<Flag country={choice.country} />
								{personal ? seo.line : `${seo.line}.`}{" "}
								<span className="text-gray-400">
									Checked on {dateWords(0)} 2026.
								</span>
							</p>
						</div>
					)}
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
								</Link>
							)
						})}
					</nav>
				</div>
			</section>
			<div className={`${WRAP} flex flex-col gap-10 pt-7`}>
				{arrivals.length === 0 ? (
					<Nothing {...props} />
				) : (
					<>
						<section data-ranked>
							<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
								{ranked.length > TOP
									? `The ${TOP} best new arrivals`
									: ranked.length === 1
										? "The one new arrival"
										: `The ${ranked.length} new arrivals, best first`}
							</h2>
							<p className="mt-1 text-sm text-gray-400">
								By GoodWatch score, {personal ? "on your services" : "on"}{" "}
								{!personal && serviceNames(choice.services)} {country.inThe}.
							</p>
							<ol className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-flow-col lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-rows-5">
								{ranked.slice(0, TOP).map((arrival, index) => (
									<Ranked
										key={arrival.key}
										arrival={arrival}
										rank={index + 1}
									/>
								))}
							</ol>
						</section>
						{choice.viewer === "visitor" && (
							<VisitorPrompt className="max-w-xl" />
						)}
						{ranked.length > TOP && (
							<section data-rest>
								<h2 className={`${DISPLAY} text-2xl text-white`}>
									{ranked.length - TOP} more
								</h2>
								<ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
									{ranked.slice(TOP).map((arrival) => (
										<li key={arrival.key}>
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
												</span>
												<span className="mt-1 block truncate text-xs text-gray-300">
													{arrival.title}
												</span>
											</TitleLink>
										</li>
									))}
								</ul>
							</section>
						)}
					</>
				)}
				{choice.viewer !== "visitor" && arrivals.length === 0 ? null : (
					<section
						className="max-w-2xl"
						aria-labelledby="fresh-heading"
						data-fresh
					>
						<h2 id="fresh-heading" className={`${DISPLAY} text-xl text-white`}>
							How fresh is this list?
						</h2>
						<p className="mt-1 text-sm leading-relaxed text-gray-400">
							It holds what GoodWatch found on a service in the last{" "}
							{WINDOW_DAYS} days. Every title is checked at least once in two
							weeks, so a title here arrived at some point in the last{" "}
							{WINDOW_DAYS * 2} days. A title a member wants to see is checked
							every day.
						</p>
					</section>
				)}
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
											to={href({ country: key, services: "" })}
											prefetch="none"
											data-country-link={key}
											className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 hover:ring-white/30"
										>
											<Flag country={key} />
											New on streaming {COUNTRIES[key].inThe}
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
