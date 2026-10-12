// PROTOTYPE - throwaway (#489, prototype C). The small pieces the four variations of /prototype/new-on-services
// share: a service's logo, the GoodWatch score, the Want to See mark, the country and service pickers, the note on
// how fresh the list is, and the empty page. Each variation has its own layout.
import { BookmarkIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import { DISPLAY, Poster } from "~/ui/my-pages/bits"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { countryFlagUrl } from "~/utils/country-flag"
import { goodwatchVibeIndex } from "~/utils/ratings"
import {
	type Arrival,
	COUNTRIES,
	type Choice,
	type CountryKey,
	SERVICES,
	type Seo,
	type ServiceKey,
	WINDOW_DAYS,
	isMember,
	serviceNames,
	titleHref,
} from "./model"

export interface PageProps {
	choice: Choice
	arrivals: Arrival[]
	/** The same without the choice of movies or shows, for the numbers on that choice. */
	everything: Arrival[]
	seo: Seo
	/** Changes the page's address. An empty value takes a parameter away. */
	set: (next: Record<string, string>) => void
	/** The address of the page with a change, for a choice that is a link. */
	href: (next: Record<string, string>) => string
}

export const Logo = ({
	service,
	size = 28,
	className = "",
}: { service: ServiceKey; size?: number; className?: string }) => (
	<TmdbImage
		kind="logo"
		path={SERVICES[service].logo}
		width={size}
		ratio={1}
		alt={SERVICES[service].name}
		title={SERVICES[service].name}
		className={`shrink-0 rounded-lg ring-1 ring-white/20 ${className}`}
		style={{ width: size, height: size }}
	/>
)

/** The GoodWatch score in its color, as on a poster's tab. */
export const Score = ({
	score,
	className = "",
}: { score: number; className?: string }) => (
	<span
		className={`inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md px-1.5 text-sm font-black tabular-nums text-white bg-vibe-${goodwatchVibeIndex(score)} ${className}`}
	>
		<span className="sr-only">GoodWatch score </span>
		{score}
	</span>
)

/** The Wishlist's bookmark, as on a poster. */
export const WantMark = ({ className = "" }: { className?: string }) => (
	<span
		className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-950/85 ring-1 ring-amber-400/60 ${className}`}
	>
		<BookmarkIcon className="h-4 w-4 text-amber-400" aria-hidden />
		<span className="sr-only">On your Wishlist</span>
	</span>
)

/** A link to the title's page. Nothing is loaded ahead: the prototype runs without a database. */
export const TitleLink = ({
	arrival,
	className = "",
	children,
}: { arrival: Arrival; className?: string; children: ReactNode }) => (
	<Link
		to={titleHref(arrival)}
		prefetch="none"
		className={className}
		data-title={arrival.key}
		data-wanted={arrival.want ? "" : undefined}
	>
		{children}
	</Link>
)

export const PosterImage = ({
	arrival,
	size = "w342",
	className = "",
}: { arrival: Arrival; size?: string; className?: string }) => (
	<Poster path={arrival.poster} size={size} className={className} />
)

export const Flag = ({
	country,
	className = "h-4 w-6",
}: { country: CountryKey; className?: string }) => (
	<img
		src={countryFlagUrl(country)}
		alt=""
		className={`shrink-0 rounded-[3px] object-cover ring-1 ring-white/20 ${className}`}
	/>
)

const KEY =
	"h-10 rounded-xl text-sm font-bold ring-1 transition-colors focus-within:ring-2 focus-within:ring-amber-400"

export function CountrySelect({ choice, set }: PageProps) {
	return (
		<label
			className={`${KEY} relative flex shrink-0 items-center gap-2 bg-white/[0.06] pl-3 text-gray-100 ring-white/10 hover:ring-white/20`}
		>
			<span className="sr-only">Country</span>
			<Flag country={choice.country} />
			<select
				value={choice.country}
				// Another country has other services: the choice of services starts over.
				onChange={(event) => set({ country: event.target.value, services: "" })}
				data-country
				className="h-full cursor-pointer appearance-none bg-transparent pr-8 font-bold outline-none"
			>
				{Object.entries(COUNTRIES).map(([key, country]) => (
					<option key={key} value={key} className="bg-gray-900 text-gray-100">
						{country.name}
					</option>
				))}
			</select>
			<ChevronDownIcon
				className="pointer-events-none absolute right-2 h-4 w-4 opacity-70"
				aria-hidden
			/>
		</label>
	)
}

/** The services of the country as keys that switch on and off. The last one on cannot be switched off. */
export function ServiceKeys({
	choice,
	set,
	names = true,
}: PageProps & { names?: boolean }) {
	const toggle = (service: ServiceKey) => {
		const on = choice.services.includes(service)
		if (on && choice.services.length === 1) return
		const next = COUNTRIES[choice.country].services.filter((key) =>
			key === service ? !on : choice.services.includes(key),
		)
		set({ services: next.join(",") })
	}
	return (
		<div className="flex flex-wrap gap-2" data-services>
			{COUNTRIES[choice.country].services.map((service) => {
				const on = choice.services.includes(service)
				return (
					<button
						key={service}
						type="button"
						aria-pressed={on}
						data-service={service}
						onClick={() => toggle(service)}
						className={`${KEY} flex cursor-pointer items-center gap-2 pl-1.5 ${names ? "pr-3" : "pr-1.5"} ${on ? "bg-amber-400/15 text-amber-100 ring-amber-400/50" : "bg-white/[0.04] text-gray-400 ring-white/10 hover:text-gray-200 hover:ring-white/20"}`}
					>
						<Logo
							service={service}
							className={on ? "" : "opacity-50 grayscale"}
						/>
						{names ? (
							SERVICES[service].name
						) : (
							<span className="sr-only">{SERVICES[service].name}</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** A member's saved services and country, and the way to change them. */
export function SavedServices({ choice, set }: PageProps) {
	return (
		<p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-gray-300">
			<span className="flex items-center gap-1.5">
				{choice.services.map((service) => (
					<Logo key={service} service={service} size={24} />
				))}
			</span>
			<span>
				{serviceNames(choice.services)} {COUNTRIES[choice.country].inThe}
			</span>
			<Link
				to="/settings/streaming"
				prefetch="none"
				className="font-bold text-amber-300 underline-offset-2 hover:underline"
			>
				Change
			</Link>
			<button
				type="button"
				onClick={() =>
					set({ services: COUNTRIES[choice.country].services.join(",") })
				}
				data-all-services
				className="cursor-pointer font-bold text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline"
			>
				Show every service
			</button>
		</p>
	)
}

/** The pickers: a member with their saved services has a line, everyone else the keys. */
export const Pickers = (props: PageProps & { names?: boolean }) =>
	isMember(props.choice.viewer) && props.choice.saved ? (
		<SavedServices {...props} />
	) : (
		<div className="flex flex-wrap items-center gap-2">
			<CountrySelect {...props} />
			<ServiceKeys {...props} />
			{isMember(props.choice.viewer) && (
				<button
					type="button"
					onClick={() => props.set({ services: "", country: "" })}
					className="h-10 cursor-pointer px-2 text-sm font-bold text-amber-300 underline-offset-2 hover:underline"
				>
					Back to my services
				</button>
			)}
		</div>
	)

/** How fresh the list is, said once and plainly. */
export const FreshNote = ({
	className = "",
	wanted = false,
}: { className?: string; wanted?: boolean }) => (
	<p
		className={`max-w-2xl text-xs leading-relaxed text-gray-500 ${className}`}
		data-fresh
	>
		GoodWatch checks every title at least once in two weeks, so a title here
		arrived at some point in the last {WINDOW_DAYS * 2} days.
		{wanted
			? " Titles you want to see are checked every day: their day is exact."
			: " Titles a member wants to see are checked every day."}
	</p>
)

/** Nothing arrived. */
export function Nothing({ choice, set }: PageProps) {
	const country = COUNTRIES[choice.country]
	const all = choice.services.length === country.services.length
	return (
		<div
			className="rounded-2xl border border-dashed border-white/15 p-6"
			data-empty
		>
			<h2 className={`${DISPLAY} text-2xl text-white`}>
				Nothing new in the last two weeks
			</h2>
			<p className="mt-1 max-w-xl text-sm text-gray-400">
				GoodWatch found no new movie or show on {serviceNames(choice.services)}{" "}
				{country.inThe} since it last looked.
				{isMember(choice.viewer) &&
					" When a title you want to see lands, My movies and My shows tell you."}
			</p>
			{!all && (
				<button
					type="button"
					onClick={() => set({ services: country.services.join(",") })}
					className="mt-4 inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-white/[0.06] px-4 py-2 text-left text-sm font-bold text-gray-100 ring-1 ring-white/10 hover:ring-white/25"
				>
					Look at every service {country.inThe}
				</button>
			)}
		</div>
	)
}

/** What a visitor is offered: an account tells them when a wanted title lands. */
export const VisitorPrompt = ({ className = "" }: { className?: string }) => (
	<SignUpPrompt
		feature="watchNext"
		size="card"
		className={className}
		words={{
			title: "Waiting for a title? GoodWatch tells you when it lands",
			detail:
				"Mark what you want to see and save your services. Wanted titles are checked every day.",
		}}
	/>
)
