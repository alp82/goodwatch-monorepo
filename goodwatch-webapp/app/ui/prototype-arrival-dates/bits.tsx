// PROTOTYPE - throwaway (#625). Copied from prototype C of #489 (ui/prototype-new-on-services/bits.tsx on branch
// ghostex/3fbfaf5b): a service's logo, the GoodWatch score, the Wishlist mark, a poster, a flag, the sign-up card.
import { BookmarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import { Poster } from "~/ui/my-pages/bits"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { countryFlagUrl } from "~/utils/country-flag"
import { goodwatchVibeIndex } from "~/utils/ratings"
import {
	type Arrival,
	type Choice,
	type CountryKey,
	SERVICES,
	type Seo,
	type ServiceKey,
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
