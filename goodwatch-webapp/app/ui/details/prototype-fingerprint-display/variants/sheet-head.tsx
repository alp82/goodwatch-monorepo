// PROTOTYPE - throwaway. The fingerprint heading without the big headline, plus small chip pieces.
import type React from "react"
import fingerprintIcon from "~/img/fingerprint-72.webp"
import type * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"

export function FpHeading({ t, children }: { t: F.TitleInput; children?: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
				<img src={assetUrl(fingerprintIcon)} className="h-6 w-auto shrink-0 self-start rounded-sm bg-amber-950/50 p-0.5" alt="" />
				<span>
					<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} /> fingerprint
				</span>
			</h2>
			{children}
		</div>
	)
}

const TONE = {
	good: "bg-emerald-400/15 text-emerald-100",
	context: "bg-sky-400/15 text-sky-100",
	skip: "bg-rose-400/15 text-rose-100",
	plain: "bg-white/8 text-gray-200",
} as const

export function Chip({ tone = "good", children, small = false }: { tone?: keyof typeof TONE; children: React.ReactNode; small?: boolean }) {
	return <span className={`rounded-full ${small ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"} ${TONE[tone]}`}>{children}</span>
}
