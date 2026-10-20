import type { ActiveChip } from "./labels"

export default function TitlePreviewContent({ chip }: { chip: ActiveChip }) {
	return (
		<>
			<p className="mb-3 text-sm font-bold">{chip.label}</p>
			<ul className="space-y-2">
				{chip.preview?.map((title, index) => (
					<li key={index} className="flex items-center gap-3 text-sm">
						{title.poster ? (
							<img
								src={`https://image.tmdb.org/t/p/w92${title.poster}`}
								alt=""
								width={40}
								height={title.logo ? 40 : 60}
								className={
									title.logo
										? "h-10 w-10 rounded object-contain"
										: "h-15 w-10 rounded object-cover"
								}
							/>
						) : (
							<span className="h-15 w-10 rounded bg-white/10" />
						)}
						<span>{title.title}</span>
					</li>
				))}
			</ul>
		</>
	)
}
