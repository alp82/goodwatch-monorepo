// At a glance's Facts, opened: small data tiles of what numbers and plain facts say about a title. Critics against
// audiences, the box office, the running time against its genre (a show's time to watch it all), its reach, then the
// release, genres, language and where it's made. A tile shows only when its data exists; the grid widens the last
// tile of a short row so two tiles look as whole as five.
import {
	BanknotesIcon,
	CalendarDaysIcon,
	ClockIcon,
	FilmIcon,
	GlobeAltIcon,
	LanguageIcon,
	MapPinIcon,
	ScaleIcon,
} from "@heroicons/react/24/outline"
import type React from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import letterboxdLogo from "~/img/letterboxd-dots.svg?no-inline"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogoIcon from "~/img/rotten-logo-icon-64.webp"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { CAPTION } from "~/ui/details/page-ui"
import { assetUrl } from "~/utils/asset-url"
import { countryFlagUrl } from "~/utils/country-flag"
import { languageName, regionName } from "~/utils/display-names"
import {
	type BingeTime,
	type BoxOffice,
	type Languages,
	type Reach,
	type Released,
	type RuntimeVsGenre,
	type ScoreRow,
	type ScoreSite,
	type Spread,
	bingeTime,
	boxOffice,
	dollars,
	genresOf,
	languages,
	madeIn,
	minutesWords,
	reach,
	released,
	runtimeVsGenre,
	spread,
} from "./facts"

type Media = MovieResult | ShowResult

const CRITICS = "#a5b4fc" // indigo-300
const AUDIENCE = "#fcd34d" // amber-300

// Bars grow and markers settle in once, with transform and opacity only; nothing moves for reduced motion.
const MOTION = `@media (prefers-reduced-motion: no-preference){
.facts-grow{transform-origin:left center;animation:facts-grow .8s cubic-bezier(.2,.7,.2,1) both}
.facts-pop{animation:facts-pop .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes facts-grow{from{transform:scaleX(0)}}
@keyframes facts-pop{from{opacity:0;transform:scale(.4)}}}`
const delay = (i: number) => ({ animationDelay: `${80 + i * 50}ms` })

interface Tile {
	key: string
	wide: boolean
	node: React.ReactNode
}

export function FactsPanel({ media }: { media: Media }) {
	const s = spread(media)
	const b = boxOffice(media)
	const r = runtimeVsGenre(media)
	const t = bingeTime(media)
	const re = reach(media)
	const rel = released(media)
	const g = genresOf(media)
	const l = languages(media)
	const m = madeIn(media)
	const tiles = [
		s && { key: "spread", wide: true, node: <SpreadTile s={s} /> },
		b && { key: "box", wide: false, node: <BoxOfficeTile b={b} /> },
		t && { key: "binge", wide: false, node: <BingeTile t={t} /> },
		r && { key: "runtime", wide: false, node: <RuntimeTile r={r} /> },
		re && { key: "reach", wide: false, node: <ReachTile r={re} /> },
		rel && { key: "released", wide: false, node: <ReleasedTile r={rel} /> },
		g.length > 0 && {
			key: "genres",
			wide: false,
			node: <GenresTile genres={g} />,
		},
		l && { key: "language", wide: false, node: <LanguageTile l={l} /> },
		m.length > 0 && {
			key: "made",
			wide: false,
			node: <MadeInTile countries={m} />,
		},
	].filter(Boolean) as Tile[]
	if (!tiles.length) return null
	const two = spans(tiles, 2)
	// Three columns: a wide first tile with two more beside it stands two rows tall, the two stacked at its right.
	const tall = tiles[0].wide && tiles.length >= 3
	const three = tall ? [2, 1, 1, ...spans(tiles.slice(3), 3)] : spans(tiles, 3)
	return (
		<div className="@container">
			<style>{MOTION}</style>
			<div className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
				{tiles.map((tile, i) => (
					<div
						key={tile.key}
						className={`flex min-w-0 ${SPAN2[two[i]]} ${SPAN3[three[i]]} ${tall && i === 0 ? "@3xl:row-span-2" : ""}`}
					>
						{tile.node}
					</div>
				))}
			</div>
		</div>
	)
}

const SPAN2: Record<number, string> = {
	1: "@lg:col-span-1",
	2: "@lg:col-span-2",
}
const SPAN3: Record<number, string> = {
	1: "@3xl:col-span-1",
	2: "@3xl:col-span-2",
	3: "@3xl:col-span-3",
}

/** Column spans for a grid of `cols`: wide tiles take two, and the last tile of a short final row takes the rest. */
function spans(tiles: Tile[], cols: number) {
	const out: number[] = []
	if (!tiles.length) return out
	let used = 0
	tiles.forEach((tile, i) => {
		const span = Math.min(tile.wide ? 2 : 1, cols)
		if (used + span > cols) {
			out[i - 1] += cols - used
			used = 0
		}
		out.push(span)
		used = (used + span) % cols
	})
	if (used) out[out.length - 1] += cols - used
	return out
}

// ------------------------------------------------------------------------------------------------------- the tile

function Card({
	icon: Icon,
	title,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>
	title: string
	children: React.ReactNode
}) {
	return (
		<section
			aria-label={title}
			className="flex w-full flex-col gap-3 rounded-xl bg-white/[0.025] p-4 ring-1 ring-white/10 sm:p-5"
		>
			<h3 className={`flex items-center gap-2 ${CAPTION}`}>
				<Icon className="h-4 w-4 text-amber-300/80" />
				{title}
			</h3>
			{children}
		</section>
	)
}

/** The big number of a tile and its words beside it. */
function Figure({
	value,
	unit,
	children,
}: {
	value: React.ReactNode
	unit?: React.ReactNode
	children?: React.ReactNode
}) {
	return (
		<div>
			<p className="flex items-baseline gap-2">
				<span className="text-3xl font-semibold tracking-tight text-white tabular-nums">
					{value}
				</span>
				{unit && <span className="text-[15px] text-gray-300">{unit}</span>}
			</p>
			{children && (
				<p className="mt-1 text-[15px] leading-snug text-gray-300">
					{children}
				</p>
			)}
		</div>
	)
}

// ------------------------------------------------------------------------------------------- critics vs audience

const SITE: Record<ScoreSite, { logo: string; bg: string; wordmark: boolean }> =
	{
		imdb: { logo: imdbLogo, bg: "bg-imdb", wordmark: true },
		letterboxd: { logo: letterboxdLogo, bg: "bg-letterboxd", wordmark: true },
		mc: { logo: metacriticLogoIcon, bg: "bg-metacritic", wordmark: false },
		rt: { logo: rottenLogoIcon, bg: "bg-rotten", wordmark: false },
	}

function SpreadTile({ s }: { s: Spread }) {
	// One axis for every mark: from a round number under the lowest score to 100, so near scores still part.
	const low = Math.min(...s.rows.map((r) => r.value), s.goodwatch ?? 100)
	const lo = Math.max(0, Math.min(50, Math.floor((low - 8) / 10) * 10))
	const at = (v: number) => `${((v - lo) / (100 - lo)) * 100}%`
	const ticks = [lo, ...[25, 50, 75].filter((t) => t > lo + 6), 100]
	return (
		<Card icon={ScaleIcon} title="Critics vs audiences">
			<div>
				<p className="text-lg font-semibold leading-snug text-white">
					{s.verdict}
				</p>
				<p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300 tabular-nums">
					{s.critics != null && (
						<Legend color={CRITICS} label="Critics" value={s.critics} />
					)}
					{s.audience != null && (
						<Legend color={AUDIENCE} label="Audiences" value={s.audience} />
					)}
					{s.goodwatch != null && (
						<span className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className="h-3 w-0.5 rounded-full bg-white/80"
							/>
							GoodWatch{" "}
							<span className="font-semibold text-white">{s.goodwatch}</span>
						</span>
					)}
				</p>
			</div>

			{/* The two averages on the shared axis, joined, with GoodWatch's score as a tick. */}
			{s.critics != null && s.audience != null && (
				<div
					role="img"
					aria-label={`On a 0 to 100 scale: critics ${s.critics}, audiences ${s.audience}${s.goodwatch != null ? `, GoodWatch ${s.goodwatch}` : ""}`}
					className="relative mt-1 ml-[3.25rem] h-6"
				>
					<span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
					<span
						className="facts-grow absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
						style={{
							left: at(Math.min(s.critics, s.audience)),
							width: `calc(${at(Math.max(s.critics, s.audience))} - ${at(Math.min(s.critics, s.audience))})`,
							background: `linear-gradient(90deg, ${s.critics < s.audience ? CRITICS : AUDIENCE}66, ${s.critics < s.audience ? AUDIENCE : CRITICS}66)`,
						}}
					/>
					{s.goodwatch != null && (
						<span
							className="absolute top-0 h-6 w-0.5 -translate-x-1/2 rounded-full bg-white/80"
							style={{ left: at(s.goodwatch) }}
						/>
					)}
					<Dot color={CRITICS} left={at(s.critics)} i={1} />
					<Dot color={AUDIENCE} left={at(s.audience)} i={2} />
				</div>
			)}

			<ul className="flex flex-col gap-3 pt-1">
				{s.rows.map((row, i) => (
					<ScoreLine key={row.key} row={row} at={at} i={i} />
				))}
			</ul>
			<div
				className="flex justify-between pl-[3.25rem] text-[11px] text-gray-500 tabular-nums"
				aria-hidden="true"
			>
				{/* The axis's numbers under the bars, at their places. */}
				<span className="relative h-3 w-full">
					{ticks.map((t) => (
						<span
							key={t}
							className="absolute -translate-x-1/2"
							style={{ left: at(t) }}
						>
							{t}
						</span>
					))}
				</span>
			</div>
		</Card>
	)
}

function Legend({
	color,
	label,
	value,
}: { color: string; label: string; value: number }) {
	return (
		<span className="flex items-center gap-1.5">
			<span
				aria-hidden="true"
				className="h-2.5 w-2.5 rounded-full"
				style={{ background: color }}
			/>
			{label} <span className="font-semibold text-white">{value}</span>
		</span>
	)
}

function Dot({ color, left, i }: { color: string; left: string; i: number }) {
	return (
		<span
			className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
			style={{ left }}
		>
			<span
				className="facts-pop block h-3.5 w-3.5 rounded-full ring-2 ring-gray-950"
				style={{ background: color, ...delay(i + 4) }}
			/>
		</span>
	)
}

function ScoreLine({
	row,
	at,
	i,
}: { row: ScoreRow; at: (v: number) => string; i: number }) {
	const site = SITE[row.site]
	const color = row.side === "critics" ? CRITICS : AUDIENCE
	return (
		<li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
			<a
				href={row.url || undefined}
				target="_blank"
				rel="noreferrer"
				title={`${row.name}: ${row.shown}`}
				className={`row-span-2 flex h-7 w-10 items-center justify-center rounded-md ${site.bg} ${row.url ? "hover:brightness-110" : "pointer-events-none"}`}
			>
				<img
					src={assetUrl(site.logo)}
					alt={row.name}
					className={site.wordmark ? "max-h-3 max-w-8" : "h-4"}
				/>
			</a>
			<p className="flex min-w-0 items-baseline gap-2 text-sm">
				<span className="truncate text-gray-200">
					{row.kind === "Users" || row.kind === "Members" ? row.name : row.kind}
					{row.votes && <span className="text-gray-500"> · {row.votes}</span>}
				</span>
				<span className="ml-auto font-semibold text-white tabular-nums">
					{row.shown}
				</span>
			</p>
			<span className="relative h-1.5 rounded-full bg-white/[0.07]">
				<span
					className="facts-grow absolute inset-y-0 left-0 rounded-full"
					style={{
						width: at(row.value),
						background: color,
						opacity: 0.75,
						...delay(i),
					}}
				/>
			</span>
		</li>
	)
}

// ------------------------------------------------------------------------------------------------------ box office

function BoxOfficeTile({ b }: { b: BoxOffice }) {
	const hit = b.multiple >= 1
	// A hit: the gross as budget-sized blocks, the first one the budget it paid back. Past 12 blocks they're too thin.
	const whole = Math.floor(b.multiple)
	const blocks =
		hit && b.multiple <= 12
			? [...Array(whole).fill(1), b.multiple - whole].filter((w) => w > 0.02)
			: null
	return (
		<Card icon={BanknotesIcon} title="Box office">
			<Figure
				value={b.headline}
				unit={hit ? "its budget" : "of its budget back"}
			/>
			<div
				role="img"
				aria-label={`Budget ${dollars(b.budget)}, worldwide gross ${dollars(b.gross)}`}
				className="flex h-3 w-full gap-0.5"
			>
				{blocks ? (
					blocks.map((w, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed blocks
							key={i}
							className={`facts-grow h-full rounded-[3px] ${i === 0 ? "bg-slate-400/70" : "bg-emerald-400/70"}`}
							style={{ flexGrow: w, flexBasis: 0, ...delay(i) }}
						/>
					))
				) : hit ? (
					<>
						<span
							className="facts-grow h-full rounded-[3px] bg-slate-400/70"
							style={{ flexGrow: 1, flexBasis: 0 }}
						/>
						<span
							className="facts-grow h-full rounded-[3px] bg-emerald-400/70"
							style={{ flexGrow: b.multiple - 1, flexBasis: 0, ...delay(1) }}
						/>
					</>
				) : (
					<span className="relative h-full w-full rounded-[3px] bg-slate-400/15 ring-1 ring-slate-400/40 ring-inset">
						<span
							className="facts-grow absolute inset-y-0 left-0 rounded-[3px] bg-emerald-400/70"
							style={{ width: `${b.multiple * 100}%` }}
						/>
					</span>
				)}
			</div>
			<dl className="grid grid-cols-2 gap-2 text-sm">
				<div>
					<dt className="flex items-center gap-1.5 text-gray-400">
						<span
							aria-hidden="true"
							className="h-2 w-2 rounded-sm bg-slate-400/70"
						/>
						Budget
					</dt>
					<dd className="mt-0.5 font-semibold text-white tabular-nums">
						{dollars(b.budget)}
					</dd>
				</div>
				<div className="text-right">
					<dt className="flex items-center justify-end gap-1.5 text-gray-400">
						<span
							aria-hidden="true"
							className="h-2 w-2 rounded-sm bg-emerald-400/70"
						/>
						Worldwide
					</dt>
					<dd className="mt-0.5 font-semibold text-white tabular-nums">
						{dollars(b.gross)}
					</dd>
				</div>
			</dl>
			<p className="text-sm text-gray-400">{b.line}</p>
		</Card>
	)
}

// ---------------------------------------------------------------------------------------------- runtime vs genre

function RuntimeTile({ r }: { r: RuntimeVsGenre }) {
	const [p10, p25, p50, p75, p90] = r.quantiles
	const lo = Math.min(p10, r.runtime) - 10
	const hi = Math.max(p90, r.runtime) + 10
	const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
	return (
		<Card icon={ClockIcon} title="Running time">
			<Figure value={minutesWords(r.runtime)}>
				{r.verdict}
				{r.delta && (
					<span className="text-gray-400 tabular-nums">
						, {r.delta} on the typical {r.quantiles[2]}
					</span>
				)}
			</Figure>
			<div
				role="img"
				aria-label={`${r.runtime} minutes; most ${r.genrePlural} run ${p25} to ${p75} minutes, typically ${p50}`}
				className="relative mt-5 h-8"
			>
				<span
					className="absolute top-2 h-3 rounded-full bg-white/[0.06]"
					style={{ left: at(p10), width: `calc(${at(p90)} - ${at(p10)})` }}
				/>
				<span
					className="absolute top-2 h-3 rounded-full bg-white/[0.14]"
					style={{ left: at(p25), width: `calc(${at(p75)} - ${at(p25)})` }}
				/>
				<span
					className="absolute top-1 h-5 w-px bg-white/50"
					style={{ left: at(p50) }}
				/>
				<span
					className="absolute top-7 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-400 tabular-nums"
					style={{ left: at(p50) }}
				>
					typical {p50}
				</span>
				<span
					className="absolute top-3.5 -translate-x-1/2 -translate-y-1/2"
					style={{ left: at(r.runtime) }}
				>
					<span
						className="facts-pop block h-4 w-4 rounded-full bg-amber-300 ring-2 ring-gray-950"
						style={delay(2)}
					/>
				</span>
				<span
					className="absolute -top-4 -translate-x-1/2 text-xs font-semibold text-amber-200 tabular-nums"
					style={{ left: at(r.runtime) }}
				>
					{r.runtime}
				</span>
			</div>
			<p className="mt-2 text-sm text-gray-400 tabular-nums">
				Half of all {r.genrePlural} run {p25}–{p75} min.
			</p>
		</Card>
	)
}

// --------------------------------------------------------------------------------------------- a show's binge time

function BingeTile({ t }: { t: BingeTime }) {
	const hours = t.minutes / 60
	return (
		<Card icon={ClockIcon} title="Time to watch it all">
			<Figure
				value={hours >= 10 ? `${Math.round(hours)} h` : minutesWords(t.minutes)}
			>
				{t.episodes} episodes, about {t.perEpisode} min each
			</Figure>
			<p className="text-sm text-gray-400">{t.pace}</p>
		</Card>
	)
}

// ---------------------------------------------------------------------------------------------------------- reach

function Flag({ code }: { code: string }) {
	return (
		<img
			src={countryFlagUrl(code)}
			alt=""
			title={regionName(code)}
			className="h-3.5 w-[21px] rounded-[2px] object-cover ring-1 ring-white/10"
			loading="lazy"
		/>
	)
}

function ReachTile({ r }: { r: Reach }) {
	const shown = r.streaming.slice(0, 10)
	const more = r.streaming.length - shown.length
	return (
		<Card icon={GlobeAltIcon} title="Reach">
			{r.streaming.length > 0 ? (
				<div>
					<p className="text-[15px] text-gray-200">
						Streams in{" "}
						<span className="font-semibold text-white tabular-nums">
							{r.streaming.length}
						</span>{" "}
						{r.streaming.length === 1 ? "country" : "countries"}
						{r.anywhere > r.streaming.length && (
							<span className="text-gray-400">
								, rent or buy in {r.anywhere - r.streaming.length} more
							</span>
						)}
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						{shown.map((c, i) => (
							<span key={c} className="facts-pop" style={delay(i)}>
								<Flag code={c} />
							</span>
						))}
						{more > 0 && (
							<span className="text-xs text-gray-400 tabular-nums">
								+{more}
							</span>
						)}
					</div>
				</div>
			) : (
				r.anywhere > 0 && (
					<p className="text-[15px] text-gray-200">
						To rent or buy in {r.anywhere} countries
					</p>
				)
			)}
		</Card>
	)
}

// ----------------------------------------------------------------------------------------------- the plain facts

function ReleasedTile({ r }: { r: Released }) {
	return (
		<Card icon={CalendarDaysIcon} title={r.label}>
			<Figure value={r.year}>{r.date}</Figure>
			{r.ago && <p className="text-sm text-gray-400">{r.ago}</p>}
		</Card>
	)
}

/** A tile's chips: the first (the leading genre, the original language) in white, the rest quieter. */
function Chips({ items, lead = true }: { items: string[]; lead?: boolean }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{items.map((x, i) => (
				<span
					key={x}
					className={`facts-pop rounded-full px-2.5 py-1 text-sm ${lead && i === 0 ? "bg-white font-semibold text-black" : "bg-white/10 text-gray-200"}`}
					style={delay(i)}
				>
					{x}
				</span>
			))}
		</div>
	)
}

function GenresTile({ genres }: { genres: string[] }) {
	return (
		<Card icon={FilmIcon} title={genres.length === 1 ? "Genre" : "Genres"}>
			<Chips items={genres} />
		</Card>
	)
}

function LanguageTile({ l }: { l: Languages }) {
	return (
		<Card icon={LanguageIcon} title="Language">
			<Figure
				value={<span className="text-2xl">{languageName(l.original)}</span>}
			>
				Original language
			</Figure>
			{l.others.length > 0 && (
				<div className="border-t border-white/[0.07] pt-3">
					<p className="mb-2 text-sm text-gray-400">Also spoken</p>
					<Chips items={l.others.map((c) => languageName(c))} lead={false} />
				</div>
			)}
		</Card>
	)
}

function MadeInTile({ countries }: { countries: string[] }) {
	return (
		<Card icon={MapPinIcon} title="Made in">
			<ul className="flex flex-col gap-1.5">
				{countries.map((c) => (
					<li
						key={c}
						className="flex items-center gap-2.5 text-[15px] text-gray-100"
					>
						<Flag code={c} />
						{regionName(c)}
					</li>
				))}
			</ul>
		</Card>
	)
}
