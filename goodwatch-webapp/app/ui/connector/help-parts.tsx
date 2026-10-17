// Small pieces the connector help page (/connect) is built from: numbered steps, the names of buttons in other apps,
// side notes and questions.
import { CheckBadgeIcon, ClockIcon } from "@heroicons/react/24/outline"
import type { ReactNode } from "react"

export function SectionHeading({
	id,
	children,
}: { id: string; children: ReactNode }) {
	return (
		<h2
			id={id}
			className="scroll-mt-24 text-2xl font-bold tracking-tight text-white"
		>
			{children}
		</h2>
	)
}

export function Steps({ children }: { children: ReactNode }) {
	return (
		<ol className="flex flex-col gap-4 [counter-reset:step]">{children}</ol>
	)
}

export function Step({ children }: { children: ReactNode }) {
	return (
		<li className="flex gap-3 leading-relaxed [counter-increment:step] before:flex before:h-7 before:w-7 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-gray-800 before:text-sm before:font-bold before:text-amber-400 before:ring-1 before:ring-gray-700 before:content-[counter(step)]">
			<div className="min-w-0 flex-1 pt-0.5">{children}</div>
		</li>
	)
}

// A button or menu name in the other app, as it is labelled there.
export function Ui({ children }: { children: ReactNode }) {
	return (
		<span className="rounded bg-gray-800 px-1.5 py-0.5 text-[0.92em] font-semibold text-gray-100 ring-1 ring-gray-700 [overflow-wrap:anywhere]">
			{children}
		</span>
	)
}

export function Code({ children }: { children: ReactNode }) {
	return (
		<code className="rounded bg-gray-950 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-100 ring-1 ring-gray-700 [overflow-wrap:anywhere]">
			{children}
		</code>
	)
}

export function Aside({
	title,
	children,
}: { title: string; children: ReactNode }) {
	return (
		<div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4 text-sm leading-relaxed text-gray-300">
			<p className="mb-1 font-semibold text-gray-100">{title}</p>
			{children}
		</div>
	)
}

// Something the member can open when the main way didn't work: setting the app up by hand, an older menu.
export function More({
	title,
	children,
}: { title: string; children: ReactNode }) {
	return (
		<details className="group rounded-xl border border-gray-700 bg-gray-800/30 text-sm leading-relaxed text-gray-300">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold text-gray-100 hover:bg-gray-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 [&::-webkit-details-marker]:hidden">
				{title}
				<span
					aria-hidden="true"
					className="text-gray-500 transition-transform group-open:rotate-45"
				>
					+
				</span>
			</summary>
			<div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
		</details>
	)
}

export function Question({ q, children }: { q: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="font-semibold text-gray-100">{q}</h3>
			<div className="mt-1 leading-relaxed text-gray-300">{children}</div>
		</div>
	)
}

export type Status = "tested" | "should-work"

// Whether we have connected GoodWatch with the app ourselves, or only followed the app's own docs.
export function StatusTag({ status }: { status: Status }) {
	return status === "tested" ? (
		<span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/70 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-800">
			<CheckBadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
			Tested
		</span>
	) : (
		<span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-300 ring-1 ring-gray-700">
			<ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
			Should work
		</span>
	)
}

// The amber button that opens the other app (an install link) or its settings page.
export function OpenButton({
	href,
	children,
	external = false,
}: { href: string; children: ReactNode; external?: boolean }) {
	return (
		<a
			href={href}
			{...(external ? { target: "_blank", rel: "noreferrer" } : {})}
			className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
		>
			{children}
		</a>
	)
}
