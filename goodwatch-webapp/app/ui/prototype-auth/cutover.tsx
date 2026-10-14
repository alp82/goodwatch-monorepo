// PROTOTYPE - throwaway (issue #534). The one-time "please sign in again" notice after the move away from Supabase.
// It shows only in a browser that still holds the old Supabase cookie; showing it clears that cookie, so it never repeats.
//   A: a banner under the header of whatever page the member opened; Sign in leads to the sign-in page with the reason.
//   B: a dialog over that page with the sign-in inside it, so the member never leaves the page.
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { useState } from "react"
import { EmailField, GoogleButton, OrDivider, PasswordField, POSTERS, PrimaryButton, posterUrl, useFakeSubmit, useGo } from "~/ui/prototype-auth/kit"

// A stand-in for the page the member opened: a row of posters, signed out.
function FakePage() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<h2 className="mb-1 text-2xl font-bold text-white">Popular right now</h2>
			<p className="mb-5 text-gray-400">A stand-in for the page the member opened.</p>
			<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
				{POSTERS.slice(0, 6).map((poster) => (
					<div key={poster.path} className="aspect-[2/3] overflow-hidden rounded-lg bg-gray-800">
						<img src={posterUrl(poster.path)} alt={poster.title} className="h-full w-full object-cover" />
					</div>
				))}
			</div>
		</div>
	)
}

export function CutoverBanner({ state }: { state: string }) {
	const go = useGo()
	const [open, setOpen] = useState(state !== "dismissed")
	return (
		<div>
			{open && (
				<div className="border-b border-amber-700/60 bg-amber-950/80">
					<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
						<ArrowPathIcon className="hidden h-6 w-6 shrink-0 text-amber-400 sm:block" />
						<p className="min-w-0 flex-1 basis-64 text-sm text-amber-50">
							<strong className="font-semibold">GoodWatch has a new sign-in, so you were signed out once.</strong> Everything you saved is still here.
						</p>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => go({ screen: "sign-in", state: "cutover" })}
								className="cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
							>
								Sign in
							</button>
							<button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-lg p-2 text-amber-200 hover:bg-amber-900" aria-label="Dismiss">
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
					</div>
				</div>
			)}
			<FakePage />
		</div>
	)
}

export function CutoverDialog() {
	const go = useGo()
	const [open, setOpen] = useState(true)
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const { busy, submit } = useFakeSubmit(() => go({ screen: "done", state: null }))
	return (
		<div>
			<FakePage />
			{open && (
				<div className="fixed inset-0 z-[1050] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6">
					<div role="dialog" aria-modal="true" aria-labelledby="cutover-title" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl sm:rounded-2xl sm:p-8">
						<div className="mb-5 flex items-start justify-between gap-4">
							<div>
								<h2 id="cutover-title" className="text-2xl font-bold text-white">
									Please sign in again
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-gray-300">
									GoodWatch has a new sign-in, so everyone signs in once more. Your ratings, Wishlist and shows are all still here. Use the same email and password, or Google.
								</p>
							</div>
							<button type="button" onClick={() => setOpen(false)} className="-mr-2 -mt-1 cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white" aria-label="Close">
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="space-y-5">
							<GoogleButton onDone={() => go({ screen: "done", state: null })} />
							<OrDivider />
							<form onSubmit={submit} className="space-y-4">
								<EmailField value={email} onChange={setEmail} />
								<PasswordField
									value={password}
									onChange={setPassword}
									labelAside={
										<button type="button" onClick={() => go({ screen: "forgot", state: "form" })} className="cursor-pointer text-sm text-amber-500 hover:text-amber-400">
											Forgot password?
										</button>
									}
								/>
								<PrimaryButton busy={busy}>Sign in</PrimaryButton>
							</form>
							<button type="button" onClick={() => setOpen(false)} className="w-full cursor-pointer text-center text-sm text-gray-400 hover:text-white">
								Not now
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
