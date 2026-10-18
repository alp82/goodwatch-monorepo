// PROTOTYPE - throwaway. The rescoring list: every title you have scored, in one compact list with the ten score keys
// beside each, plus search, filters and grouping. Four layouts, switchable with `?variant=strip|lanes|calibrate|table`.
// It is a subpage of the My library hub prototype (/prototype/my-library-rescore). The member is PROTOTYPE_MEMBER_ID
// from the environment; scores change in memory only, nothing is stored.
// A production build leaves the route out (PROTOTYPES in vite.config.js).
import { json } from "@remix-run/node"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { ChevronLeftIcon } from "@heroicons/react/20/solid"
import { type RescoreData, getRescoreData } from "~/server/prototype-my-library-rescore.server"
import { WRAP } from "~/ui/my-pages/bits"
import { Calibrate } from "~/ui/prototype-my-library/rescore/scores/Calibrate"
import { Lanes } from "~/ui/prototype-my-library/rescore/scores/Lanes"
import { Strip } from "~/ui/prototype-my-library/rescore/scores/Strip"
import { Table } from "~/ui/prototype-my-library/rescore/scores/Table"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

const VARIANTS = {
	strip: "A - Strip list",
	lanes: "B - Score lanes",
	calibrate: "C - Calibrate",
	table: "D - Table",
}

export async function loader() {
	return json<RescoreData | null>(await getRescoreData(), { headers: { "Cache-Control": "private, no-store" } })
}

export default function RescorePrototype() {
	const data = useLoaderData<typeof loader>() as RescoreData | null
	const [params] = useSearchParams()
	const variant = params.get("variant") ?? "strip"
	const hub = `/prototype/my-library-rescore${params.get("hub") ? `?variant=${params.get("hub")}` : ""}`
	return (
		<div className="overflow-x-clip pb-40" data-rescore={variant}>
			<div className={`${WRAP} flex flex-col gap-1 pb-4 pt-4 md:pt-8`}>
				<Link to={hub} className="flex min-h-8 items-center gap-1 self-start text-sm text-gray-400 hover:text-white">
					<ChevronLeftIcon className="h-4 w-4" aria-hidden />
					My library
				</Link>
				<h1 className="font-['Gabarito'] text-3xl font-black tracking-[-0.03em] text-white md:text-4xl">Your scores</h1>
				<p className="text-sm text-gray-400">
					{data ? `${data.titles.length.toLocaleString("en-US")} titles you have scored. ` : ""}Change any score right in the list.
				</p>
			</div>
			<div className={WRAP}>
				{!data ? (
					<p className="text-sm text-gray-400">Set PROTOTYPE_MEMBER_ID.</p>
				) : variant === "lanes" ? (
					<Lanes titles={data.titles} />
				) : variant === "calibrate" ? (
					<Calibrate titles={data.titles} />
				) : variant === "table" ? (
					<Table titles={data.titles} />
				) : (
					<Strip titles={data.titles} />
				)}
			</div>
			<PrototypeSwitcher variants={VARIANTS} position="top-[4.5rem] lg:top-auto lg:bottom-6 left-1/2 -translate-x-1/2" />
		</div>
	)
}
