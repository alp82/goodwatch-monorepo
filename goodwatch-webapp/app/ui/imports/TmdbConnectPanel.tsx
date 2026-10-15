import { useFetcher } from "@remix-run/react"
import { assetUrl } from "~/utils/asset-url"
import { errorBox, primaryButton, secondaryButton, stepHeading } from "./shared"

export function TmdbConnectControls({
	state,
	pending,
	error,
}: { state?: string; pending: boolean; error?: string }) {
	return (
		<>
			<h3 className={stepHeading}>
				{state ? "Return from TMDB" : "Connect TMDB"}
			</h3>
			<p className="text-gray-400">
				Bring your movie and show ratings, Want to See and favorites into
				GoodWatch. You will review everything before changing your library.
			</p>
			<p className="text-sm text-gray-400">
				TMDB grants read and write access. GoodWatch only reads your lists, then
				deletes the connection before showing your preview. Finish within 10
				minutes. Closing this page or canceling also schedules disconnection.
				Only approve links you opened yourself from this page, never forwarded
				links.
			</p>
			<div className="space-y-2 text-sm text-gray-400">
				<a href="https://www.themoviedb.org" aria-label="The Movie Database">
					<img
						src={assetUrl("/tmdb-logo.svg")}
						alt="TMDB"
						width={100}
						height={13}
					/>
				</a>
				<p>
					This product uses the TMDB API but is not endorsed or certified by
					TMDB.
				</p>
			</div>
			{state && <input type="hidden" name="state" value={state} />}
			<div className="flex flex-wrap gap-3">
				<button
					type="submit"
					formAction={`/api/imports/tmdb/${state ? "return" : "start"}`}
					className={primaryButton}
					disabled={pending}
				>
					{pending
						? "Connecting…"
						: state
							? "Preview TMDB import"
							: "Connect TMDB"}
				</button>
				{state && (
					<button
						type="submit"
						formAction="/api/imports/tmdb/abandon"
						className={secondaryButton}
						disabled={pending}
					>
						Cancel connection
					</button>
				)}
				{state && error && (
					<button
						type="submit"
						formAction="/api/imports/tmdb/start"
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

export function TmdbConnectPanel({ state }: { state?: string }) {
	const fetcher = useFetcher<{ error?: string }>()
	return (
		<fetcher.Form method="post" className="flex flex-col gap-4">
			<TmdbConnectControls
				state={state}
				pending={fetcher.state !== "idle"}
				error={fetcher.data?.error}
			/>
		</fetcher.Form>
	)
}
