// A Settings page: each row of the Settings column opens one (/settings/country, /settings/imports, ...). Inside the
// Settings frame (routes/settings.tsx) it has the small head under the profile header, without a way back: the column is
// the way around. Elsewhere (Discord's link page) it is a full page of its own with its title.
import type { ReactNode } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { useInSettingsFrame } from "./SettingsFrame"

export function SettingsPage({
	title,
	intro,
	children,
}: {
	title: string
	intro?: ReactNode
	children: ReactNode
}) {
	const framed = useInSettingsFrame()
	if (framed)
		return (
			<div className="pb-32" data-settings-page>
				<header className="pt-5 pb-5">
					<h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
					{intro && (
						<p className="mt-0.5 max-w-2xl text-sm text-gray-400">{intro}</p>
					)}
				</header>
				<div className="text-base text-gray-300">{children}</div>
			</div>
		)
	return (
		<div className="overflow-x-clip pb-32" data-settings-page>
			<header className="mx-auto max-w-6xl px-4 pt-6 pb-6 md:px-8 md:pt-8">
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{title}</h1>
				{intro && (
					<p className="mt-2 max-w-2xl text-base text-gray-400">{intro}</p>
				)}
			</header>
			<div className="mx-auto max-w-6xl px-4 text-base text-gray-300 md:px-8">
				{children}
			</div>
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
				<h3 className="text-lg font-bold text-white">{title}</h3>
				{hint && <p className="max-w-prose text-sm text-gray-400">{hint}</p>}
			</div>
			{children}
		</section>
	)
}
