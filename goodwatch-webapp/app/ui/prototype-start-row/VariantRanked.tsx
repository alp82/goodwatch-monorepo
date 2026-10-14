// PROTOTYPE - throwaway (#541). Variant A, "Ranked": the ten titles as a chart, big outlined numbers behind the
// posters, a reason chip and one line of fact under each. Titles only; no third-party content.
import { Link } from "@remix-run/react"
import { HOT } from "./data"
import { DISPLAY, Move, Rail, RowHead, WhyChip, hrefOf, img } from "./kit"

export function VariantRanked() {
	return (
		<section aria-labelledby="talked-title" className="mb-14">
			<RowHead />
			<Rail className="mt-5" gap="gap-1 sm:gap-2">
				{HOT.map((title, i) => (
					<li
						key={title.tmdb_id}
						className={`relative shrink-0 snap-start ${i < 9 ? "w-[184px] pl-12 sm:w-[206px] sm:pl-14" : "w-[228px] pl-[5.75rem] sm:w-[258px] sm:pl-[6.75rem]"}`}
					>
						<Link to={hrefOf(title)} discover="none" className="group relative block">
							<span className="relative block">
								<span
									aria-hidden
									className="pointer-events-none absolute bottom-[-0.13em] right-[calc(100%-18px)] select-none text-[128px] font-black leading-none tracking-[-0.06em] text-[#0b0e16] sm:text-[150px]"
									style={{ ...DISPLAY, WebkitTextStroke: "2px rgba(255,255,255,0.32)" }}
								>
									{i + 1}
								</span>
								<img
									src={img(title.poster_path)}
									srcSet={`${img(title.poster_path)} 185w, ${img(title.poster_path, "w342")} 342w`}
									sizes="140px"
									alt={`${title.title} poster`}
									width={140}
									height={210}
									loading="lazy"
									className="relative aspect-[2/3] w-full rounded-lg object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition group-hover:ring-2 group-hover:ring-amber-300"
								/>
								<span className="absolute right-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 backdrop-blur-sm">
									<Move move={title.move} />
								</span>
							</span>
							<span className="mt-2.5 block">
								<WhyChip why={title.why} small />
							</span>
							<b
								className="mt-1.5 line-clamp-2 block text-[15px] leading-tight text-white group-hover:text-amber-300"
								style={DISPLAY}
							>
								{title.title}
							</b>
							<span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-neutral-400">
								{title.why.detail}
							</span>
						</Link>
					</li>
				))}
			</Rail>
		</section>
	)
}
