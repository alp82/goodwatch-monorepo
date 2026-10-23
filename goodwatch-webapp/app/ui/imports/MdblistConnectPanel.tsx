import { useFetcher } from "@remix-run/react"
import { errorBox, primaryButton, stepHeading, textLink } from "./shared"

// MDBList has no sign-in for other apps that limits access, so the member pastes their personal API key. The key
// goes to GoodWatch's server in this one form post and is used for this import only.
export function MdblistConnectControls({
	pending,
	error,
}: { pending: boolean; error?: string }) {
	return (
		<>
			<h3 className={stepHeading}>Connect MDBList</h3>
			<p className="text-gray-400">
				Bring your MDBList Watchlist, each watch with its date, episodes, movie
				and show ratings, and dropped shows into GoodWatch. You will review
				everything before changing your library.
			</p>
			<ol className="list-decimal space-y-1 pl-5 text-gray-300">
				<li>
					Sign in to MDBList and open{" "}
					<a
						href="https://mdblist.com/preferences/"
						target="_blank"
						rel="noopener noreferrer"
						className={textLink}
					>
						Preferences (new tab)
					</a>
					.
				</li>
				<li>Under API key, copy your key.</li>
				<li>Paste it here and choose Preview MDBList import.</li>
			</ol>
			<label className="flex flex-col gap-2">
				MDBList API key
				<input
					type="password"
					name="apiKey"
					required
					autoComplete="off"
					autoCapitalize="off"
					autoCorrect="off"
					spellCheck={false}
					maxLength={128}
					disabled={pending}
					className="rounded bg-gray-800 p-2 font-mono"
				/>
			</label>
			<p className="text-sm text-gray-400">
				Your key gives full access to your MDBList account. GoodWatch uses it
				once to read your account, never changes anything on MDBList, and
				doesn’t save the key. You can reset it in MDBList Preferences at any
				time. The import uses a few of your 1,000 daily MDBList requests; a
				large library uses a few dozen.
			</p>
			<div className="flex flex-wrap gap-3">
				<button
					type="submit"
					formAction="/api/imports/mdblist"
					className={primaryButton}
					disabled={pending}
				>
					{pending ? "Reading MDBList…" : "Preview MDBList import"}
				</button>
			</div>
			{error && (
				<p className={errorBox} role="alert">
					{error}
				</p>
			)}
		</>
	)
}

export function MdblistConnectPanel() {
	const fetcher = useFetcher<{ error?: string }>()
	return (
		<fetcher.Form method="post" className="flex flex-col gap-4">
			<MdblistConnectControls
				pending={fetcher.state !== "idle"}
				error={fetcher.data?.error}
			/>
		</fetcher.Form>
	)
}
