import { useFetcher } from "@remix-run/react"
import { errorBox, primaryButton, secondaryButton, stepHeading } from "./shared"

export function PlexConnectControls({
	state,
	pending,
	error,
}: { state?: string; pending: boolean; error?: string }) {
	return (
		<>
			<h3 className={stepHeading}>
				{state ? "Return from Plex" : "Connect Plex"}
			</h3>
			<p className="text-gray-400">
				Bring each movie and episode play from your own Plex Media Server, plus
				Want to See from your personal watchlist feed. Review everything before
				changing your library.
			</p>
			<p className="text-sm text-gray-400">
				GoodWatch must reach your server through public HTTPS Remote Access. A
				server available only on your home network cannot be read. The receipt
				explains any server or feed that could not be read.
			</p>
			<p className="text-sm text-gray-400">
				Plex grants broad access. GoodWatch uses it for this import only and
				discards the token before preview. Finish within ten minutes. You can
				also remove GoodWatch from Plex’s Authorized Devices. Only approve a
				connection you started here.
			</p>
			{state && (
				<>
					<input type="hidden" name="state" value={state} />
					<label className="flex flex-col gap-2">
						Personal watchlist RSS URL (optional)
						<input
							type="url"
							name="feed"
							placeholder="https://rss.plex.tv/…"
							autoComplete="off"
							disabled={pending}
							className="rounded bg-gray-800 p-2"
						/>
					</label>
					<p className="text-sm text-gray-400">
						Plex Pass members: open Plex Settings → Watchlist and generate your
						personal RSS feed, not your friends’ feed. Only items included in
						the feed can be imported; it may not contain your complete
						watchlist.
					</p>
					<a
						href="https://support.plex.tv/articles/universal-watchlist/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-300 underline"
					>
						Plex watchlist feed instructions (new tab)
					</a>
				</>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="submit"
					formAction={`/api/imports/plex/${state ? "return" : "start"}`}
					className={primaryButton}
					disabled={pending}
				>
					{pending
						? "Connecting…"
						: state
							? "Preview Plex import"
							: "Sign in with Plex"}
				</button>
				{state && (
					<button
						type="submit"
						formAction="/api/imports/plex/abandon"
						formNoValidate
						className={secondaryButton}
						disabled={pending}
					>
						Cancel connection
					</button>
				)}
				{state && error && (
					<button
						type="submit"
						formAction="/api/imports/plex/start"
						formNoValidate
						className={secondaryButton}
						disabled={pending}
					>
						Start a new connection
					</button>
				)}
			</div>
			{error && (
				<p className={errorBox} role="alert">
					{error}
				</p>
			)}
		</>
	)
}
export function PlexConnectPanel({ state }: { state?: string }) {
	const fetcher = useFetcher<{ error?: string }>()
	return (
		<fetcher.Form method="post" className="flex flex-col gap-4">
			<PlexConnectControls
				state={state}
				pending={fetcher.state !== "idle"}
				error={fetcher.data?.error}
			/>
		</fetcher.Form>
	)
}
