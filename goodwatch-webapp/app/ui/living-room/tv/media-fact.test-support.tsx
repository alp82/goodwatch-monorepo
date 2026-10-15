import { renderToStaticMarkup } from "react-dom/server"
import { MediaFact } from "./MediaFact"

const render = (text: string, name: string, lang: string, at?: number) =>
	renderToStaticMarkup(
		<MediaFact text={text} media={{ text: name, lang, at }} />,
	)

console.log(
	"__MEDIA_FACT__" +
		JSON.stringify({
			english: render("How was The Matrix?", "The Matrix", "en"),
			arabic: render("How was المصفوفة?", "المصفوفة", "ar"),
			numeric: render(
				"Next: S2E4 · 2 · 50 min",
				"2",
				"ja",
				"Next: S2E4 · ".length,
			),
			unknown: render("How was Pilot?", "Pilot", "und"),
		}),
)
