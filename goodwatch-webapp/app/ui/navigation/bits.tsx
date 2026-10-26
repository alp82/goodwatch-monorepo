import { BookmarkIcon, UserCircleIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import type { SignalWords } from "~/domain/new-episodes-signal"
import logoWhite from "~/img/goodwatch-logo-white.svg"
import { LazyAccountMenu } from "~/ui/account/LazyAccountMenu"
// Small pieces shared by the dock, the header, and the hub: the GoodWatch mark, Tonight's pick as a tiny poster, and
// the account slot (Sign in for guests, the avatar and its menu for members).
import { assetBase, assetUrl } from "~/utils/asset-url"
import { useUser } from "~/utils/auth"
import { useAuthHref } from "~/utils/auth-href"
import { currentDestination, getDestinations } from "./destinations"
import { useTonightsPick } from "./useTonightsPick"

export const tmdbImage = (path: string, size: "w92" | "w300" | "w342") =>
	`https://image.tmdb.org/t/p/${size}${path}`

export function GoodWatchMark({ size = 22 }: { size?: number }) {
	return (
		<img
			src={assetUrl(logoWhite)}
			// Without credentials on the static hostname, like the start page's Remotes, whose G the 103 Early Hints
			// response preloads that way (server/early-hints.ts): one request for the file, on the warm connection.
			crossOrigin={assetBase() ? "anonymous" : undefined}
			alt=""
			className="block shrink-0"
			style={{ width: size, height: size }}
		/>
	)
}

/**
 * The signal that something new aired for the member's shows (#442): the number of shows, on the Browse button, the
 * dock's key and the My shows tile. Sky blue, the colour of the "New episodes" tag on My shows; amber stays "you
 * are here". Draws nothing when nothing is new.
 */
export function NewEpisodesMark({
	words,
	className = "",
}: { words: SignalWords | null; className?: string }) {
	if (!words) return null
	return (
		<span
			data-new-episodes
			className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-400 px-1.5 text-[11.5px] font-black tabular-nums leading-none text-black ring-2 ring-gray-950 ${className}`}
		>
			<span aria-hidden>{words.badge}</span>
			<span className="sr-only">{words.door}</span>
		</span>
	)
}

/** Sign up, bringing the person back to the page they're on. Guest progress transfers as usual. */
export function useSignUpHref() {
	return useAuthHref()("sign-up")
}

/** Tonight's pick as a tiny poster: one tap opens Watch next. Guests see their last Wishlist title, or the icon. */
export function TonightsPickThumb({
	label = true,
	className = "",
}: { label?: boolean; className?: string }) {
	const { user } = useUser()
	const { pathname } = useLocation()
	const { pick } = useTonightsPick()
	const watchNext = getDestinations().watchNext
	// A member's pick says which page it is the first thing on (#385), and may be an episode.
	const to = pick?.href ?? watchNext.href
	const here = pick?.href
		? pathname === pick.href.split("#")[0]
		: currentDestination(pathname) === "watchNext"
	const title = pick?.title
	const ring = here
		? "ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
		: "ring-[1.5px] ring-amber-400/85"
	return (
		<Link
			to={to}
			prefetch="intent"
			aria-label={
				pick?.href && title
					? `Watch next: ${title.title}${pick.episode ? `, ${pick.episode.code}` : ""}`
					: title
						? `Watch next: ${title.title}`
						: "Watch next"
			}
			aria-current={here ? "page" : undefined}
			className={`flex min-w-0 items-center gap-2 rounded-xl p-[3px] text-left ${className}`}
		>
			{title?.poster_path ? (
				<img
					src={tmdbImage(title.poster_path, "w92")}
					alt=""
					className={`h-11 w-[30px] shrink-0 rounded-md object-cover ${ring}`}
				/>
			) : (
				<span
					className={`flex h-11 w-[30px] shrink-0 items-center justify-center rounded-md bg-gray-800 text-amber-400 ${ring}`}
				>
					<BookmarkIcon className="h-4 w-4" aria-hidden />
				</span>
			)}
			{label && (
				<span className="flex min-w-0 flex-col leading-[1.15]">
					<small className="text-[11px] font-bold text-amber-400">
						{user ? "Next" : "Wishlist"}
						{pick?.episode && ` · ${pick.episode.code}`}
					</small>
					<b className="max-w-[118px] truncate text-[13.5px] text-gray-100">
						{title?.title ?? "Watch next"}
					</b>
				</span>
			)}
		</Link>
	)
}

/** The account slot: Sign in for guests, the avatar with the account menu for members. */
export function AccountSlot({ compact }: { compact?: boolean }) {
	const { user, loading } = useUser()
	const signIn = useAuthHref()("sign-in")
	if (loading) return null
	if (user) return <LazyAccountMenu user={user} compact={compact} />
	return (
		<Link
			rel="nofollow"
			to={signIn}
			className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-linear-180 from-white/[0.1] to-white/[0.04] font-bold text-gray-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.45),0_4px_14px_-6px_rgba(245,158,11,0.5)] transition-colors hover:from-amber-400/25 hover:to-amber-400/10 hover:text-white ${compact ? "h-9 pr-3.5 pl-2.5 text-[13px] max-[359px]:pl-3.5" : "h-10 pr-4 pl-3 text-sm"}`}
		>
			<UserCircleIcon
				className={`text-amber-400 ${compact ? "h-5 w-5 max-[359px]:hidden" : "h-[22px] w-[22px]"}`}
				aria-hidden
			/>
			Sign in
		</Link>
	)
}
