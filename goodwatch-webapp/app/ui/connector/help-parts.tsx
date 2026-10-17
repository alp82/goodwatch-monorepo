// Small pieces the setup on /use-with-ai and the fixes on /support are built from: the names of buttons in other
// apps, code, a disclosure for the by-hand way, and the button that opens another app.
import type { ReactNode } from "react"

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
