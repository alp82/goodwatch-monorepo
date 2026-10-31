// The account menu's contents. Members get a profile card (avatar and handle, Edit profile, View as visitor and Share
// profile, then the Seen, Want, Lists and Rate more counts), the Watch and Set up groups (ui/navigation/areas.ts
// MENU_WATCH and MENU_SETUP), and a footer with Feedback, How it works, About and Sign out. Desktop puts Watch and Set
// up side by side under the card; phones stack them, with taller rows. Guests on phones get GuestPanel: search, the
// main pages and Sign in / Sign up.
import {
	EyeIcon,
	PencilSquareIcon,
	ShareIcon,
	StarIcon,
} from "@heroicons/react/24/outline"
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { type MouseEvent, type ReactNode, useMemo, useState } from "react"
import {
	EDIT_PROFILE_PATH,
	RATE_FALLBACK_PATH,
	WATCH_PATHS,
	member,
	ratePath,
	tasteHome,
	tastePath,
} from "~/domain/member-paths"
import { libraryCounts } from "~/domain/my-library"
import { useUserData } from "~/routes/api.user-data"
import { useSignOut } from "~/ui/auth/useSignOut"
import { openFeedback } from "~/ui/feedback/FeedbackTab"
import { DiscordMark } from "~/ui/footer/links"
import { useNavigation } from "~/ui/navigation/NavigationContext"
import { holdKeyboardForSearch } from "~/ui/navigation/Search"
import {
	MENU_FOOTER,
	MENU_SETUP,
	MENU_WATCH,
	type Place,
} from "~/ui/navigation/areas"
import { NewEpisodesMark } from "~/ui/navigation/bits"
import { guestMenuPages, palettePages } from "~/ui/navigation/palette-pages"
import { useNewEpisodes } from "~/ui/navigation/useNewEpisodes"
import { profilePath } from "~/ui/share-card/links"
import { useUser } from "~/utils/auth"
import { useAuthHref } from "~/utils/auth-href"
import { AccountAvatar } from "./AccountAvatar"
import { useAccountSummary } from "./useAccountSummary"

const count = (n: number) => n.toLocaleString("en-US")

const ROW =
	"flex w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] font-medium text-gray-200 hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-hidden"
const rowHeight = (big?: boolean) => (big ? "min-h-12" : "min-h-10")

interface PanelProps {
	close: () => void
	/** Phones: taller rows and buttons for touch. */
	big?: boolean
}

/** Opens the Feedback drawer; without a Feedback tab on the page, goes to Support instead. */
function feedbackFrom(close: () => void) {
	return (event: MouseEvent<HTMLElement>) => {
		const opener = event.currentTarget
		close()
		if (!openFeedback(opener)) window.location.assign("/support")
	}
}

/** My shows' new-episodes number; it reads the header's signal, so it sends no request of its own. */
function NewEpisodesBadge() {
	return <NewEpisodesMark words={useNewEpisodes()} />
}

/** A place as a link, or as a button when it acts (Feedback). */
function PlaceLink({
	place,
	close,
	className,
	children,
}: {
	place: Place
	close: () => void
	className: string
	children: ReactNode
}) {
	if (place.action === "feedback")
		return (
			<button type="button" onClick={feedbackFrom(close)} className={className}>
				{children}
			</button>
		)
	return (
		<Link
			to={place.href ?? "/"}
			prefetch="intent"
			onClick={close}
			className={className}
		>
			{children}
		</Link>
	)
}

function PlaceRow({ place, close, big }: PanelProps & { place: Place }) {
	return (
		<PlaceLink
			place={place}
			close={close}
			className={`${ROW} ${rowHeight(big)}`}
		>
			<place.icon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
			<span className="grow truncate">{place.label}</span>
			{place.badge === "new-episodes" && <NewEpisodesBadge />}
		</PlaceLink>
	)
}

function Group({
	name,
	places,
	close,
	big,
}: PanelProps & { name: string; places: Place[] }) {
	return (
		<div>
			<p className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
				{name}
			</p>
			{places.map((place) => (
				<PlaceRow key={place.id} place={place} close={close} big={big} />
			))}
		</div>
	)
}

const ICON_KEY =
	"flex shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-200 hover:bg-white/[0.08] hover:text-white"
const iconKeySize = (big?: boolean) => (big ? "size-11" : "size-10")

/** Share profile: the phone's share sheet on touch screens, else the link is copied. */
function ShareKey({ handle, big }: { handle: string; big?: boolean }) {
	const [done, setDone] = useState(false)
	const onClick = async () => {
		const url = `${window.location.origin}${profilePath(handle)}`
		try {
			if (navigator.share && window.matchMedia("(pointer: coarse)").matches)
				await navigator.share({ title: `@${handle} on GoodWatch`, url })
			else await navigator.clipboard.writeText(url)
		} catch {
			return
		}
		setDone(true)
		setTimeout(() => setDone(false), 1500)
	}
	const label = done ? "Link copied" : "Share profile"
	return (
		<button
			type="button"
			data-copy-link
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`${ICON_KEY} ${iconKeySize(big)} ${done ? "text-emerald-300" : ""}`}
		>
			<ShareIcon className="h-5 w-5" aria-hidden />
			<span aria-live="polite" className="sr-only">
				{done ? "Link copied" : ""}
			</span>
		</button>
	)
}

function IconLink({
	to,
	label,
	icon: Icon,
	close,
	big,
}: PanelProps & { to: string; label: string; icon: typeof EyeIcon }) {
	return (
		<Link
			to={to}
			onClick={close}
			aria-label={label}
			title={label}
			className={`${ICON_KEY} ${iconKeySize(big)}`}
		>
			<Icon className="h-5 w-5" aria-hidden />
		</Link>
	)
}

/** How many lists the member has. The menu asks when it opens, so the number stays off the page's first load. */
function useListCount(): number | null {
	const { user } = useUser()
	const { data } = useQuery<{ count: number | null }>({
		queryKey: ["account-lists", user?.id],
		queryFn: async () => (await fetch("/api/account-lists")).json(),
		enabled: Boolean(user?.id),
	})
	return data?.count ?? null
}

interface Stat {
	label: string
	to: string
	/** The number; null while it loads. Rate more has none: its list never ends. */
	value: number | null
	star?: boolean
}

/** Who you are: avatar and handle (your profile), the three profile actions, and four counts. */
function ProfileCard({ close, big }: PanelProps) {
	const me = useAccountSummary()
	const { data } = useUserData()
	const lists = useListCount()
	const library = useMemo(() => (data ? libraryCounts(data) : null), [data])
	const handle = me.handle
	const stats: Stat[] = [
		{
			label: "Seen",
			to: handle ? tastePath(handle, "seen") : WATCH_PATHS.showsSeen,
			value: library?.seen ?? null,
		},
		{
			label: "Want",
			to: handle ? tastePath(handle, "wishlist") : WATCH_PATHS.wishlist,
			value: library?.want ?? null,
		},
		{
			label: "Lists",
			to: handle ? tastePath(handle, "lists") : "/lists/mine",
			value: lists,
		},
		{
			label: "Rate more",
			to: handle ? ratePath(member(handle)) : RATE_FALLBACK_PATH,
			value: null,
			star: true,
		},
	]
	return (
		<div className="m-2 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-1 ring-1 ring-white/10">
			<div className="flex items-center gap-1 pr-1">
				<Link
					to={handle ? tasteHome(member(handle)) : EDIT_PROFILE_PATH}
					prefetch="intent"
					onClick={close}
					className="flex min-w-0 grow items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.05]"
				>
					<AccountAvatar
						url={me.avatarUrl}
						color={me.color}
						initial={me.initial}
						size={52}
					/>
					<span className="min-w-0">
						<b className="block truncate text-lg text-white">
							{handle ? `@${handle}` : "Your profile"}
						</b>
						<span className="block truncate text-sm text-gray-400">
							{handle
								? "Your profile and taste"
								: me.loaded
									? "Pick a handle to get your profile"
									: ""}
						</span>
					</span>
				</Link>
				<IconLink
					to={EDIT_PROFILE_PATH}
					label="Edit profile"
					icon={PencilSquareIcon}
					close={close}
					big={big}
				/>
				{handle && (
					<>
						<IconLink
							to={tastePath(handle, "profile", { as: "visitor" })}
							label="View as visitor"
							icon={EyeIcon}
							close={close}
							big={big}
						/>
						<ShareKey handle={handle} big={big} />
					</>
				)}
			</div>
			<div className="grid grid-cols-4 gap-1 px-1 pb-1">
				{stats.map((stat) => (
					<Link
						key={stat.label}
						to={stat.to}
						prefetch="intent"
						onClick={close}
						className="flex flex-col items-center rounded-xl py-2 hover:bg-white/[0.06]"
					>
						{stat.star ? (
							<StarIcon
								className="my-[3px] h-[22px] w-[22px] text-amber-400"
								aria-hidden
							/>
						) : (
							<b className="text-lg leading-tight tabular-nums text-white">
								{stat.value != null ? count(stat.value) : "–"}
							</b>
						)}
						<span className="text-[12px] text-gray-400">{stat.label}</span>
					</Link>
				))}
			</div>
		</div>
	)
}

/** Feedback, How it works and About as quiet links, Sign out at the end. */
function Footer({ close }: PanelProps) {
	const signOut = useSignOut()
	return (
		<div className="flex items-center justify-between border-t border-white/10">
			<div className="flex flex-wrap gap-x-1 gap-y-0.5 px-2.5 py-2">
				{MENU_FOOTER.map((place) => (
					<PlaceLink
						key={place.id}
						place={place}
						close={close}
						className="cursor-pointer rounded-lg px-1.5 py-1 text-[13px] text-gray-400 hover:bg-white/[0.06] hover:text-white"
					>
						{place.label}
					</PlaceLink>
				))}
			</div>
			<button
				type="button"
				onClick={signOut}
				className="mr-3 shrink-0 cursor-pointer rounded-full px-3 py-1 text-[13px] font-semibold text-gray-200 hover:bg-white/[0.06] hover:text-white"
			>
				Sign out
			</button>
		</div>
	)
}

/** Desktop: the card, then Watch and Set up side by side. */
export function DesktopAccountPanel({ close }: { close: () => void }) {
	return (
		<>
			<ProfileCard close={close} />
			<div className="grid grid-cols-2 divide-x divide-white/10 pb-2">
				<Group name="Watch" places={MENU_WATCH} close={close} />
				<Group name="Set up" places={MENU_SETUP} close={close} />
			</div>
			<Footer close={close} />
		</>
	)
}

/** Phones: the same parts in one column. */
export function PhoneAccountPanel({ close }: { close: () => void }) {
	return (
		<>
			<ProfileCard close={close} big />
			<div className="pb-1">
				<Group name="Watch" places={MENU_WATCH} close={close} big />
				<Group name="Set up" places={MENU_SETUP} close={close} big />
			</div>
			<Footer close={close} big />
		</>
	)
}

/** Phones, guests: search, the main pages as tiles, then Sign in and Sign up. */
export function GuestPanel({ close }: { close: () => void }) {
	const navigation = useNavigation()
	const authHref = useAuthHref()
	const signUp = authHref("sign-up")
	const pages = useMemo(
		() =>
			guestMenuPages(
				palettePages({ member: false, handle: null, signUpHref: signUp }),
			),
		[signUp],
	)
	return (
		<div className="pt-3">
			<button
				type="button"
				onClick={() => {
					close()
					holdKeyboardForSearch()
					navigation.setSearchOpen(true)
				}}
				className="mx-4 mb-3 flex h-12 w-[calc(100%-2rem)] cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.07] px-4 text-left text-[16px] text-gray-400 ring-1 ring-white/10"
			>
				<MagnifyingGlassIcon className="size-5 text-amber-300" aria-hidden />
				Search titles, people, moods
			</button>
			<div className="grid grid-cols-3 gap-1 px-3 pb-2">
				{pages.map((page) => {
					const Icon = page.icon === "discord" ? DiscordMark : page.icon
					return (
						<Link
							key={page.key}
							to={page.href}
							prefetch="intent"
							onClick={close}
							className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center text-[13px] leading-tight font-semibold text-gray-200 active:bg-white/[0.06]"
						>
							<Icon className="size-6 text-amber-400" aria-hidden />
							{page.label}
						</Link>
					)
				})}
			</div>
			<div className="flex gap-2 border-t border-white/10 px-4 pt-4 pb-2">
				<Link
					rel="nofollow"
					to={authHref("sign-in")}
					onClick={close}
					className="flex h-11 flex-1 items-center justify-center rounded-full bg-white/[0.07] font-semibold"
				>
					Sign in
				</Link>
				<Link
					rel="nofollow"
					to={signUp}
					onClick={close}
					className="flex h-11 flex-1 items-center justify-center rounded-full bg-amber-400 font-bold text-black"
				>
					Sign up
				</Link>
			</div>
		</div>
	)
}
