// The signed-in member's account menu in the header: the avatar opens a disclosure (a button and a nav of links, not
// an ARIA menu). Desktop: a dropdown under the avatar. Phones (`compact`): a full-width panel under the header, moved
// to the page body so the header's and the dock's layers can't clip or cover it.
import { useLocation } from "@remix-run/react"
import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AccountAvatar } from "./AccountAvatar"
import { DesktopAccountPanel, PhoneAccountPanel } from "./AccountPanels"
import { useAccountSummary } from "./useAccountSummary"

export function AccountMenu({ compact }: { compact?: boolean }) {
	const { pathname, search } = useLocation()
	const me = useAccountSummary()
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const panelId = useId()

	// A link followed closes it.
	useEffect(() => setOpen(false), [pathname, search])
	useEffect(() => {
		if (!open) return
		const onDown = (event: PointerEvent) => {
			const target = event.target as HTMLElement
			if (
				root.current?.contains(target) ||
				target.closest(`[data-account-panel="${panelId}"]`)
			)
				return
			setOpen(false)
		}
		const onKey = (event: KeyboardEvent) =>
			event.key === "Escape" && setOpen(false)
		document.addEventListener("pointerdown", onDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open, panelId])

	const close = () => setOpen(false)
	return (
		<div ref={root} className="relative ml-2 shrink-0">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((o) => !o)}
				className="flex h-8 w-8 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				<span className="sr-only">Your account</span>
				<AccountAvatar
					url={me.avatarUrl}
					color={me.color}
					initial={me.initial}
					size={32}
					ring={open}
				/>
			</button>
			{open &&
				(compact ? (
					createPortal(
						<>
							<div
								aria-hidden
								className="fixed inset-x-0 top-16 bottom-0 z-[1001] bg-black/50"
							/>
							<nav
								id={panelId}
								data-account-panel={panelId}
								aria-label="Your account"
								className="fixed inset-x-2 top-[4.5rem] z-[1002] max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-2xl bg-gray-950 text-gray-100 shadow-2xl ring-1 ring-white/10"
							>
								<PhoneAccountPanel close={close} />
							</nav>
						</>,
						document.body,
					)
				) : (
					<nav
						id={panelId}
						data-account-panel={panelId}
						aria-label="Your account"
						className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-5rem)] w-80 overflow-y-auto overscroll-contain rounded-2xl bg-gray-950 text-gray-100 shadow-2xl ring-1 ring-white/10"
					>
						<DesktopAccountPanel close={close} />
					</nav>
				))}
		</div>
	)
}
