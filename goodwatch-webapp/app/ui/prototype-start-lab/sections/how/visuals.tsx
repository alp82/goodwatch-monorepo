// PROTOTYPE (start page lab): three of HowGoodWatchWorks.tsx's tile pictures (score, search, pick), copied here so the how variants can reuse them.
import "~/ui/living-room/how-goodwatch-works.css"
import imdbLogo from "~/img/imdb-logo-78.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-78.webp?no-inline"
import rottenLogo from "~/img/rotten-logo-78.webp?no-inline"
import { assetUrl } from "~/utils/asset-url"

const poster = (path: string) => `https://image.tmdb.org/t/p/w185${path}`

const Img = ({ src, alt, w, h, className }: { src: string; alt: string; w: number; h: number; className?: string }) => (
	<img src={assetUrl(src)} alt={alt} width={w} height={h} loading="lazy" decoding="async" className={className} />
)

export const ScoreVisual = () => (
	<div className="hgw-v-score">
		<div className="hgw-v-sources">
			<Img src={imdbLogo} alt="IMDb" w={56} h={28} />
			<Img src={rottenLogo} alt="Rotten Tomatoes" w={28} h={28} />
			<Img src={metacriticLogo} alt="Metacritic" w={28} h={28} />
		</div>
		<span className="hgw-v-arrow" aria-hidden="true">
			→
		</span>
		<span className="hgw-v-ring" aria-label="GoodWatch score 89">
			<b>89</b>
		</span>
	</div>
)

export const SearchVisual = () => (
	<div className="hgw-v-search" aria-hidden="true">
		<div className="hgw-v-field">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
				<path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			</svg>
			<span>a cozy mystery for a rainy Sunday</span>
			<i />
		</div>
		<div className="hgw-v-read">
			<span className="hgw-v-chip hgw-c-blue">Cozy</span>
			<span className="hgw-v-chip hgw-c-red">Mystery</span>
			<span className="hgw-v-chip hgw-c-blue">Rainy day</span>
		</div>
	</div>
)

export const PickVisual = () => (
	<div className="hgw-v-pick">
		{[
			["/seN6rRfN0I6n8iDXjlSMk1QjNcq.jpg", "Black Mirror"],
			["/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", "Severance"],
			["/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", "Inception"],
		].map(([path, title], i) => (
			<Img
				key={title}
				src={poster(path)}
				alt={i === 1 ? `${title} poster` : ""}
				w={92}
				h={138}
				className={`hgw-v-poster ${i === 1 ? "hgw-v-chosen" : ""}`}
			/>
		))}
		<span className="hgw-v-match">90% your taste</span>
	</div>
)

/** The three essentials, in the order the variants show them. */
export const ESSENTIALS = [
	{
		id: "score",
		title: "One score from all the big sites",
		line: "IMDb, Rotten Tomatoes, Metacritic and TMDB in one score for every movie and show.",
		short: "One score from IMDb, Rotten Tomatoes and more",
		Visual: ScoreVisual,
	},
	{
		id: "search",
		title: "Search by mood or anything",
		line: "Type what you're in the mood for and get the titles that fit.",
		short: "Search by mood or anything",
		Visual: SearchVisual,
	},
	{
		id: "picks",
		title: "Picks for your taste",
		line: "Rate a few titles you loved, and GoodWatch picks what you'll love next.",
		short: "Picks for your taste",
		Visual: PickVisual,
	},
] as const
