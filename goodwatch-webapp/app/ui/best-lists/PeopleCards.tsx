// The people list: the person page's collaborator cards (portrait, name, role), each with up to four of the person's
// best-known titles as links.
import { Link } from "@remix-run/react"
import { roleLabel } from "~/domain/best-lists"
import type { ListPerson } from "~/server/best-lists.server"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"
import { Portrait } from "~/ui/person/Portrait"

// The cards a phone shows without scrolling: their portraits load at once.
const EAGER_CARDS = 6

export function PeopleCards({ people }: { people: ListPerson[] }) {
	return (
		<ul className="mx-auto mt-6 grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
			{people.map((p, i) => (
				<li
					key={p.tmdb_id}
					className="flex h-full gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 transition-[scale,opacity] duration-100 hover:border-amber-400/60 has-[a:active]:scale-[0.98] has-[a:active]:opacity-90"
				>
					<Link
						to={p.path}
						prefetch="intent"
						tabIndex={-1}
						aria-hidden
						className="shrink-0"
					>
						<Portrait
							path={p.profile_path}
							name={p.name}
							width={48}
							priority={i < EAGER_CARDS ? "eager" : "lazy"}
							className="h-16 w-12 rounded-md"
						/>
					</Link>
					<div className="min-w-0">
						<Link
							to={p.path}
							prefetch="intent"
							className="block truncate font-semibold hover:text-amber-300"
						>
							{p.name}
						</Link>
						<div className="text-xs text-amber-400">
							{roleLabel(p.department)}
						</div>
						{p.knownFor.length > 0 && (
							<p className="mt-1 text-xs text-gray-400">
								{p.knownFor.map((t, j) => (
									<span key={`${t.media_type}-${t.tmdb_id}`}>
										{j > 0 && ", "}
										<Link
											to={t.path}
											prefetch="intent"
											className="hover:text-white hover:underline"
										>
											<MediaText value={presentedText(t, "title", t.title)} />
										</Link>
									</span>
								))}
								{p.knownForCount > p.knownFor.length && (
									<span className="whitespace-nowrap text-gray-300">
										, +{p.knownForCount - p.knownFor.length} more
									</span>
								)}
							</p>
						)}
					</div>
				</li>
			))}
		</ul>
	)
}
