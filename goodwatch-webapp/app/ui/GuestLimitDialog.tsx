// The dialog a guest sees at the rating limit. GuestProgressNotice.tsx loads this module when it first shows.
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { SignInButton } from "~/ui/auth/SignInButton"

export default function GuestLimitDialog({
	open,
	onClose,
	message,
}: {
	open: boolean
	onClose: () => void
	message: string
}) {
	return (
		<Dialog open={open} onClose={onClose} className="relative z-50">
			<div className="fixed inset-0 bg-black/70" aria-hidden="true" />
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="max-w-md rounded-lg bg-gray-800 p-6 text-gray-100 space-y-4">
					<DialogTitle className="text-xl font-semibold">
						Keep rating with a free account
					</DialogTitle>
					<p>
						You've rated 20 titles in this browser. Create an account to rate
						another title. You can still edit ratings, use Want to See or Skip,
						and keep exploring.
					</p>
					<p className="text-sm text-gray-300">{message}</p>
					<SignInButton />
					<button type="button" className="block underline" onClick={onClose}>
						Keep exploring
					</button>
				</DialogPanel>
			</div>
		</Dialog>
	)
}
