// Display production-country codes consistently in server-rendered chips and the browser.
const names = new Intl.DisplayNames(["en"], { type: "region" })
export const productionCountryName = (code: string): string =>
	names.of(code) ?? code
