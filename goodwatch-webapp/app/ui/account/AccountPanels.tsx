// The account menu's contents, built from PLACES (ui/navigation/areas.ts), so its rows match the Settings column one
// to one. Desktop: two columns. On the left, who you are (your profile, View as visitor, Share profile, Edit profile)
// and Your data; on the right, Settings, Use GoodWatch elsewhere and Help, with Sign out at the bottom. Phones: the
// same groups in one column, with taller rows.
import {
	ArrowRightStartOnRectangleIcon,
	EyeIcon,
	ShareIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type MouseEvent, type ReactNode, useState } from "react"
import { tasteHome, tastePath, member } from "~/domain/member-paths"
import { useSignOut } from "~/ui/auth/useSignOut"
import { openFeedback } from "~/ui/feedback/FeedbackTab"
import {
	EDIT_PROFILE,
	PLACES,
	type Place,
	type PlaceGroup,
} from "~/ui/navigation/areas"
import { profilePath } from "~/ui/share-card/links"
import { AccountAvatar } from "./AccountAvatar"
import { useAccountCounts, useAccountSummary } from "./useAccountSummary"

const count = (n: number) => n.toLocaleString("en-US")

const ROW =
	"flex w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] font-medium text-gray-200 hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-hidden"
const rowHeight = (big?: boolean) => (big ? "min-h-11" : "min-h-9")

interface PanelProps {
	close: () => void
	/** Phones: taller rows for touch. */
	big?: boolean
}

function Group({
	name,
	children,
	first,
}: { name: string; children: ReactNode; first?: boolean }) {
	return (
		<div className={`py-1.5 ${first ? "" : "border-t border-white/10"}`}>
			<p className="px-4 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
				{name}
			</p>
			{children}
		</div>
	)
}

/** Opens the Feedback drawer; without a Feedback tab on the page, goes to Support instead. */
function feedbackFrom(close: () => void) {
	return (event: MouseEvent<HTMLElement>) => {
		const opener = event.currentTarget
		close()
		if (!openFeedback(opener)) window.location.assign("/support")
	}
}

function PlaceRow({ place, close, big }: PanelProps & { place: Place }) {
	const counts = useAccountCounts()
	const n =
		place.count === "not-interested" && counts ? counts.notInterested : null
	const inner = (
		<>
			<place.icon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
			<span className="grow truncate">{place.label}</span>
			{n != null && n > 0 && (
				<span className="text-sm tabular-nums text-gray-500">{count(n)}</span>
			)}
			{place.tag && (
				<span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-gray-400 ring-1 ring-white/10">
					{place.tag}
				</span>
			)}
		</>
	)
	if (place.action === "feedback")
		return (
			<button
				type="button"
				onClick={feedbackFrom(close)}
				className={`${ROW} ${rowHeight(big)}`}
			>
				{inner}
			</button>
		)
	return (
		<Link
			to={place.href ?? "/"}
			prefetch="intent"
			onClick={close}
			className={`${ROW} ${rowHeight(big)}`}
		>
			{inner}
		</Link>
	)
}

/** One Help link; Feedback opens the drawer instead. */
function HelpCell({ place, close, big }: PanelProps & { place: Place }) {
	const cell = `flex cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white ${big ? "min-h-11" : "min-h-9"}`
	const inner = (
		<>
			<place.icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
			<span className="truncate">{place.label}</span>
		</>
	)
	if (place.action === "feedback")
		return (
			<button type="button" onClick={feedbackFrom(close)} className={cell}>
				{inner}
			</button>
		)
	return (
		<Link to={place.href ?? "/"} onClick={close} className={cell}>
			{inner}
		</Link>
	)
}

/** Help: four short links, two by two. */
function HelpGrid({ places, close, big }: PanelProps & { places: Place[] }) {
	return (
		<div className="grid grid-cols-2 px-2">
			{places.map((p) => (
				<HelpCell key={p.id} place={p} close={close} big={big} />
			))}
		</div>
	)
}

function Groups({
	groups,
	close,
	big,
	first,
}: PanelProps & { groups: PlaceGroup[]; first?: boolean }) {
	return (
		<>
			{groups.map((group, i) =>
				group.name ? (
					<Group key={group.name} name={group.name} first={first && i === 0}>
						{group.grid ? (
							<HelpGrid places={group.places} close={close} big={big} />
						) : (
							group.places.map((p) => (
								<PlaceRow key={p.id} place={p} close={close} big={big} />
							))
						)}
					</Group>
				) : null,
			)}
		</>
	)
}

/** Share profile: the phone's share sheet on touch screens, else the link is copied. */
function ShareRow({ handle, big }: { handle: string; big?: boolean }) {
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
	return (
		<button
			type="button"
			data-copy-link
			onClick={onClick}
			className={`${ROW} ${rowHeight(big)}`}
		>
			<ShareIcon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
			<span className="grow">Share profile</span>
			<span
				aria-live="polite"
				className={`text-sm text-emerald-300 transition-opacity duration-150 ${done ? "opacity-100" : "opacity-0"}`}
			>
				{done ? "Link copied" : ""}
			</span>
		</button>
	)
}

/** Who you are: your profile, View as visitor, Share profile and Edit profile. Without a handle: Pick a handle. */
function Identity({ close, big }: PanelProps) {
	const me = useAccountSummary()
	const avatar = (
		<AccountAvatar
			url={me.avatarUrl}
			color={me.color}
			initial={me.initial}
			size={big ? 48 : 44}
		/>
	)
	const head = `flex items-center gap-3 px-4 hover:bg-white/[0.05] ${big ? "py-3.5" : "pt-4 pb-3"}`
	if (!me.handle)
		return (
			<>
				<Link
					to={EDIT_PROFILE.href ?? "/settings/profile"}
					onClick={close}
					className={head}
				>
					{avatar}
					<span className="min-w-0">
						{me.email && (
							<span
								data-feedback-private
								className="block truncate text-sm text-gray-400"
							>
								{me.email}
							</span>
						)}
						<span className="block font-bold text-amber-400">
							{me.loaded ? "Pick a handle to get your profile" : "Your profile"}
						</span>
					</span>
				</Link>
				<div className="pb-1.5">
					<PlaceRow place={EDIT_PROFILE} close={close} big={big} />
				</div>
			</>
		)
	return (
		<>
			<Link
				to={tasteHome(member(me.handle))}
				prefetch="intent"
				onClick={close}
				className={head}
			>
				{avatar}
				<span className="min-w-0">
					<b className="block truncate text-white">@{me.handle}</b>
					<span className="block truncate text-sm text-gray-400">
						Your profile and taste
					</span>
				</span>
			</Link>
			<div className="pb-1.5">
				<Link
					to={tastePath(me.handle, "profile", { as: "visitor" })}
					onClick={close}
					className={`${ROW} ${rowHeight(big)}`}
				>
					<EyeIcon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
					View as visitor
				</Link>
				<ShareRow handle={me.handle} big={big} />
				<PlaceRow place={EDIT_PROFILE} close={close} big={big} />
			</div>
		</>
	)
}

function SignOut({ big }: { big?: boolean }) {
	const signOut = useSignOut()
	return (
		<button
			type="button"
			onClick={signOut}
			className={`${ROW} ${big ? "min-h-12" : "min-h-11"}`}
		>
			<ArrowRightStartOnRectangleIcon
				className="h-5 w-5 text-gray-500"
				aria-hidden
			/>
			Sign out
		</button>
	)
}

/** Desktop: two columns side by side, Sign out at the bottom of the right one. */
export function DesktopAccountPanel({ close }: { close: () => void }) {
	return (
		<div className="grid grid-cols-2 divide-x divide-white/10">
			<div className="min-w-0">
				<Identity close={close} />
				<Groups groups={PLACES.left} close={close} />
			</div>
			<div className="flex min-w-0 flex-col">
				<Groups groups={PLACES.right} close={close} first />
				<span className="grow" />
				<div className="border-t border-white/10 py-1">
					<SignOut />
				</div>
			</div>
		</div>
	)
}

/** Phones: one column in the same order. */
export function PhoneAccountPanel({ close }: { close: () => void }) {
	return (
		<>
			<Identity close={close} big />
			<Groups groups={PLACES.left} close={close} big />
			<Groups groups={PLACES.right} close={close} big />
			<div className="border-t border-white/10 py-1">
				<SignOut big />
			</div>
		</>
	)
}
