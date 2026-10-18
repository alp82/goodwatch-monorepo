// The hub: every destination, laid out like the Living room remote's feature well. On phones it's a sheet above the
// dock (opened by the hub key); on desktop it's the Browse panel under the header. Both are the same labeled modal
// dialog, with a focus trap, Escape to close, and focus returned to the key or button that opened it. The phone sheet
// can also be dragged down to close.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import { ArrowRightIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import type React from "react"
import type { SignalWords } from "~/domain/new-episodes-signal"
import { landedWords, showsWords } from "~/domain/newly-available-words"
import { myListsPath } from "~/ui/share-card/links"
import { TASTE_GROUPS_NAME } from "~/ui/taste/taste-groups-name"
import { useUser } from "~/utils/auth"
import { useOpenAfterMount } from "~/utils/first-use"
import { useNavigation } from "./NavigationContext"
import { holdKeyboardForSearch } from "./Search"
import {
	GoodWatchMark,
	NewEpisodesMark,
	tmdbImage,
	useSignUpHref,
} from "./bits"
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
	myLibrary: {
		wash: "from-teal-200/25 to-teal-200/[0.06]",
		icon: "text-teal-300",
	},
}

function Tile({
	destination,
	subtitle,
	here,
	backdrop,
	fresh = null,
}: {
	destination: Destination
	subtitle: string
	here: boolean
	backdrop?: string | null
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
	const body = (
		<>
			{backdrop && (
				<>
					<img
						src={tmdbImage(backdrop, "w300")}
						alt=""
						className="absolute inset-0 h-full w-full object-cover opacity-55"
					/>
					<span className="absolute inset-0 bg-linear-0 from-gray-950/92 to-gray-950/10" />
				</>
			)}
			<Icon
				className={`absolute top-3 left-3.5 z-10 h-6 w-6 ${tint.icon}`}
				aria-hidden
			/>
			<NewEpisodesMark words={fresh} className="absolute top-3 right-3 z-10" />
			<b className="brand-header relative z-10 text-[19px] leading-tight text-gray-100">
				{destination.label}
			</b>
			{fresh ? (
				<small
					className="relative z-10 max-w-full truncate text-[12.5px] font-bold text-sky-200"
					aria-hidden
				>
					{fresh.tile}
				</small>
			) : (
				<small className="relative z-10 text-[12.5px] text-slate-300">
					{subtitle}
				</small>
			)}
		</>
	)
	return (
		<Link
			to={destination.href}
			prefetch="intent"
			aria-current={here ? "page" : undefined}
			className={className}
		>
			{body}
		</Link>
	)
}

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
			className={`flex h-12 items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 font-bold text-gray-100 hover:bg-white/[0.08] ${here ? "shadow-[inset_0_0_0_1.5px_#fbbf24]" : ""}`}
		>
			<Icon className="h-5 w-5 text-amber-400" aria-hidden />
			{destination.label}
		</Link>
	)
}

function AccountRow() {
	const { user } = useUser()
	const signUp = useSignUpHref()
	const destinations = getDestinations()
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
	const name: string = user.user_metadata?.name ?? user.email ?? "You"
	const avatar: string | undefined = user.user_metadata?.avatar_url
	const link = "rounded-md px-1 py-2 text-gray-400 hover:text-gray-100"
	return (
		<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 p-1 font-bold text-gray-100">
			{avatar ? (
				<img src={avatar} alt="" className="h-[34px] w-[34px] rounded-full" />
			) : (
				<span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-linear-135 from-amber-400 to-amber-700 text-[15px] font-extrabold text-amber-950">
					{name.slice(0, 1).toUpperCase()}
				</span>
			)}
			<span className="min-w-0 truncate">{name}</span>
			<span className="grow" />
			<nav aria-label="Your account" className="flex text-[13px] font-medium">
				<Link
					// The Wishlist is the first choice of My library.
					to={destinations.myLibrary.href}
					className={link}
				>
					Wishlist
				</Link>
				<Link to={myListsPath} className={link}>
					Lists
				</Link>
				<Link to="/settings" className={link}>
					Settings
				</Link>
			</nav>
		</div>
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
	// A member has My shows, My movies and My library in place of Watch next (#385).
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
			? `${pick.title.title} tonight`
			: "Your Wishlist, best first"
		: `${wishlistCount} on your Wishlist`
	// A link to the page the person is already on changes no location, so close on any link click.
	const closeOnLink = (event: React.MouseEvent) => {
		if ((event.target as HTMLElement).closest("a"))
			navigation.setHubOpen(false)
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
			<div className="grid grid-cols-2 gap-2.5">
				{tracked ? (
					<>
						<Tile
							destination={d.myShows}
							subtitle={
								pickOn === "myShows" && pick
									? `${pick.title.title}${pick.episode ? ` ${pick.episode.code}` : ""} tonight`
									: "Continue, or start one"
							}
							here={here === "myShows"}
							backdrop={pickOn === "myShows" ? pick?.title.backdrop_path : null}
							fresh={showsWords(episodes, landed?.shows ?? null)}
						/>
						<Tile
							destination={d.myMovies}
							subtitle={
								pickOn === "myMovies" && pick
									? `${pick.title.title} tonight`
									: "Movies you want to see"
							}
							here={here === "myMovies"}
							backdrop={
								pickOn === "myMovies" ? pick?.title.backdrop_path : null
							}
							fresh={landedWords("movie", landed?.movies ?? null)}
						/>
					</>
				) : (
					<Tile
						destination={d.watchNext}
						subtitle={watchSubtitle}
						here={here === "watchNext"}
						backdrop={pick?.title.backdrop_path}
					/>
				)}
				<Tile
					destination={d.discover}
					subtitle="Browse and search"
					here={here === "discover"}
				/>
				<Tile
					destination={d.taste}
					subtitle={TASTE_GROUPS_NAME.title}
					here={here === "taste"}
				/>
				<Tile
					destination={d.explorer}
					subtitle="Islands map"
					here={here === "explorer"}
				/>
				{tracked && (
					<Tile
						destination={d.myLibrary}
						subtitle={`${wishlistCount} to see, and what you have seen`}
						here={here === "myLibrary"}
					/>
				)}
			</div>
			<div className="grid grid-cols-2 gap-2.5">
				<SecondaryKey destination={d.movies} here={here === "movies"} />
				<SecondaryKey destination={d.shows} here={here === "shows"} />
				<div className="col-span-2">
					<SecondaryKey destination={d.hot} here={here === "hot"} />
				</div>
			</div>
			<Link
				to="/"
				prefetch="intent"
				aria-current={here === "home" ? "page" : undefined}
				className={`flex h-[54px] items-center gap-3 rounded-2xl bg-white/[0.04] px-2.5 font-bold text-gray-100 hover:bg-white/[0.08] ${here === "home" ? "shadow-[inset_0_0_0_1.5px_#fbbf24]" : ""}`}
			>
				<span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827)]">
					<GoodWatchMark size={18} />
				</span>
				{d.home.label}
			</Link>
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
