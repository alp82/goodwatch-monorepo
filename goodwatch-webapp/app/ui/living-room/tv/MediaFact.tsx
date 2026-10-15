import MediaText from "~/ui/media-text/MediaText"

/** Keep English facts/interface copy around an overlaid media name in its actual language. */
export function MediaFact({
	text,
	media,
}: { text: string; media?: { text: string; lang: string; at?: number } }) {
	const at = media?.text ? (media.at ?? text.indexOf(media.text)) : -1
	// Canonical English already inherits the document language; preserve its existing markup.
	if (!media || media.lang === "en" || at < 0) return <>{text}</>
	return (
		<>
			{text.slice(0, at)}
			<MediaText value={media} />
			{text.slice(at + media.text.length)}
		</>
	)
}
