// The keys that open the menu: the Menu button at the header's right end (desktop) and the raised GoodWatch G in the
// middle of the dock (phones). Members get the account menu, guests a smaller menu with search, the main pages and
// Sign in. Both keys are in every page's first load; the menus load on first use (AccountMenu.tsx, mounted by
// ui/navigation/LazyDialogs.tsx). On desktop guests keep Sign in and Sign up in the header (GuestKeys).
//
// `data-account-key` marks them: the menu ignores presses on them when it closes on an outside press, gives focus back
// to the one on show, and the Feedback tab hides on phones only where one is (its way in is the menu's Feedback row).
import { Bars3Icon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ComponentType, SVGProps } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { useNavigation } from "~/ui/navigation/NavigationContext"
import { useUser } from "~/utils/auth"
import { useAuthHref } from "~/utils/auth-href"
import { AccountAvatar } from "./AccountAvatar"
import { useAccountSummary } from "./useAccountSummary"

/** The id of the account menu's panel, for aria-controls. */
export const ACCOUNT_MENU_ID = "account-menu"

/** The account key on show (the header's on desktop, the dock's on phones), to hand focus back to. */
export const visibleAccountKey = () =>
	[...document.querySelectorAll<HTMLElement>("[data-account-key]")].find(
		(el) =>
			el.isConnected &&
			el.getClientRects().length > 0 &&
			!el.closest("[inert]"),
	) ?? null

function useMenuKey() {
	const navigation = useNavigation()
	const open = navigation.accountOpen
	return {
		open,
		props: {
			type: "button" as const,
			"data-account-key": true,
			"aria-expanded": open,
			"aria-controls": open ? ACCOUNT_MENU_ID : undefined,
			onClick: () => navigation.setAccountOpen(!open),
		},
	}
}

/** Desktop, members: the Menu button at the header's right end. */
export function HeaderMenuKey() {
	const { open, props } = useMenuKey()
	return (
		<button
			{...props}
			className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full pr-3.5 pl-3 text-[14px] font-bold ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${open ? "bg-white/10" : "hover:bg-white/[0.07]"}`}
		>
			<GoodWatchG height={18} />
			Menu
			<Bars3Icon className="size-5 text-gray-400" aria-hidden />
		</button>
	)
}

/**
 * Phones: the GoodWatch G raised over the middle of the dock, set in a ring of the dock's colour so it reads as cut
 * into the bar. The dock leaves its column empty.
 */
export function DockMenuKey() {
	const { open, props } = useMenuKey()
	return (
		<button
			{...props}
			aria-label="Menu"
			className="absolute -top-[26px] left-1/2 flex size-[72px] -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-gray-950"
		>
			<span
				className={`flex size-[58px] items-center justify-center rounded-full bg-gradient-to-br from-white/[0.14] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ${open ? "ring-amber-400" : "ring-white/15"}`}
			>
				<GoodWatchG height={27} />
			</span>
		</button>
	)
}

/** The Profile area key's icon: the member's avatar (lit: an amber rim), the outline icon for guests. */
export function ProfileKeyIcon({
	size,
	on,
	fallback: Fallback,
}: {
	size: number
	on: boolean
	fallback: ComponentType<SVGProps<SVGSVGElement>>
}) {
	const { user } = useUser()
	const me = useAccountSummary()
	if (!user)
		return (
			<Fallback
				style={{ width: size, height: size }}
				className={on ? "text-amber-300" : ""}
				aria-hidden
			/>
		)
	return (
		<span
			className={`flex rounded-full p-[1.5px] ${on ? "bg-amber-400" : "bg-white/20"}`}
		>
			<AccountAvatar
				url={me.avatarUrl}
				color={me.color}
				initial={me.initial}
				size={size - 3}
			/>
		</span>
	)
}

/** Desktop, guests: Sign in (quiet) and Sign up (amber) where the Menu button sits. */
export function GuestKeys() {
	const authHref = useAuthHref()
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<Link
				rel="nofollow"
				to={authHref("sign-in")}
				className="flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold text-gray-200 hover:bg-white/[0.07]"
			>
				Sign in
			</Link>
			<Link
				rel="nofollow"
				to={authHref("sign-up")}
				className="flex h-10 items-center whitespace-nowrap rounded-full bg-amber-400 px-4 text-[14px] font-bold text-black hover:bg-amber-300"
			>
				Sign up
			</Link>
		</div>
	)
}
