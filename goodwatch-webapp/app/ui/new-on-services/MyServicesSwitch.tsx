// The "My services" switch on the New pages: Discover's Ready to watch switch cut down to the knob, the service logos
// and the label. On: the member's own page (/new, only their services). Off: the country's page with every service.
import { Link } from "@remix-run/react"
import { countryPath } from "~/domain/new-on-services"
import type { NewPageData } from "~/server/new-on-services-page.server"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { Knob } from "~/ui/filter-bar/motion"
import { useMyServices } from "~/ui/filter-bar/useFilterData"

export function MyServicesSwitch({ data }: { data: NewPageData }) {
	const { providers } = useMyServices()
	if (!data.member?.hasServices) return null
	const on = data.kind === "member"
	return (
		<Link
			to={on ? countryPath(data.country.code) : "/new"}
			role="switch"
			aria-checked={on}
			aria-label="My services"
			preventScrollReset
			className={`relative flex h-10 shrink-0 items-center gap-2 rounded-xl pr-3.5 pl-3 text-sm font-bold whitespace-nowrap transition-colors ${on ? "bg-linear-to-b from-emerald-600 to-emerald-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]" : "bg-gray-950/60 text-gray-200 ring-1 ring-white/15 hover:ring-white/40"}`}
		>
			<Knob on={on} onClass="bg-emerald-400/70" />
			{/* Room for three logos, so the label doesn't move once they load. */}
			<span className="flex w-[38px] justify-center">
				<ServiceStack providers={providers} on={on} size={18} />
			</span>
			My services
		</Link>
	)
}
