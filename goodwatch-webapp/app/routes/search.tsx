import { JourneyResultsPage } from "~/ui/search/SearchJourney";
import { ogImageUrl } from "~/utils/meta";
// Not indexed, but shared links still get a preview card.
export const meta = () => [
	{ title: "Search movies and shows · GoodWatch" },
	{ name: "robots", content: "noindex, follow" },
	{ property: "og:title", content: "Search movies and shows · GoodWatch" },
	{ property: "og:image", content: ogImageUrl("/search") },
	{ property: "og:image:type", content: "image/png" },
	{ property: "og:image:width", content: "1200" },
	{ property: "og:image:height", content: "630" },
	{ name: "twitter:card", content: "summary_large_image" },
	{ name: "twitter:image", content: ogImageUrl("/search") },
];
export const headers = () => ({
	"Cache-Control": "private, no-store",
	"Referrer-Policy": "no-referrer",
});
export default JourneyResultsPage;
