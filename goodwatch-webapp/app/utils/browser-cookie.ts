// A cookie that only a browser running the site's JavaScript has. Every page sets it on load. The server asks for it
// before it builds a page from an endless set of URLs (the filtered views of a person page), because a crawler that
// pretends to be a browser sends browser headers but doesn't run scripts. It says nothing about the visitor.
export const BROWSER_COOKIE = "gw_browser"

/** Sets the cookie in the browser. */
export function setBrowserCookie(): void {
	document.cookie = `${BROWSER_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`
}
