// A Settings page: each tile on /settings opens one (/settings/country, /settings/imports, ...). A full page with the
// way back to Settings, the page's name in the My library heading font, and what the setting does.
import { ChevronLeftIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { SETTINGS_PATH } from "./paths"

export function SettingsPage({
	title,
	intro,
	children,
}: {
	title: string
	intro?: ReactNode
	children: ReactNode
}) {
	return (
		<div className="overflow-x-clip pb-32" data-settings-page>
			<header className="mx-auto max-w-6xl px-4 pt-6 pb-6 md:px-8 md:pt-8">
				<Link
					to={SETTINGS_PATH}
					prefetch="intent"
					className="-ml-1 mb-2 inline-flex min-h-8 items-center gap-0.5 rounded-lg pr-2 text-sm text-gray-400 hover:text-white"
				>
					<ChevronLeftIcon className="h-4 w-4" aria-hidden />
					Settings
				</Link>
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{title}</h1>
				{intro && <p className="mt-2 max-w-2xl text-base text-gray-400">{intro}</p>}
			</header>
			<div className="mx-auto max-w-6xl px-4 text-base text-gray-300 md:px-8">{children}</div>
		</div>
	)
}

/** A titled part of a Settings page. */
export function PagePart({
	title,
	hint,
	children,
}: {
	title: string
	hint?: ReactNode
	children: ReactNode
}) {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="text-lg font-bold text-white">{title}</h2>
				{hint && <p className="max-w-prose text-sm text-gray-400">{hint}</p>}
			</div>
			{children}
		</section>
	)
}
