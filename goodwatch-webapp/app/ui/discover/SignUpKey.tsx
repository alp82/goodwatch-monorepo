// One sign-up key for visitors in place of On my services, Not seen yet and For you: what an account adds, in three
// words with their icons (a few of the country's services, the Not seen eye, the taste fingerprint). Phones show it
// as a slab segment, the desktop row as a control of the row's height.
import { EyeSlashIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { useAuthHref } from "~/utils/auth-href"

const LABEL =
	"Sign up free: see only your streaming services, skip what you've seen, and get picks for your taste"

export function SignUpKey({
	country,
	size,
}: {
	/** Whose services the logos show. */
	country: string
	size: "slab" | "row"
}) {
	const authHref = useAuthHref()
	const list = useStreamingProviders({ country, enabled: Boolean(country) })
	const services = (list.data ?? []).filter((p) => p.logo_path).slice(0, 2)
	const row = size === "row"
	const parts = (
		<span
			className={`flex items-center whitespace-nowrap font-bold ${row ? "gap-4 text-sm" : "w-full justify-around gap-1 text-[10.5px]"}`}
		>
			<span className="flex items-center gap-1">
				<ServiceStack providers={services} on size={row ? 18 : 13} max={2} />
				Apps
			</span>
			<span className="flex items-center gap-1">
				<EyeSlashIcon
					className={`shrink-0 text-blue-400 ${row ? "h-4 w-4" : "h-3.5 w-3.5"}`}
					aria-hidden
				/>
				Unseen
			</span>
			<span className="flex items-center gap-1">
				<FingerPrintIcon
					className={`shrink-0 text-amber-500 ${row ? "h-4 w-4" : "h-3.5 w-3.5"}`}
					aria-hidden
				/>
				Taste
			</span>
		</span>
	)
	const heading = (
		<span
			className={`font-black uppercase tracking-wider text-amber-300 ${row ? "text-xs" : "text-[10px]"}`}
		>
			Sign up free
		</span>
	)
	return (
		<Link
			rel="nofollow"
			to={authHref("sign-up")}
			aria-label={LABEL}
			className={`relative flex min-w-0 items-center bg-amber-500/[0.12] text-amber-100 ring-1 ring-inset ring-amber-500/40 transition-colors hover:bg-amber-500/20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${row ? "h-12 shrink-0 gap-4 rounded-2xl px-4" : "h-full flex-[2.7] flex-col justify-center gap-1 rounded-[14px] px-1.5"}`}
		>
			{heading}
			{parts}
		</Link>
	)
}
