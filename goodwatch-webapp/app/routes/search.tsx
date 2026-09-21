import { JourneyResultsPage } from "~/ui/search/SearchJourney";
export const meta = () => [
	{ title: "Search movies and shows · GoodWatch" },
	{ name: "robots", content: "noindex, follow" },
];
export const headers = () => ({
	"Cache-Control": "private, no-store",
	"Referrer-Policy": "no-referrer",
});
export default JourneyResultsPage;
