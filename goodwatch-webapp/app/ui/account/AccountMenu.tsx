// The menu the Menu keys open: a disclosure (the keys and a nav of links, not an ARIA menu). Members, desktop: a
// panel under the header's Menu button (profile card, then Watch and Set up side by side). Phones: a one-column bottom sheet over the dock, as tall as its
// content, that scrolls when it must; guests get the guest panel there (desktop guests have Sign in in the header). It slides up with transform and opacity only, over a plain dim backdrop (no blur over motion). This module
// loads on first use (ui/navigation/LazyDialogs.tsx); the keys that open it are in ./AccountKey.tsx.
import { useEffect, useRef } from "react"
import { useNavigation } from "~/ui/navigation/NavigationContext"
import { useUser } from "~/utils/auth"
import { ACCOUNT_MENU_ID, visibleAccountKey } from "./AccountKey"
import {
	DesktopAccountPanel,
	GuestPanel,
	PhoneAccountPanel,
} from "./AccountPanels"

export function AccountMenu() {
	const { accountOpen: open, setAccountOpen } = useNavigation()
	const root = useRef<HTMLDivElement>(null)
	const { user } = useUser()

	useEffect(() => {
		if (!open) return
		const onDown = (event: PointerEvent) => {
			const target = event.target as HTMLElement
			// The keys toggle the menu themselves.
			if (
				root.current?.contains(target) ||
				target.closest("[data-account-key]")
			)
				return
			setAccountOpen(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			setAccountOpen(false)
			visibleAccountKey()?.focus({ preventScroll: true })
		}
		document.addEventListener("pointerdown", onDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open, setAccountOpen])

	if (!open) return null
	const close = () => setAccountOpen(false)
	return (
		<div ref={root} id={ACCOUNT_MENU_ID} data-account-menu>
			{/* Desktop: under the header's right end, where the Menu button sits. */}
			{user && (
				<div className="pointer-events-none fixed inset-x-0 top-16 z-[1001] hidden lg:block">
					<div className="mx-auto flex max-w-7xl justify-end px-8">
						<nav
							aria-label="Your account"
							className="pointer-events-auto mt-2 max-h-[calc(100dvh-5rem)] w-[min(580px,calc(100vw-2rem))] origin-top-right overflow-y-auto overscroll-contain rounded-2xl bg-gray-950 text-gray-100 shadow-2xl ring-1 ring-white/10 transition-[opacity,transform] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none"
						>
							<DesktopAccountPanel close={close} />
						</nav>
					</div>
				</div>
			)}
			{/* Phones: a bottom sheet over the dock. */}
			<div className="fixed inset-0 z-[1100] lg:hidden">
				<button
					type="button"
					aria-label="Close"
					tabIndex={-1}
					onClick={close}
					className="absolute inset-0 cursor-default bg-black/60 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
				/>
				<nav
					aria-label={user ? "Your account" : "Menu"}
					className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-gray-950 pb-[max(env(safe-area-inset-bottom),12px)] text-gray-100 shadow-2xl ring-1 ring-white/10 transition-transform duration-200 ease-out starting:translate-y-full motion-reduce:transition-none"
				>
					<span
						aria-hidden
						className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-white/20"
					/>
					{user ? (
						<PhoneAccountPanel close={close} />
					) : (
						<GuestPanel close={close} />
					)}
				</nav>
			</div>
		</div>
	)
}
