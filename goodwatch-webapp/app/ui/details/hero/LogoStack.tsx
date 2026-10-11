import { TmdbImage } from "~/ui/TmdbImage"
import type { CountryService } from "~/ui/details/hero/countryOffers"

/** Up to three logos of a country's services, and how many more there are. */
export function LogoStack({
	services,
	size = 24,
}: { services: CountryService[]; size?: number }) {
	return (
		<span
			className="flex shrink-0 items-center -space-x-1"
			title={services.map((s) => s.name).join(", ")}
		>
			{services.slice(0, 3).map((s) => (
				<TmdbImage
					key={s.id}
					kind="logo"
					path={s.logoPath}
					width={size}
					ratio={1}
					alt=""
					style={{ width: size, height: size }}
					className="rounded-md ring-2 ring-stone-900"
				/>
			))}
			{services.length > 3 && (
				<span
					style={{ height: size, minWidth: size }}
					className="z-10 flex items-center justify-center rounded-md bg-stone-700 px-1 text-[10px] font-bold text-white ring-2 ring-stone-900"
				>
					+{services.length - 3}
				</span>
			)}
		</span>
	)
}
