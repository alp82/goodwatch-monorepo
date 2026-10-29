import { Link } from "@remix-run/react"
import { TmdbImage } from "~/ui/TmdbImage"
import { initials } from "~/ui/details/page-ui"
import { type PeopleRow, episodesWords } from "~/ui/details/people/usePeople"
import { personPath } from "~/utils/helpers"

/** One person as a dense row: round photo, name, then roles (characters or jobs) and episodes on one muted line. */
export function PersonRow({
	row,
	showEpisodes = false,
	note,
	size = 40,
	strongRoles,
}: {
	row: PeopleRow
	showEpisodes?: boolean
	/** Extra words at the end of the second line (a department in search results). */
	note?: string
	size?: 32 | 40
	/** Mark the roles of a department's leading jobs. */
	strongRoles?: boolean
}) {
	const eps = showEpisodes ? episodesWords(row.episodes) : null
	const roles = row.roles.join(", ")
	const box = size === 32 ? "h-8 w-8" : "h-10 w-10"
	return (
		<Link
			to={personPath(row.id, row.name)}
			prefetch="intent"
			data-person-id={row.id}
			className="group -mx-1.5 flex min-w-0 items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-white/[0.05] active:bg-white/[0.08]"
		>
			<span
				className={`relative flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-[11px] font-semibold text-gray-500 ring-1 ring-white/10`}
			>
				{row.profilePath ? (
					<TmdbImage
						kind="profile"
						path={row.profilePath}
						width={size + 8}
						ratio={1}
						alt=""
						className="absolute inset-0 h-full w-full object-cover"
					/>
				) : (
					initials(row.name)
				)}
			</span>
			<span className="min-w-0 flex-1 leading-tight">
				<span className="block truncate text-sm font-medium text-gray-100 group-hover:text-amber-300">
					{row.name}
				</span>
				{(roles || eps || note) && (
					<span className="mt-0.5 block truncate text-xs text-gray-500">
						{roles && (
							<span className={strongRoles && row.key ? "text-gray-300" : ""}>
								{roles}
							</span>
						)}
						{eps && (
							<span className="tabular-nums">
								{roles ? " · " : ""}
								{eps}
							</span>
						)}
						{note && (
							<span>
								{roles || eps ? " · " : ""}
								{note}
							</span>
						)}
					</span>
				)}
			</span>
		</Link>
	)
}
