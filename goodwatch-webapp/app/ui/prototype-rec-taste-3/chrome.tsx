// PROTOTYPE - throwaway. Prototype controls, styled like the variant switcher so they don't read as design:
// the shell picker (?shell=) and a switch between your real data (read-only) and the demo member (?as=).
import { Link, useSearchParams } from "@remix-run/react"
import type { Report } from "./model"
import { SHELLS } from "./page"

export function ProtoBar({ who }: { who: Report["who"] }) {
	const [params, setParams] = useSearchParams()
	const shell = SHELLS[params.get("shell") ?? ""]
		? (params.get("shell") as string)
		: "tabs"
	const other = new URLSearchParams(params)
	other.set("as", who.mode === "me" ? "demo" : "me")
	if (process.env.NODE_ENV === "production") return null
	const pick = (key: string) => {
		const p = new URLSearchParams(params)
		p.set("shell", key)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	return (
		<div className="fixed bottom-[8.4rem] left-1/2 z-50 flex -translate-x-1/2 scale-90 items-center gap-1 whitespace-nowrap rounded-full bg-white py-1 pl-3 pr-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:bottom-3 lg:left-3 lg:translate-x-0 lg:origin-bottom-left">
			<span className="mr-1 text-neutral-500" title="Shell: how the subnav works">
				Shell
			</span>
			{Object.entries(SHELLS).map(([key, s]) => (
				<button
					key={key}
					type="button"
					onClick={() => pick(key)}
					aria-pressed={key === shell}
					title={`${s.name} (${s.style})`}
					className={`rounded-full px-2.5 py-1 ${key === shell ? "bg-black text-white" : "hover:bg-neutral-200"}`}
				>
					{s.name}
				</button>
			))}
			<span className="ml-0.5 font-normal text-neutral-500">
				{SHELLS[shell].style}
			</span>
			<span className="mx-1 h-4 w-px bg-neutral-300" />
			<Link
				to={`?${other}`}
				className="rounded-full px-2.5 py-1 hover:bg-neutral-200"
				title={
					who.mode === "me"
						? `Your real data, read-only: ${who.rated} ratings. Switch to the demo member.`
						: "Demo member. Switch to your own data."
				}
			>
				{who.mode === "me" ? `You, ${who.rated}` : who.fellBack ? "Demo (signed out)" : "Demo"}
				<span className="ml-1 text-fuchsia-600">⇄</span>
			</Link>
		</div>
	)
}
