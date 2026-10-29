// The keys that open the account menu: the small avatar at the header's right end (desktop) and the "You" slot at the
// dock's right end (phones). They are in every page's first load; the menu itself loads on first use (AccountMenu.tsx,
// mounted by ui/navigation/LazyDialogs.tsx). Guests get Sign in and Sign up in the same places.
//
// `data-account-key` marks them: the menu ignores presses on them when it closes on an outside press, gives focus back
// to the one on show, and the Feedback tab hides on phones only where one is (its way in is the menu's Feedback row).
import { UserCircleIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { useNavigation } from "~/ui/navigation/NavigationContext"
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

function useAccountKey() {
	const navigation = useNavigation()
	const me = useAccountSummary()
	const open = navigation.accountOpen
	return {
		me,
		open,
		props: {
			type: "button" as const,
			"data-account-key": true,
			"aria-expanded": open,
			"aria-controls": open ? ACCOUNT_MENU_ID : undefined,
			"aria-label": me.handle ? `Your account, @${me.handle}` : "Your account",
			onClick: () => navigation.setAccountOpen(!open),
		},
	}
}

/** Desktop: the member's avatar at the header's right end. */
export function HeaderAccountKey() {
	const { me, open, props } = useAccountKey()
	return (
		<button
			{...props}
			className="ml-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
		>
			<AccountAvatar
				url={me.avatarUrl}
				color={me.color}
				initial={me.initial}
				size={34}
				ring={open}
			/>
		</button>
	)
}

/** Phones: the dock's last slot, the avatar over "You". */
export function DockAccountKey() {
	const { me, open, props } = useAccountKey()
	return (
		<button
			{...props}
			className="flex h-[62px] w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium text-gray-400"
		>
			<span
				className={`rounded-full p-[2px] ${open ? "bg-amber-400" : "bg-white/15"}`}
			>
				<AccountAvatar
					url={me.avatarUrl}
					color={me.color}
					initial={me.initial}
					size={30}
				/>
			</span>
			You
		</button>
	)
}

/** Phones, guests: the dock's last slot, a dashed empty avatar over "Sign in". */
export function DockSignIn() {
	const signIn = useAuthHref()("sign-in")
	return (
		<Link
			rel="nofollow"
			to={signIn}
			className="flex h-[62px] w-[68px] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-amber-200"
		>
			<span className="flex size-[30px] items-center justify-center rounded-full border border-dashed border-amber-300/60 text-amber-300">
				<UserCircleIcon className="size-5" aria-hidden />
			</span>
			Sign in
		</Link>
	)
}

/** Guests: Sign in (quiet) and Sign up (amber) where the avatar sits. `compact`: Sign up alone, smaller (phones). */
export function GuestKeys({ compact }: { compact?: boolean }) {
	const authHref = useAuthHref()
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			{!compact && (
				<Link
					rel="nofollow"
					to={authHref("sign-in")}
					className="flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold text-gray-200 hover:bg-white/[0.07]"
				>
					Sign in
				</Link>
			)}
			<Link
				rel="nofollow"
				to={authHref("sign-up")}
				className={`flex items-center whitespace-nowrap rounded-full bg-amber-400 font-bold text-black hover:bg-amber-300 ${compact ? "h-9 px-3.5 text-[13px]" : "h-10 px-4 text-[14px]"}`}
			>
				Sign up
			</Link>
		</div>
	)
}
