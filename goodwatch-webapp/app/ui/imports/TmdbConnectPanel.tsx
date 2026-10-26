import { useFetcher, useSearchParams } from "@remix-run/react"
import { assetUrl } from "~/utils/asset-url"
import { errorBox, primaryButton, secondaryButton, stepHeading } from "./shared"

export function TmdbConnectControls({
	state,
	pending,
	error,
	denied = false,
}: { state?: string; pending: boolean; error?: string; denied?: boolean }) {
	const message =
		error ??
		(denied
			? "TMDB sign-in was denied. Close this connection or start again."
			: undefined)
	return (
		<>
			<h3 className={stepHeading}>
				{state ? "Return from TMDB" : "Connect TMDB"}
			</h3>
			<p className="text-gray-400">
				Bring your movie and show ratings, Want to See, favorites, and custom
				lists into GoodWatch. Imported lists start private. You will review
				everything before changing your library.
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
			{denied && <input type="hidden" name="denied" value="true" />}
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
							? denied
								? "Close connection"
								: "Preview TMDB import"
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
				{state && message && (
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
			{message && (
				<p className={errorBox} role="alert">
					{message}
				</p>
			)}
		</>
	)
}

export function TmdbConnectPanel({ state }: { state?: string }) {
	const fetcher = useFetcher<{ error?: string }>()
	const [params] = useSearchParams()
	return (
		<fetcher.Form method="post" className="flex flex-col gap-4">
			<TmdbConnectControls
				state={state}
				denied={!!state && params.get("denied") === "true"}
				pending={fetcher.state !== "idle"}
				error={fetcher.data?.error}
			/>
		</fetcher.Form>
	)
}
