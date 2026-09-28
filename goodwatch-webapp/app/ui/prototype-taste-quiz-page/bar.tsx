// PROTOTYPE - throwaway (#220 round 4). The prototype's own switcher: page, layout variant, audience, state.
import { Link, useSearchParams } from "@remix-run/react"
import { PAGE_VARIANTS, type PageVariant, QUIZ_PATH, TASTE_PATH } from "./page"

export function ProtoBar({ page }: { page: "quiz" | "taste" }) {
	const [p] = useSearchParams()
	const as = p.get("as") ?? "guest"
	const href = (path: string, set: Record<string, string | null>) => {
		const n = new URLSearchParams(p)
		for (const [k, v] of Object.entries(set))
			v == null ? n.delete(k) : n.set(k, v)
		return `${path}?${n}`
	}
	const chip = (on: boolean) =>
		`shrink-0 rounded-full px-2.5 py-1 ${on ? "bg-white font-bold text-gray-950" : "bg-white/10 text-gray-300 hover:bg-white/20"}`
	const here = page === "quiz" ? QUIZ_PATH : TASTE_PATH
	return (
		<div className="border-b border-white/10 bg-black/80 text-xs">
			<div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-8">
				<span className="shrink-0 font-bold text-amber-400">#220 locked</span>
				<Link to={`${TASTE_PATH}?as=${as}`} className={chip(page === "taste")}>
					Taste page
				</Link>
				<Link to={`${QUIZ_PATH}?as=${as}`} className={chip(page === "quiz")}>
					Quiz page
				</Link>
				<span className="text-gray-600">|</span>
				{(["guest", "new", "me"] as const).map((a) => (
					<Link
						key={a}
						to={href(here, { as: a, from: null, state: null })}
						className={chip(a === as)}
					>
						{a === "guest"
							? "Guest"
							: a === "new"
								? "New member"
								: "Member, 42"}
					</Link>
				))}
				{page === "taste" && as === "guest" && (
					<>
						<span className="text-gray-600">|</span>
						{(["zero", "mid", "five", "joined"] as const).map((s) => (
							<Link
								key={s}
								to={href(here, { state: s })}
								className={chip((p.get("state") ?? "zero") === s)}
							>
								{s === "zero"
									? "0 rated"
									: s === "mid"
										? "3 of 5"
										: s === "five"
											? "5 rated"
											: "Just saved"}
							</Link>
						))}
					</>
				)}
				{page === "quiz" && (
					<>
						<span className="text-gray-600">|</span>
						{(Object.keys(PAGE_VARIANTS) as PageVariant[]).map((v) => (
							<Link
								key={v}
								to={href(here, { variant: v })}
								title={PAGE_VARIANTS[v].idea}
								className={chip((p.get("variant") ?? "backdrop") === v)}
							>
								{PAGE_VARIANTS[v].name}
							</Link>
						))}
					</>
				)}
			</div>
		</div>
	)
}
