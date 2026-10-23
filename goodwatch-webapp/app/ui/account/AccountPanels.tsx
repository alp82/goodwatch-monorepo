// The account menu's contents. Desktop: who you are on top (your profile, or picking a handle), then Library, You
// and App as labeled groups, Sign out last. Phones (the header's panel and the Hub's account row): the same order in
// less height: the six places as a two-column grid, Settings and Sign out side by side, the rest as one line.
import {
	ArrowRightStartOnRectangleIcon,
	LinkIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import { useSignOut } from "~/ui/auth/useSignOut"
import { PROFILE_PATH } from "~/ui/settings/paths"
import { profilePath } from "~/ui/share-card/links"
import { AccountAvatar } from "./AccountAvatar"
import {
	APP_PLACES,
	type AccountPlace,
	LIBRARY_PLACES,
	SETTINGS_PLACE,
	YOU_PLACES,
} from "./links"
import { useAccountCounts, useAccountSummary } from "./useAccountSummary"

const count = (n: number) => n.toLocaleString("en-US")

function CopyLink({
	handle,
	iconOnly = false,
	className = "",
}: { handle: string; iconOnly?: boolean; className?: string }) {
	const [done, setDone] = useState(false)
	return (
		<button
			type="button"
			onClick={() => {
				navigator.clipboard
					?.writeText(`${window.location.origin}${profilePath(handle)}`)
					.catch(() => {})
				setDone(true)
				setTimeout(() => setDone(false), 1500)
			}}
			className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full text-gray-300 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-white ${className}`}
			aria-label={
				iconOnly
					? done
						? "Profile link copied"
						: "Copy profile link"
					: undefined
			}
			title="Copy profile link"
		>
			<LinkIcon className="h-4 w-4" aria-hidden />
			{!iconOnly && (
				<span className="text-xs font-semibold">
					{done ? "Copied" : "Copy link"}
				</span>
			)}
			{iconOnly && done && (
				<span className="text-xs font-semibold">Copied</span>
			)}
		</button>
	)
}

/** Who you are: your picture and @handle with your profile, or the way to pick a handle. */
function Identity({
	close,
	compact,
}: { close: () => void; compact?: boolean }) {
	const me = useAccountSummary()
	const avatar = (
		<AccountAvatar
			url={me.avatarUrl}
			color={me.color}
			initial={me.initial}
			size={compact ? 40 : 44}
		/>
	)
	if (!me.handle)
		return (
			<Link
				to={PROFILE_PATH}
				onClick={close}
				className={`flex items-center gap-3 hover:bg-white/[0.04] ${compact ? "p-3" : "px-4 pt-4 pb-3"}`}
			>
				{avatar}
				<span className="min-w-0">
					{me.email && (
						<span className="block truncate text-sm text-gray-400">
							{me.email}
						</span>
					)}
					<span className="block font-bold text-amber-400">
						{me.loaded ? "Pick a handle to get your profile" : "Your profile"}
					</span>
				</span>
			</Link>
		)
	return (
		<div className={compact ? "flex items-center gap-3 p-3" : "px-4 pt-4 pb-3"}>
			<div className="flex min-w-0 grow items-center gap-3">
				{avatar}
				<div className="min-w-0">
					<p className="truncate font-bold text-white">@{me.handle}</p>
					{me.email && (
						<p className="truncate text-sm text-gray-400">{me.email}</p>
					)}
				</div>
			</div>
			<div
				className={
					compact
						? "flex shrink-0 items-center gap-2"
						: "mt-3 flex items-center gap-2"
				}
			>
				<Link
					to={profilePath(me.handle)}
					onClick={close}
					className={`flex h-10 items-center justify-center rounded-full bg-white/[0.06] px-4 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/10 ${compact ? "" : "grow"}`}
				>
					{compact ? "Profile" : "View profile"}
				</Link>
				<CopyLink
					handle={me.handle}
					iconOnly={compact}
					className={compact ? "h-10 w-10" : "h-10 px-3"}
				/>
			</div>
		</div>
	)
}

const ROW =
	"flex min-h-10 w-full items-center gap-3 px-4 text-left text-[15px] font-medium text-gray-200 hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-hidden"

function Row({ place, close }: { place: AccountPlace; close: () => void }) {
	const counts = useAccountCounts()
	const n = place.count && counts ? counts[place.count] : null
	return (
		<Link to={place.to} onClick={close} className={ROW}>
			<place.icon className="h-5 w-5 text-amber-400" aria-hidden />
			<span className="grow">{place.label}</span>
			{n != null && (
				<span className="text-sm tabular-nums text-gray-500">{count(n)}</span>
			)}
		</Link>
	)
}

function Group({ name, children }: { name: string; children: ReactNode }) {
	return (
		<div className="border-t border-white/10 py-1.5">
			<p className="px-4 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
				{name}
			</p>
			{children}
		</div>
	)
}

function SignOutButton({ className }: { className: string }) {
	const signOut = useSignOut()
	return (
		<button type="button" className={className} onClick={signOut}>
			<ArrowRightStartOnRectangleIcon
				className="h-5 w-5 text-gray-500"
				aria-hidden
			/>
			Sign out
		</button>
	)
}

export function DesktopAccountPanel({ close }: { close: () => void }) {
	return (
		<>
			<Identity close={close} />
			<Group name="Library">
				{LIBRARY_PLACES.map((place) => (
					<Row key={place.label} place={place} close={close} />
				))}
			</Group>
			<Group name="You">
				{YOU_PLACES.map((place) => (
					<Row key={place.label} place={place} close={close} />
				))}
			</Group>
			<Group name="App">
				{[SETTINGS_PLACE, ...APP_PLACES].map((place) => (
					<Row key={place.label} place={place} close={close} />
				))}
			</Group>
			<div className="border-t border-white/10 py-1.5">
				<SignOutButton className={ROW} />
			</div>
		</>
	)
}

const TILE =
	"flex min-h-11 items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 text-left text-[15px] font-medium text-gray-100 ring-1 ring-white/[0.06] hover:bg-white/[0.08]"

/** Phones: the header's account panel, and the Hub's account row. `framed` draws the dividers of a panel. */
export function PhoneAccountPanel({
	close,
	framed = true,
}: { close: () => void; framed?: boolean }) {
	const counts = useAccountCounts()
	const line = framed ? "border-t border-white/10" : ""
	return (
		<>
			<Identity close={close} compact />
			<div className={`grid grid-cols-2 gap-2 p-3 ${line}`}>
				{[...LIBRARY_PLACES, ...YOU_PLACES].map((place) => {
					const n = place.count && counts ? counts[place.count] : null
					return (
						<Link
							key={place.label}
							to={place.to}
							onClick={close}
							className={TILE}
						>
							<place.icon
								className="h-5 w-5 shrink-0 text-amber-400"
								aria-hidden
							/>
							<span className="min-w-0 grow truncate">
								{place.short ?? place.label}
							</span>
							{n != null && (
								<span className="text-xs tabular-nums text-gray-500">
									{count(n)}
								</span>
							)}
						</Link>
					)
				})}
			</div>
			<div
				className={`grid grid-cols-2 gap-2 px-3 pb-3 ${framed ? "border-t border-white/10 pt-3" : ""}`}
			>
				<Link to={SETTINGS_PLACE.to} onClick={close} className={TILE}>
					<SETTINGS_PLACE.icon
						className="h-5 w-5 shrink-0 text-amber-400"
						aria-hidden
					/>
					{SETTINGS_PLACE.label}
				</Link>
				<SignOutButton className={TILE} />
			</div>
			<p
				className={`flex flex-wrap items-center gap-x-1 px-3 pt-1 text-sm text-gray-400 ${framed ? "border-t border-white/10 pb-[max(0.5rem,env(safe-area-inset-bottom))]" : "pb-1"}`}
			>
				{APP_PLACES.map((place) => (
					<Link
						key={place.label}
						to={place.to}
						onClick={close}
						className="inline-flex min-h-10 items-center rounded-lg px-2 hover:text-white"
					>
						{place.label}
					</Link>
				))}
			</p>
		</>
	)
}
