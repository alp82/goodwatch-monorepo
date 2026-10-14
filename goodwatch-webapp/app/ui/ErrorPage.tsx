// The body of the error page: a missing page (404) or anything that went wrong. It sits between the site header and
// the footer that root.tsx's error boundary draws, and shows ways on instead of the error's own words.
import {
	ArrowPathIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	SparklesIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useNavigation } from "~/ui/navigation/NavigationContext"

const BUTTON =
	"flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold"
const PRIMARY = `${BUTTON} bg-amber-400 text-black hover:bg-amber-300`
const SECONDARY = `${BUTTON} bg-white/[0.07] text-gray-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.1]`

/**
 * @param status the response's status; 404 for an address that names no page, anything else is a failure.
 * @param detail what a developer needs, shown in development builds only.
 */
export function ErrorPage({
	status,
	detail,
}: {
	status: number
	detail?: string
}) {
	const { setSearchOpen } = useNavigation()
	const notFound = status === 404
	return (
		<main className="relative mx-auto mt-16 flex w-full max-w-xl grow flex-col items-center justify-center px-4 py-16 text-center text-neutral-300">
			<p className="brand-header text-7xl leading-none text-amber-400 sm:text-8xl">
				{status}
			</p>
			<h1 className="mt-5 text-3xl font-bold text-gray-100 sm:text-4xl">
				{notFound ? "Page not found" : "Something went wrong"}
			</h1>
			<p className="mt-3 text-base text-gray-400">
				{notFound
					? "This address doesn't lead anywhere. The page may have moved, or the link has a typo."
					: "The problem is on our side. Try again in a moment."}
			</p>
			<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
				{notFound ? (
					<Link to="/" className={PRIMARY}>
						<HomeIcon className="h-[18px] w-[18px]" aria-hidden />
						Home
					</Link>
				) : (
					<button
						type="button"
						className={PRIMARY}
						onClick={() => window.location.reload()}
					>
						<ArrowPathIcon className="h-[18px] w-[18px]" aria-hidden />
						Try again
					</button>
				)}
				{!notFound && (
					<Link to="/" className={SECONDARY}>
						<HomeIcon className="h-[18px] w-[18px]" aria-hidden />
						Home
					</Link>
				)}
				<Link to="/discover" className={SECONDARY}>
					<SparklesIcon className="h-[18px] w-[18px]" aria-hidden />
					Discover
				</Link>
				<button
					type="button"
					className={SECONDARY}
					onClick={() => setSearchOpen(true)}
				>
					<MagnifyingGlassIcon className="h-[18px] w-[18px]" aria-hidden />
					Search
				</button>
			</div>
			{detail && (
				<pre className="mt-10 max-h-48 w-full overflow-auto rounded-xl bg-gray-950 p-4 text-left text-xs text-gray-400 whitespace-pre-wrap break-words">
					{detail}
				</pre>
			)}
		</main>
	)
}
