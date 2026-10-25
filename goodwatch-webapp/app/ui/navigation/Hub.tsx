// The hub: every destination, laid out like the Living room remote's feature well. Your own pages come first as big
// tiles, then the places to explore as small keys, then one link to your profile (Sign up for guests). On phones
// it's a sheet above the dock (opened by the hub key); on desktop it's the Browse panel under the header. Both are the same labeled modal
// dialog, with a focus trap, Escape to close, and focus returned to the key or button that opened it. The phone sheet
// can also be dragged down to close.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import {
	ArrowRightIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import type React from "react"
import type { SignalWords } from "~/domain/new-episodes-signal"
import { landedWords, showsWords } from "~/domain/newly-available-words"
import { AccountAvatar } from "~/ui/account/AccountAvatar"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { PROFILE_PATH } from "~/ui/settings/paths"
import { profilePath } from "~/ui/share-card/links"
import { useUser } from "~/utils/auth"
import { useOpenAfterMount } from "~/utils/first-use"
import { useNavigation } from "./NavigationContext"
import { holdKeyboardForSearch } from "./Search"
import { GoodWatchMark, NewEpisodesMark, useSignUpHref } from "./bits"
import {
	type Destination,
	type DestinationKey,
	currentDestination,
	getDestinations,
} from "./destinations"
import { useDragToClose } from "./useDragToClose"
import { useTonightsPick } from "./useTonightsPick"
import { useWhatsNew } from "./useWhatsNew"

const HUB_TITLE = "Browse GoodWatch"

/** Each big tile's pale wash and icon color, so the destinations tell apart at a glance. */
const TILE_TINTS: Partial<
	Record<DestinationKey, { wash: string; icon: string }>
> = {
	watchNext: {
		wash: "from-amber-200/25 to-amber-200/[0.06]",
		icon: "text-amber-300",
	},
	myShows: {
		wash: "from-rose-200/25 to-rose-200/[0.06]",
		icon: "text-rose-300",
	},
	myMovies: {
		wash: "from-amber-200/25 to-amber-200/[0.06]",
		icon: "text-amber-300",
	},
	discover: { wash: "from-sky-200/25 to-sky-200/[0.06]", icon: "text-sky-300" },
	taste: {
		wash: "from-violet-200/25 to-violet-200/[0.06]",
		icon: "text-violet-300",
	},
	explorer: {
		wash: "from-emerald-200/25 to-emerald-200/[0.06]",
		icon: "text-emerald-300",
	},
	forYou: {
		wash: "from-fuchsia-200/25 to-fuchsia-200/[0.06]",
		icon: "text-fuchsia-300",
	},
	new: {
		wash: "from-sky-200/25 to-sky-200/[0.06]",
		icon: "text-sky-300",
	},
}

/** The For you tile's line: these are recommendations, chosen from what the person likes. */
const FOR_YOU_SUBTITLE = "Recommended from your taste"

function Tile({
	destination,
	subtitle,
	here,
	fresh = null,
}: {
	destination: Destination
	subtitle: string
	here: boolean
	/** My shows and My movies: what is new behind the tile. It takes the subtitle's place, on one line. */
	fresh?: SignalWords | null
}) {
	const Icon = destination.icon
	const tint = TILE_TINTS[destination.key] ?? {
		wash: "from-gray-800 to-[#0b1120]",
		icon: "text-amber-400",
	}
	const className = `relative flex min-h-[108px] flex-col items-start justify-end gap-0.5 overflow-hidden rounded-[20px] bg-linear-160 px-3.5 py-3 text-left ${tint.wash} ${
		here
			? "shadow-[inset_0_0_0_2px_#fbbf24]"
			: "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(255,255,255,0.08)]"
	} hover:brightness-125`
	return (
		<Link
			to={destination.href}
			prefetch="intent"
			aria-current={here ? "page" : undefined}
			className={className}
		>
			<Icon
				className={`absolute top-3 left-3.5 h-6 w-6 ${tint.icon}`}
				aria-hidden
			/>
			<NewEpisodesMark words={fresh} className="absolute top-3 right-3" />
			<b className="brand-header text-[19px] leading-tight text-gray-100">
				{destination.label}
			</b>
			{fresh ? (
				<small
					className="max-w-full truncate text-[12.5px] font-bold text-sky-200"
					aria-hidden
				>
					{fresh.tile}
				</small>
			) : (
				<small className="max-w-full truncate text-[12.5px] text-slate-300">
					{subtitle}
				</small>
			)}
		</Link>
	)
}

/** A small key: the places to explore, Home among them. */
function SecondaryKey({
	destination,
	here,
}: { destination: Destination; here: boolean }) {
	const Icon = destination.icon
	return (
		<Link
			to={destination.href}
			prefetch="intent"
			aria-current={here ? "page" : undefined}
			className={`flex h-12 min-w-0 items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 font-bold text-gray-100 hover:bg-white/[0.08] ${here ? "shadow-[inset_0_0_0_1.5px_#fbbf24]" : ""}`}
		>
			{destination.key === "home" ? (
				<GoodWatchMark size={18} />
			) : (
				<Icon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
			)}
			<span className="truncate">{destination.label}</span>
		</Link>
	)
}

/** A labeled group of destinations, two to a row. */
function Group({
	id,
	name,
	children,
}: { id: string; name: string; children: React.ReactNode }) {
	return (
		<section aria-labelledby={id} className="grid gap-2.5">
			<h3
				id={id}
				className="px-1 pt-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase"
			>
				{name}
			</h3>
			<div className="grid grid-cols-2 gap-2.5">{children}</div>
		</section>
	)
}

/** The last row: one link to the member's profile (or to picking a handle), or Sign up for guests. */
function AccountRow() {
	const { user } = useUser()
	const me = useAccountSummary()
	const signUp = useSignUpHref()
	if (!user)
		return (
			<Link
				rel="nofollow"
				to={signUp}
				className="flex items-center gap-2 rounded-2xl bg-amber-500/15 px-4 py-3.5 text-left text-sm text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)] hover:bg-amber-500/20"
			>
				<span>
					<b className="text-amber-400">Sign up</b> to keep your Wishlist and
					let Best match learn your taste
				</span>
				<ArrowRightIcon className="ml-auto h-4 w-4 shrink-0" aria-hidden />
			</Link>
		)
	return (
		<Link
			to={me.handle ? profilePath(me.handle) : PROFILE_PATH}
			prefetch="intent"
			className="flex h-[58px] min-w-0 items-center gap-3 rounded-2xl bg-white/[0.04] px-2.5 text-gray-100 hover:bg-white/[0.08]"
		>
			<AccountAvatar
				url={me.avatarUrl}
				color={me.color}
				initial={me.initial}
				size={38}
			/>
			<span className="min-w-0 grow leading-tight">
				<b className="block truncate">
					{me.handle ? `@${me.handle}` : "Your profile"}
				</b>
				<small
					data-feedback-private={(!me.handle && !me.loaded) || undefined}
					className="block truncate text-[12.5px] text-gray-400"
				>
					{me.handle
						? "Your profile"
						: me.loaded
							? "Pick a handle to get your profile"
							: (me.email ?? "")}
				</small>
			</span>
			<ChevronRightIcon
				className="h-4 w-4 shrink-0 text-gray-500"
				aria-hidden
			/>
		</Link>
	)
}

function HubContent() {
	const navigation = useNavigation()
	const { user } = useUser()
	const { pathname } = useLocation()
	const here = currentDestination(pathname)
	const d = getDestinations()
	const { pick, wishlistCount } = useTonightsPick()
	// New episodes (#442) and titles that landed on the member's services (#456).
	const { episodes, landed } = useWhatsNew()
	// A member has My shows and My movies in place of Watch next (#385). My library is reached from their heads, the
	// account menu, Settings and the profile, so its tile gave its place to For you.
	const tracked = Boolean(user)
	const pickOn = pick?.href ? currentDestination(pick.href.split("#")[0]) : null
	// Search opens over the hub, which stays open beneath it: closing the hub would hand focus back to the key that
	// opened it and take the keyboard down. Closing search comes back here; following a result closes both.
	const openSearch = () => {
		holdKeyboardForSearch()
		navigation.setSearchOpen(true)
	}
	const watchSubtitle = user
		? pick
			? `${pick.title.title} next`
			: "Your Wishlist, best first"
		: `${wishlistCount} on your Wishlist`
	// A link to the page the person is already on changes no location, so close on any link click.
	const closeOnLink = (event: React.MouseEvent) => {
		if ((event.target as HTMLElement).closest("a")) navigation.setHubOpen(false)
	}
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only observes clicks on the links inside
		<div className="grid gap-3" onClick={closeOnLink}>
			<button
				type="button"
				onClick={openSearch}
				className="flex h-[50px] w-full items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 text-[15px] text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)] hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.5)]"
			>
				<MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
				Search titles, people, moods
			</button>
			<Group id="hub-yours" name="Yours">
				{tracked ? (
					<>
						<Tile
							destination={d.myShows}
							subtitle={
								pickOn === "myShows" && pick
									? `${pick.title.title}${pick.episode ? ` ${pick.episode.code}` : ""} next`
									: "Continue, or start one"
							}
							here={here === "myShows"}
							fresh={showsWords(episodes, landed?.shows ?? null)}
						/>
						<Tile
							destination={d.myMovies}
							subtitle={
								pickOn === "myMovies" && pick
									? `${pick.title.title} next`
									: "Movies you want to see"
							}
							here={here === "myMovies"}
							fresh={landedWords("movie", landed?.movies ?? null)}
						/>
						<Tile
							destination={d.new}
							subtitle="What arrived in the last 14 days"
							here={here === "new"}
						/>
					</>
				) : (
					<Tile
						destination={d.watchNext}
						subtitle={watchSubtitle}
						here={here === "watchNext"}
					/>
				)}
				<Tile
					destination={d.forYou}
					subtitle={FOR_YOU_SUBTITLE}
					here={here === "forYou"}
				/>
				<Tile
					destination={d.taste}
					subtitle="Your viewer type"
					here={here === "taste"}
				/>
			</Group>
			<Group id="hub-explore" name="Explore">
				{[d.discover, d.explorer, d.movies, d.shows, d.hot, d.home].map(
					(destination) => (
						<SecondaryKey
							key={destination.key}
							destination={destination}
							here={here === destination.key}
						/>
					),
				)}
			</Group>
			<AccountRow />
		</div>
	)
}

/** The hub sheet (phones) and Browse panel (desktop): one dialog, opened from the hub key or the Browse button. */
export function HubDialog() {
	const { hubOpen, setHubOpen } = useNavigation()
	// This module loads with the hub's first opening (see LazyDialogs.tsx).
	const open = useOpenAfterMount(hubOpen)
	const panel = useDragToClose(() => setHubOpen(false))
	return (
		<Dialog
			open={open}
			onClose={() => setHubOpen(false)}
			className="relative z-[1100]"
		>
			<DialogBackdrop
				transition
				className="fixed inset-0 bg-black/55 transition-opacity duration-200 data-closed:opacity-0 lg:bg-black/35"
			/>
			<div className="fixed inset-0 flex flex-col justify-end lg:mx-auto lg:max-w-7xl lg:justify-start lg:px-8 lg:pt-[70px]">
				<DialogPanel
					ref={panel}
					id="site-hub"
					transition
					className="relative max-h-[86%] overflow-y-auto overscroll-contain rounded-t-3xl bg-[#0b1120] px-4 pt-2.5 pb-[calc(22px+env(safe-area-inset-bottom))] text-gray-100 shadow-[0_-20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] transition duration-200 ease-out data-closed:translate-y-9 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:w-[580px] lg:rounded-[20px] lg:p-4 lg:data-closed:-translate-y-3"
				>
					<span
						aria-hidden
						className="mx-auto mb-3 block h-[5px] w-10 rounded-full bg-white/25 lg:hidden"
					/>
					<DialogTitle className="sr-only">{HUB_TITLE}</DialogTitle>
					<HubContent />
				</DialogPanel>
			</div>
		</Dialog>
	)
}
