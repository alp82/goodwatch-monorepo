import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { PortraitTab, PortraitViewOf } from "~/server/taste-portrait/view"
import { QUIZ_PATH } from "~/ui/taste-quiz/TasteQuizPage"
import { TasteBanner } from "./TasteBanner"
import { useTasteView } from "./useTasteView"

/** Where a person rates titles they've seen. */
const RATE_PATH = QUIZ_PATH

const EMPTY_LINES: Record<PortraitTab, string> = {
	sides: "Rate a few more titles you love to see the sides of your taste.",
	everyone:
		"Rate a few more titles you love to see where you and everyone part ways.",
	fingerprint: "Rate a few more titles you love to see your fingerprint.",
}

/**
 * One Taste tab around its view: loading, the empty state with a rating shortcut, and the Taste banner.
 */
export function TasteTabFrame<T extends PortraitTab>({
	tab,
	memberView,
	children,
}: {
	tab: T
	memberView: PortraitViewOf<T> | null
	children: (view: PortraitViewOf<T>) => ReactNode
}) {
	const { view, failed, retry } = useTasteView(tab, memberView)

	if (!view)
		return failed ? (
			<Notice
				line="Your taste didn't load."
				action={<RetryButton onClick={retry} />}
			/>
		) : (
			<Loading />
		)
	if (view.status === "unavailable")
		return (
			<Notice
				line="Your taste is still being prepared. Try again in a moment."
				action={<RetryButton onClick={retry} />}
			/>
		)

	return (
		<div className="pb-32 text-white">
			<TasteBanner member={view.subject.kind === "member"} />
			{view.status === "empty" ? (
				<Notice
					line={EMPTY_LINES[tab]}
					action={<RateLink>Rate titles</RateLink>}
				/>
			) : (
				children(view)
			)}
		</div>
	)
}

function RateLink({
	children,
	small = false,
}: { children: ReactNode; small?: boolean }) {
	return (
		<Link
			to={RATE_PATH}
			className={`inline-flex min-h-11 items-center rounded-full bg-linear-to-b from-amber-400 to-amber-600 font-black text-gray-950 hover:brightness-110 md:min-h-9 ${small ? "px-4 text-sm" : "px-5 text-base"}`}
		>
			{children}
		</Link>
	)
}

function RetryButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-9"
		>
			Try again
		</button>
	)
}

function Notice({ line, action }: { line: string; action: ReactNode }) {
	return (
		<div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-16 md:px-8">
			<p className="max-w-2xl text-lg text-gray-300">{line}</p>
			{action}
		</div>
	)
}

function Loading() {
	return (
		<div
			className="mx-auto max-w-7xl animate-pulse px-4 pt-10 md:px-8 md:pt-14"
			aria-busy="true"
			aria-label="Loading your taste"
		>
			<div className="h-10 max-w-3xl rounded-lg bg-gray-800/70 md:h-14" />
			<div className="mt-4 h-5 max-w-xl rounded bg-gray-800/50" />
			<div className="mt-8 grid gap-3 md:grid-cols-3">
				{[0, 1, 2].map((i) => (
					<div key={i} className="h-16 rounded-xl bg-gray-800/50" />
				))}
			</div>
			<div className="mt-8 h-96 rounded-2xl bg-gray-800/40" />
		</div>
	)
}
