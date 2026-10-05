// Small pieces shared by the dock, the header, and the hub: the GoodWatch mark, Tonight's pick as a tiny poster, and
// the account slot (Sign up for guests, the avatar and its menu for members).
import { BookmarkIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import { useFeatures } from "~/hooks/useFeature"
import logoWhite from "~/img/goodwatch-logo-white.svg"
import { LazyUserMenu } from "~/ui/main/LazyUserMenu"
import { useUser } from "~/utils/auth"
import { useAuthHref } from "~/utils/auth-href"
import { currentDestination, getDestinations } from "./destinations"
import { useTonightsPick } from "./useTonightsPick"

export const tmdbImage = (path: string, size: "w92" | "w300" | "w342") =>
	`https://image.tmdb.org/t/p/${size}${path}`

export function GoodWatchMark({ size = 22 }: { size?: number }) {
	return (
		<img
			src={logoWhite}
			alt=""
			className="block shrink-0"
			style={{ width: size, height: size }}
		/>
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
	const watchNext = getDestinations(useFeatures()).watchNext
	const here = currentDestination(pathname) === "watchNext"
	const title = pick?.title
	const ring = here
		? "ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
		: "ring-[1.5px] ring-amber-400/85"
	return (
		<Link
			to={watchNext.href}
			prefetch="intent"
			aria-label={title ? `Watch next: ${title.title}` : "Watch next"}
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
						{user ? "Tonight" : "Wishlist"}
					</small>
					<b className="max-w-[118px] truncate text-[13.5px] text-gray-100">
						{title?.title ?? "Watch next"}
					</b>
				</span>
			)}
		</Link>
	)
}

/** The account slot: Sign up for guests, the avatar with the account menu for members. */
export function AccountSlot({ compact }: { compact?: boolean }) {
	const { user, loading } = useUser()
	const signUp = useSignUpHref()
	if (loading) return null
	if (user) return <LazyUserMenu user={user} />
	return (
		<Link
			rel="nofollow"
			to={signUp}
			className={`flex shrink-0 items-center whitespace-nowrap rounded-full bg-amber-500 font-extrabold text-amber-950 hover:bg-amber-400 ${compact ? "h-8 px-[13px] text-[13px]" : "h-9 px-4 text-sm"}`}
		>
			Sign up
		</Link>
	)
}
