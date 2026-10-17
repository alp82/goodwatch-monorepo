// PROTOTYPE - throwaway (#662). The floating bar: the variant, the member, titles to rate that show the hint for
// them, and the state (ratings, taste groups, what may be forming now, what a rating here started).
import { Link } from "@remix-run/react"
import { useState } from "react"
import { titleToDashed } from "~/utils/helpers"
import { VARIANTS, VARIANT_INFO, setProto, useFired, useHint, useProto } from "./state"

const MEMBERS = ["m1", "m2", "m3", "m4", "m5"]

export function ProtoBar() {
	const proto = useProto()
	const hint = useHint(proto)
	const { fired, seen } = useFired()
	const [open, setOpen] = useState(true)
	if (!proto) return null
	const go = (variant: string, as: string | null) => {
		setProto({ variant: variant as never, as })
		const url = new URL(window.location.href)
		url.searchParams.set("variant", variant)
		if (as) url.searchParams.set("as", as)
		window.location.href = url.toString()
	}
	return (
		<div data-proto-bar className="fixed bottom-24 left-1/2 z-[1100] w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/90 p-2 text-xs text-gray-200 shadow-2xl lg:bottom-3">
			<div className="flex flex-wrap items-center gap-1.5">
				<b className="px-1 text-violet-200">#662</b>
				{VARIANTS.map((v) => (
					<button key={v} type="button" title={VARIANT_INFO[v]} onClick={() => go(v, proto.as)} className={`cursor-pointer rounded-full px-2.5 py-1 font-semibold ${v === proto.variant ? "bg-violet-300 text-black" : "bg-white/10 hover:bg-white/20"}`}>
						{v}
					</button>
				))}
				<span className="mx-1 text-gray-500">|</span>
				{MEMBERS.map((m) => (
					<button key={m} type="button" onClick={() => go(proto.variant, m)} className={`cursor-pointer rounded-full px-2 py-1 ${m === proto.as ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"}`}>
						{m}
					</button>
				))}
				<button type="button" onClick={() => setOpen(!open)} className="ml-auto cursor-pointer px-2 text-gray-400">
					{open ? "less" : "more"}
				</button>
			</div>
			{open && (
				<div className="mt-1.5 space-y-1 px-1 text-gray-400">
					<p>{VARIANT_INFO[proto.variant]}. Scores here are never saved.</p>
					{hint && (
						<p>
							{hint.member}: {hint.ratings} ratings, {hint.groups} taste groups, {hint.now.length} set{hint.now.length === 1 ? "" : "s"} that may be forming now
							{fired ? `; this tab's rating started one${seen ? " (Taste has shown it)" : ""}` : ""}.
						</p>
					)}
					{hint?.demos.length ? (
						<p>
							Rate 8 or more to see it:{" "}
							{hint.demos.map((t, i) => (
								<span key={t.key}>
									{i > 0 && ", "}
									<Link to={`/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}?variant=${proto.variant}${proto.as ? `&as=${proto.as}` : ""}`} className="text-white underline">
										{t.title}
									</Link>
								</span>
							))}
							.
						</p>
					) : hint ? (
						<p>Nothing this member could rate would show it right now.</p>
					) : (
						<p>Loading the member…</p>
					)}
				</div>
			)}
		</div>
	)
}
