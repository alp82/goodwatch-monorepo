import { useEffect, useState } from "react"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { useUser } from "~/utils/auth"
import {
	useGuestInteractions,
	guestLimitEvent,
	reminderKey,
} from "~/utils/guest-progress"
import { SignInButton } from "~/ui/auth/SignInButton"

export function GuestProgressNotice() {
	const { user } = useUser()
	const interactions = useGuestInteractions()
	const [dismissed, setDismissed] = useState(true)
	const [limit, setLimit] = useState(false)
	useEffect(() => {
		try {
			setDismissed(localStorage.getItem(reminderKey) === "yes")
		} catch {
			setDismissed(false)
		}
		const show = () => setLimit(true)
		window.addEventListener(guestLimitEvent, show)
		return () => window.removeEventListener(guestLimitEvent, show)
	}, [user?.id])
	if (user) return null
	const message =
		"Your ratings, Wishlist and skips are saved in this browser. Clearing browser data can erase them. Create an account to keep your progress and country/services across visits and devices."
	return (
		<>
			{!dismissed &&
				interactions.filter((i) => i.type === "score").length >= 10 && (
					<aside
						className="mx-auto max-w-7xl px-4 py-3 text-sm text-gray-300 flex flex-wrap items-center gap-3"
						aria-label="Keep your progress"
					>
						<p className="flex-1 min-w-48">{message}</p>
						<SignInButton />
						<button
							type="button"
							onClick={() => {
								setDismissed(true)
								try {
									localStorage.setItem(reminderKey, "yes")
								} catch {}
							}}
							className="underline"
						>
							Dismiss
						</button>
					</aside>
				)}
			<Dialog
				open={limit}
				onClose={() => setLimit(false)}
				className="relative z-50"
			>
				<div className="fixed inset-0 bg-black/70" aria-hidden="true" />
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="max-w-md rounded-lg bg-gray-800 p-6 text-gray-100 space-y-4">
						<DialogTitle className="text-xl font-semibold">
							Keep rating with a free account
						</DialogTitle>
						<p>
							You've rated 20 titles in this browser. Create an account to rate
							another title. You can still edit ratings, use Want to See or
							Skip, and keep exploring.
						</p>
						<p className="text-sm text-gray-300">{message}</p>
						<SignInButton />
						<button
							type="button"
							className="block underline"
							onClick={() => setLimit(false)}
						>
							Keep exploring
						</button>
					</DialogPanel>
				</div>
			</Dialog>
		</>
	)
}
