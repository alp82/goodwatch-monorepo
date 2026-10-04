// The Google tag. The root document holds the small inline part (the data layer and the `config` call), so the tag
// keeps the time of the page load. This loads the tag's script, after the page is interactive.
export const GOOGLE_TAG_ID = "G-5NK4EX51SM"

/** The inline part. Analytics stay off on localhost, as before. */
export const GOOGLE_TAG_INLINE_SCRIPT = `
window['ga-disable-${GOOGLE_TAG_ID}'] = ['localhost', '127.0.0.1'].includes(location.hostname);
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_TAG_ID}');
`

export function loadGoogleTag(): void {
	const src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`
	if (document.querySelector(`script[src="${src}"]`)) return
	const script = document.createElement("script")
	script.async = true
	script.src = src
	document.head.appendChild(script)
}
