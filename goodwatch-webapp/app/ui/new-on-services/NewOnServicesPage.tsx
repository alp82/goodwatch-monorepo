// "New on your services" (#489 Part C): one page for /new/us/netflix, /new/us and the member's /new. The layout is
// prototype C's variation D (branch ghostex/3fbfaf5b, docs/prototypes/new-on-services/): a heading that answers the
// search, the ten best arrivals ranked, then every arrival day by day (#625, variation A), the latest first, and
// links to the other services and countries. A member's own page leads with what they waited for. Everything is in
// the server HTML, with the sizes of its images reserved, so nothing moves after the first paint.
import { ChevronRightIcon, InformationCircleIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	dateWords,
	dayHeading,
	inCountry,
	waitedWords,
} from "~/domain/new-on-services"
import type {
	NewPageData,
	NewTitle,
} from "~/server/new-on-services-page.server"
import { TmdbImage } from "~/ui/TmdbImage"
import ShareButton from "~/ui/button/ShareButton"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { Flag, Logo, PosterRow, RankedRow, Sub } from "./parts"

/** The page's trail, for the visible breadcrumb and the BreadcrumbList. */
export function crumbsOf(data: NewPageData): Crumb[] {
	const home = { label: "Home", path: "/" }
	if (data.kind === "member")
		return [home, { label: "New on your services", path: "/new" }]
	const country = {
		label: `New ${inCountry(data.country.name)}`,
		path: `/new/${data.country.code.toLowerCase()}`,
	}
	return data.kind === "country" || !data.brand
		? [home, country]
		: [home, country, { label: data.brand.name, path: data.path }]
}

function Crumbs({ data }: { data: NewPageData }) {
	const crumbs = crumbsOf(data)
	return (
		<nav aria-label="Breadcrumb">
			<ol className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-300">
				{crumbs.map((crumb, index) => (
					<li key={crumb.path} className="flex items-center gap-1.5">
						{index > 0 && (
							<ChevronRightIcon className="h-4 w-4 text-gray-500" aria-hidden />
						)}
						{index === crumbs.length - 1 ? (
							<span aria-current="page" className="text-amber-400">
								{crumb.label}
							</span>
						) : (
							<Link to={crumb.path} className="hover:text-white hover:underline">
								{crumb.label}
							</Link>
						)}
					</li>
				))}
			</ol>
		</nav>
	)
}

/** What a member waited for, in the place of the heading. */
function Waited({ data }: { data: NewPageData }) {
	const [first, ...others] = data.waited
	const name = (title: NewTitle) =>
		data.services[title.service]?.name ?? "your services"
	const words = waitedWords(first, first.wait, name(first), data.now)
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
			<div>
				<p className="flex items-center gap-2 text-sm font-bold text-sky-200">
					<span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
					New on your services
				</p>
				<h1 className={`${DISPLAY} mt-1 text-4xl text-white md:text-6xl`}>
					{first.title} is now on {name(first)}
				</h1>
				<p className="mt-2 text-base text-gray-200">
					{/* Without an exact day, the heading already says all there is. */}
					{words.lead}.{first.exact && ` ${words.landed}.`}
				</p>
				<Link
					to={first.path}
					prefetch="intent"
					className="mt-4 inline-flex h-11 items-center gap-1 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-sm font-black text-gray-950 hover:brightness-110"
				>
					{first.title}
					<ChevronRightIcon className="h-4 w-4" aria-hidden />
				</Link>
			</div>
			{others.length > 0 && (
				<div className="rounded-2xl bg-gray-950/85 p-3 ring-1 ring-sky-300/25">
					<h2 className="px-1 text-xs font-black uppercase tracking-[0.18em] text-sky-300">
						Also landed
					</h2>
					<ul className="mt-1 grid grid-cols-[minmax(0,1fr)]">
						{others.slice(0, 4).map((title) => (
							<li key={title.key}>
								<Link
									to={title.path}
									prefetch="intent"
									className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-white/[0.07]"
								>
									{title.poster_path ? (
										<TmdbImage
											kind="poster"
											path={title.poster_path}
											width={38}
											className="h-14 w-[38px] shrink-0 rounded bg-white/5 object-cover"
										/>
									) : (
										<span className="block h-14 w-[38px] shrink-0 rounded bg-white/10" />
									)}
									<span className="min-w-0 flex-1">
										<b className="block truncate text-sm text-white">
											{title.title}
										</b>
										<span className="block truncate text-xs text-sky-200">
											{waitedWords(title, title.wait, name(title), data.now).landed}
										</span>
									</span>
									<Logo service={data.services[title.service]} size={24} />
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

/** The line under the heading: the count, and when the data was last updated, behind an info icon. */
function HowLine({ data }: { data: NewPageData }) {
	const mine =
		data.kind === "member"
			? Object.values(data.services)
					.map((service) => service.name)
					.join(", ")
			: null
	return (
		<p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-gray-200">
			<Flag country={data.country.code} />
			<span>
				{mine ? `${mine} ${inCountry(data.country.name)}. ` : ""}
				{data.copy.tally}.
			</span>
			{data.updatedAt && (
				<span
					className="inline-flex items-center gap-1 text-sm text-gray-400"
					title={`Last updated ${new Date(data.updatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC`}
				>
					<InformationCircleIcon className="h-4 w-4" aria-hidden />
					Updated {dateWords(data.updatedAt)}
				</span>
			)}
		</p>
	)
}

const KEY =
	"flex h-10 items-center rounded-xl text-sm font-bold ring-1 transition-colors"
const KEY_ON = "bg-white text-black ring-white"
const KEY_OFF = "bg-gray-950/60 text-gray-200 ring-white/15 hover:ring-white/40"

/** Each service is a page of its own, so each key is a link. */
function ServiceKeys({ data }: { data: NewPageData }) {
	const country = data.country.code.toLowerCase()
	return (
		<nav aria-label="Services" className="flex flex-wrap gap-2">
			{data.kind !== "member" && (
				<Link
					to={`/new/${country}`}
					prefetch="intent"
					aria-current={data.kind === "country" ? "page" : undefined}
					className={`${KEY} px-3 ${data.kind === "country" ? KEY_ON : KEY_OFF}`}
				>
					Every service
				</Link>
			)}
			{data.keys.map((key) => {
				const on = data.kind === "service" && data.brand?.slug === key.slug
				return (
					<Link
						key={key.path}
						to={key.path}
						prefetch="intent"
						aria-current={on ? "page" : undefined}
						className={`${KEY} gap-2 pl-1.5 pr-3 ${on ? KEY_ON : KEY_OFF}`}
					>
						<Logo service={key} />
						{key.name}
					</Link>
				)
			})}
			{data.kind === "member" && (
				<Link
					to="/settings/services"
					prefetch="intent"
					className="flex h-10 items-center px-2 text-sm font-bold text-amber-300 underline-offset-2 hover:underline"
				>
					Change services
				</Link>
			)}
		</nav>
	)
}

/** Nothing to list, said plainly, with a way on. */
function Nothing({ data }: { data: NewPageData }) {
	if (data.kind === "member" && !data.member?.hasServices)
		return (
			<div className="rounded-2xl border border-dashed border-white/15 p-6">
				<h2 className={`${DISPLAY} text-2xl text-white`}>
					Save your services to see what's new on them
				</h2>
				<p className="mt-1 max-w-xl text-sm text-gray-400">
					Pick the streaming services you have, and this page lists what
					arrived on them in the last 14 days.
				</p>
				<Link
					to="/settings/services"
					prefetch="intent"
					className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/10 hover:ring-white/25"
				>
					Choose your services
				</Link>
			</div>
		)
	const on =
		data.kind === "service" && data.brand ? data.brand.name : "these services"
	return (
		<div className="rounded-2xl border border-dashed border-white/15 p-6">
			<h2 className={`${DISPLAY} text-2xl text-white`}>{data.copy.tally}</h2>
			<p className="mt-1 max-w-xl text-sm text-gray-400">
				GoodWatch found no new movie or show on{" "}
				{data.kind === "member" ? "your services" : on}{" "}
				{inCountry(data.country.name)} in that time.
				{data.kind === "member" &&
					" When a title you want to see lands, My movies and My shows tell you."}
			</p>
			{data.kind === "service" && (
				<Link
					to={`/new/${data.country.code.toLowerCase()}`}
					prefetch="intent"
					className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/10 hover:ring-white/25"
				>
					Look at every service {inCountry(data.country.name)}
				</Link>
			)}
		</div>
	)
}

function Ranked({ data }: { data: NewPageData }) {
	const where =
		data.kind === "member"
			? "on your services"
			: `on ${data.brand ? data.brand.name : "streaming"}`
	const heading =
		data.total > data.ranked.length
			? `The ${data.ranked.length} best new arrivals`
			: data.total === 1
				? "The one new arrival"
				: `The ${data.total} new arrivals, best first`
	return (
		<section aria-labelledby="ranked-heading">
			<h2 id="ranked-heading" className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
				{heading}
			</h2>
			<Sub>
				By GoodWatch score, {where} {inCountry(data.country.name)}.
			</Sub>
			<ol className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-flow-col lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-rows-5">
				{data.ranked.map((title, index) => (
					<RankedRow
						key={title.key}
						title={title}
						rank={index + 1}
						data={data}
						eager={index < 4}
					/>
				))}
			</ol>
		</section>
	)
}

function DayByDay({ data }: { data: NewPageData }) {
	return (
		<section aria-labelledby="days-heading">
			<h2 id="days-heading" className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
				Day by day
			</h2>
			<Sub>
				Every arrival, the latest first.
				{data.more > 0 &&
					` The latest ${data.days.reduce((n, day) => n + day.titles.length, 0)} are here; each service's page has the rest.`}
			</Sub>
			<div className="mt-1 flex flex-wrap gap-x-8">
				{data.days.map(({ day, titles }) => (
					<div key={day ?? "unknown"} className="mt-4 w-full sm:w-auto">
						<h3 className={`${DISPLAY} text-lg text-white`}>
							{day === null ? "Also new" : dayHeading(day, data.now)}{" "}
							<span className="text-sm font-bold tracking-normal text-gray-500">
								{titles.length}
							</span>
						</h3>
						<PosterRow titles={titles} data={data} />
					</div>
				))}
			</div>
		</section>
	)
}

function OtherCountries({ data }: { data: NewPageData }) {
	if (!data.otherCountries.length) return null
	const on = data.brand ? data.brand.name : "streaming"
	return (
		<section aria-labelledby="elsewhere-heading">
			<h2 id="elsewhere-heading" className={`${DISPLAY} text-xl text-white`}>
				New on {on} in other countries
			</h2>
			<ul className="mt-2 flex flex-wrap gap-2">
				{data.otherCountries.map((country) => (
					<li key={country.code}>
						<Link
							to={country.path}
							prefetch="intent"
							className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 hover:ring-white/30"
						>
							<Flag country={country.code} />
							{country.name}
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

export function NewOnServicesPage({ data }: { data: NewPageData }) {
	const brand = data.kind === "service" ? data.brand : null
	return (
		<div className="pb-28">
			<section className="relative overflow-hidden border-b border-white/[0.07]">
				{data.hero && (
					<TmdbImage
						kind="backdrop"
						path={data.hero}
						sizes={[[null, "100vw"]]}
						maxWidth={1280}
						priority="eager"
						className="absolute inset-0 h-full w-full object-cover object-top opacity-40"
					/>
				)}
				<span className="absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/80 to-gray-900/50" />
				<div className={`${WRAP} relative flex flex-col gap-5 pb-7 pt-4`}>
					<Crumbs data={data} />
					{data.waited.length > 0 ? (
						<Waited data={data} />
					) : (
						<div className="flex items-start justify-between gap-4">
							<h1
								className={`${DISPLAY} flex flex-wrap items-center gap-x-4 gap-y-2 text-5xl text-white md:text-7xl`}
							>
								{brand && (
									<Logo service={brand} size={56} className="rounded-2xl" />
								)}
								{data.copy.heading}
							</h1>
							{data.share && (
								<div className="mt-2 shrink-0">
									<ShareButton link={`https://goodwatch.app${data.share}`} />
								</div>
							)}
						</div>
					)}
					<HowLine data={data} />
					{data.offer && (
						<Link
							to={data.offer.path}
							prefetch="intent"
							className="-mt-1 inline-flex w-fit items-center gap-2 rounded-xl bg-sky-400/10 px-3 py-2 text-sm font-bold text-sky-100 ring-1 ring-sky-300/30 hover:ring-sky-300/60"
						>
							<Flag country={data.offer.country} />
							{data.offer.words}
							<ChevronRightIcon className="h-4 w-4" aria-hidden />
						</Link>
					)}
					{(data.kind !== "member" || data.keys.length > 0) && (
						<ServiceKeys data={data} />
					)}
				</div>
			</section>
			<div className={`${WRAP} flex flex-col gap-10 pt-7`}>
				{data.total === 0 ? (
					<Nothing data={data} />
				) : (
					<>
						<Ranked data={data} />
						<SignUpPrompt
							feature="watchNext"
							size="card"
							className="max-w-xl"
							words={{
								title: "Waiting for a title? GoodWatch tells you when it lands",
								detail:
									"Mark what you want to see and save your services. My movies and My shows tell you when one arrives.",
							}}
						/>
						{data.total > 1 && <DayByDay data={data} />}
					</>
				)}
				<OtherCountries data={data} />
			</div>
		</div>
	)
}
