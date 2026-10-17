import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline"
import { useEffect, useState } from "react"

// A line of text to copy (the connector address, a command) with a Copy button. Long text wraps, so a phone shows
// all of it. Without JavaScript the text can still be selected.
export function CopyField({
	text,
	label,
	mono = true,
	size = "md",
}: {
	text: string
	// Names what is copied, for screen readers ("Copy the connector address").
	label: string
	mono?: boolean
	// "lg" for the one address the page is about.
	size?: "md" | "lg"
}) {
	const [copied, setCopied] = useState(false)
	useEffect(() => {
		if (!copied) return
		const timer = setTimeout(() => setCopied(false), 1500)
		return () => clearTimeout(timer)
	}, [copied])

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
		} catch {
			// No clipboard (an old browser, a page without permission): the text stays selectable.
		}
	}

	return (
		<div
			className={`flex items-stretch gap-2 ${size === "lg" ? "flex-col sm:flex-row" : ""}`}
		>
			<code
				className={`min-w-0 flex-1 whitespace-pre-wrap break-words rounded-lg bg-gray-950 text-gray-100 ring-1 ring-gray-700 ${size === "lg" ? "px-4 py-3.5 text-base sm:text-xl" : "px-3 py-2.5 text-sm"} ${mono ? "font-mono" : ""}`}
			>
				{text}
			</code>
			<button
				type="button"
				onClick={copy}
				aria-label={copied ? "Copied" : label}
				className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg font-semibold ${size === "lg" ? "justify-center bg-amber-700 px-4 py-3 text-base text-white hover:bg-amber-600 sm:py-0" : "bg-gray-700 px-3 text-sm text-gray-100 hover:bg-gray-600"} transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
			>
				{copied ? (
					<CheckIcon
						className={`h-4 w-4 ${size === "lg" ? "text-white" : "text-emerald-400"}`}
						aria-hidden="true"
					/>
				) : (
					<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
				)}
				<span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
			</button>
		</div>
	)
}
