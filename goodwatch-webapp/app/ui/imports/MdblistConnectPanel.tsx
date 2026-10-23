import { useLocation, useNavigate, useNavigation } from "@remix-run/react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { errorBox, primaryButton, stepHeading, textLink } from "./shared"

// MDBList has no sign-in for other apps that limits access, so the member pastes their personal API key. The key
// goes to GoodWatch's server in this one post and is used for this import only.
const MDBLIST_IMPORT_PATH = "/api/imports/mdblist"
export function MdblistConnectControls({
	pending,
	error,
	submissions = 0,
}: {
	pending: boolean
	error?: string
	/** Counts the form's submissions. Each one empties the key field, whatever MDBList answers. */
	submissions?: number
}) {
	const keyField = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (submissions > 0 && keyField.current) keyField.current.value = ""
	}, [submissions])
	return (
		<>
			<h3 className={stepHeading}>Connect MDBList</h3>
			<p className="text-gray-400">
				Bring your MDBList Watchlist, each watch with its date, episodes,
				ratings for movies, shows, seasons, and episodes, dropped shows, and
				your lists into GoodWatch. You will review everything before changing
				your library.
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
					ref={keyField}
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
				<button type="submit" className={primaryButton} disabled={pending}>
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

/**
 * Posts with fetch, not a Remix fetcher: a fetcher keeps its form data, and so the key, in router state while the
 * page revalidates. Here the key lives only in this function until the post is sent, and the field is emptied first.
 */
export function MdblistConnectPanel() {
	const navigate = useNavigate()
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string>()
	const [submissions, setSubmissions] = useState(0)
	// Leaving Imports aborts the post, so the server stops reading MDBList (it watches the request signal) and frees
	// the key. A late answer after that is ignored instead of bringing the member back here.
	const reading = useRef<AbortController | null>(null)
	useEffect(
		() => () => {
			reading.current?.abort()
			reading.current = null
		},
		[],
	)
	// Remix keeps Imports mounted while the next page loads, so leaving starts with the navigation, not the unmount.
	// Navigation within Imports, such as opening this read's own preview, keeps the read.
	const { pathname } = useLocation()
	const navigation = useNavigation()
	const leaving =
		navigation.state !== "idle" && navigation.location.pathname !== pathname
	useEffect(() => {
		if (!leaving || !reading.current) return
		reading.current.abort()
		reading.current = null
		setPending(false)
	}, [leaving])
	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (pending) return
		reading.current?.abort()
		const controller = new AbortController()
		reading.current = controller
		const field = event.currentTarget.elements.namedItem(
			"apiKey",
		) as HTMLInputElement | null
		const body = new URLSearchParams({ apiKey: field?.value ?? "" })
		if (field) field.value = ""
		setSubmissions((count) => count + 1)
		setPending(true)
		setError(undefined)
		try {
			const response = await fetch(MDBLIST_IMPORT_PATH, {
				method: "POST",
				headers: { Accept: "application/json" },
				body,
				signal: controller.signal,
			})
			const data = (await response.json().catch(() => ({}))) as {
				location?: unknown
				error?: unknown
			}
			if (controller.signal.aborted) return
			if (response.ok && typeof data.location === "string") {
				navigate(data.location)
				return
			}
			setError(
				typeof data.error === "string"
					? data.error
					: "The import could not be prepared. Please try again.",
			)
		} catch {
			if (controller.signal.aborted) return
			setError("GoodWatch couldn't reach its server. Please try again.")
		} finally {
			if (reading.current === controller) {
				reading.current = null
				setPending(false)
			}
		}
	}
	return (
		<form
			method="post"
			action={MDBLIST_IMPORT_PATH}
			onSubmit={submit}
			className="flex flex-col gap-4"
		>
			<MdblistConnectControls
				pending={pending}
				error={error}
				submissions={submissions}
			/>
		</form>
	)
}
