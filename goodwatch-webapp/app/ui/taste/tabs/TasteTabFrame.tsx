import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import {
	GUEST_MIN_RATINGS,
	type PortraitSubject,
	type PortraitTab,
	type PortraitViewOf,
} from "~/server/taste-portrait/view"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { useTasteView } from "./useTasteView"

/** Where a person rates titles they've seen. */
const RATE_PATH = "/taste/quiz"

const EMPTY_LINES: Record<PortraitTab, string> = {
	sides: "Rate a few more titles you love to see the sides of your taste.",
	everyone:
		"Rate a few more titles you love to see where you and everyone part ways.",
	fingerprint: "Rate a few more titles you love to see your fingerprint.",
}

/**
 * One Taste tab around its view: loading, the empty state with a rating shortcut, the sample-taste label, and the
 * sign-up prompt a guest sees.
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
			<SubjectBand subject={view.subject} />
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

/** "Sample taste" on every tab below 5 guest ratings; for a guest's own taste, the prompt to keep it. */
function SubjectBand({ subject }: { subject: PortraitSubject }) {
	if (subject.kind === "member") return null
	if (subject.kind === "guest")
		return (
			<div className="mx-auto flex max-w-7xl justify-end px-4 pt-4 md:px-8">
				<SignUpPrompt feature="taste" stage="keep" size="inline" />
			</div>
		)
	return (
		<section
			aria-label="Sample taste"
			className="border-b border-amber-500/20 bg-amber-950/30"
		>
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
				<span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
					Sample taste
				</span>
				<p className="text-sm text-amber-50/90">
					This is someone else's taste. Rate {GUEST_MIN_RATINGS} titles you've
					seen to see your own.
				</p>
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<RateLink small>Rate titles</RateLink>
					<SignUpPrompt feature="taste" stage="learn" size="inline" />
				</span>
			</div>
		</section>
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
