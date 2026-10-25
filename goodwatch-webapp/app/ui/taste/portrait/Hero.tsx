// The Taste page's opening: the fingerprint drawing once, beside the viewer type, a few numbers, the way into For you,
// and Share, which opens the share card in place under the row (no popup).
import { ShareIcon } from "@heroicons/react/20/solid"
import { motion, useReducedMotion } from "framer-motion"
import { useState } from "react"
import { ForYouLink } from "~/ui/for-you/ForYouLink"
import { DISPLAY } from "~/ui/my-pages/bits"
import { QUIET_BUTTON, ShareButton, count } from "~/ui/profile/parts"
import { Whorl } from "~/ui/profile/taste/Whorl"
import { useTaste } from "~/ui/profile/taste/model"
import { PANEL } from "~/ui/profile/taste/parts"
import type { PrintState } from "./print-state"

const SHARE_ID = "share"

export function TasteHero({
	state,
	averageYear,
}: { state: PrintState; averageYear: number | null }) {
	const { taste, handle } = useTaste()
	const [share, setShare] = useState(false)
	const agree =
		taste.crowd.agreement >= 0.5
			? "Often"
			: taste.crowd.agreement >= 0.25
				? "Half the time"
				: "Rarely"
	return (
		<div className="flex flex-col gap-4">
			<section
				aria-label="Your viewer type"
				className={`${PANEL} grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]`}
			>
				<div className="mx-auto aspect-square w-full max-w-[22rem]">
					<Whorl
						attributes={taste.attributes}
						family={state.family}
						selected={state.key}
						onFamily={(id) => state.pickFamily(state.family === id ? null : id)}
						onAttribute={state.pickAttribute}
						className="w-full"
						label="Your fingerprint"
					/>
				</div>
				<div className="min-w-0">
					<p className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
						Your viewer type
					</p>
					<h1
						id="viewer-type"
						className={`${DISPLAY} mt-1 scroll-mt-44 text-3xl leading-[1.05] text-balance text-white sm:text-5xl`}
					>
						{taste.identity?.name ?? "Still forming"}
					</h1>
					{taste.line && (
						<p className="mt-4 max-w-2xl text-lg text-gray-100 sm:text-xl">
							{taste.line}
						</p>
					)}
					<dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
						{averageYear != null && (
							<Stat value={String(averageYear)} label="average release" />
						)}
						<Stat value={count(taste.counted)} label="titles read" />
						{taste.usual != null && (
							<Stat value={String(taste.usual)} label="usual score" />
						)}
						{taste.crowd.status === "ready" && (
							<Stat value={agree} label="agrees with everyone" />
						)}
					</dl>
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
						<ForYouLink>Recommend me</ForYouLink>
						{handle && (
							<button
								type="button"
								aria-expanded={share}
								aria-controls={SHARE_ID}
								onClick={() => setShare((open) => !open)}
								className={`${QUIET_BUTTON} cursor-pointer ${share ? "ring-white/50" : ""}`}
							>
								<ShareIcon className="size-4" aria-hidden />
								Share
							</button>
						)}
					</div>
				</div>
			</section>
			{share && handle && <SharePreview handle={handle} />}
		</div>
	)
}

function Stat({ value, label }: { value: string; label: string }) {
	return (
		<div className="flex flex-col">
			<dd className="text-2xl font-black text-white tabular-nums">{value}</dd>
			<dt className="order-first text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
				{label}
			</dt>
		</div>
	)
}

/** The taste card as others see it when the member shares it, and the button that copies the link. */
function SharePreview({ handle }: { handle: string }) {
	const still = useReducedMotion()
	return (
		<motion.div
			id={SHARE_ID}
			initial={{ opacity: 0, y: still ? 0 : -6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2 }}
			className={`${PANEL} flex scroll-mt-32 flex-wrap items-center gap-4 p-3 sm:flex-nowrap sm:p-4`}
		>
			<img
				src={`/og/u/${handle}/taste.jpg`}
				alt="Your taste card as others see it when you share"
				className="aspect-[1200/630] w-56 rounded-lg ring-1 ring-white/10 sm:w-72"
			/>
			<div className="flex min-w-0 flex-col items-start gap-2">
				<p className="text-sm font-bold text-white">Share your viewer type</p>
				<ShareButton handle={`${handle}/taste`} className={QUIET_BUTTON} />
			</div>
		</motion.div>
	)
}
