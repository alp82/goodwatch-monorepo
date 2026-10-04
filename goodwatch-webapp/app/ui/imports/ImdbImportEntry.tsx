// The way into the IMDb import from where a person rates titles: one quiet line above the taste quiz.
// A member goes straight to the import. A guest signs up first and lands on the import afterwards.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { useAuthHref } from "~/utils/auth-href"
import { IMPORTS_PATH } from "./shared"

const DISMISSED_KEY = "goodwatch_imdb_import_entry_dismissed"

export function ImdbImportEntry({
	member,
	className = "",
}: { member: boolean; className?: string }) {
	const authHref = useAuthHref()
	const [dismissed, setDismissed] = useState(false)
	useEffect(() => {
		try {
			if (window.localStorage.getItem(DISMISSED_KEY)) setDismissed(true)
		} catch {}
	}, [])
	if (dismissed) return null

	const dismiss = () => {
		setDismissed(true)
		try {
			window.localStorage.setItem(DISMISSED_KEY, "1")
		} catch {}
	}

	return (
		<aside
			aria-label="Import from IMDb"
			className={`mx-auto flex max-w-7xl items-center gap-1 px-4 pt-2 text-sm text-gray-300 md:px-8 ${className}`}
		>
			<p className="min-w-0">
				Already rate on IMDb?{" "}
				<Link
					rel={member ? undefined : "nofollow"}
					to={member ? IMPORTS_PATH : authHref("sign-up", IMPORTS_PATH)}
					className="inline-flex min-h-11 items-center font-semibold text-amber-300 underline-offset-2 hover:text-amber-200 hover:underline md:min-h-9"
				>
					{member
						? "Import your ratings"
						: "Sign up free to import your ratings"}
				</Link>
			</p>
			<button
				type="button"
				aria-label="Hide the IMDb import hint"
				onClick={dismiss}
				className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:text-gray-200 md:h-9 md:w-9"
			>
				<XMarkIcon className="h-5 w-5" aria-hidden />
			</button>
		</aside>
	)
}
