import { createContext, useContext } from "react"

export const defaultLocale = {
	language: "en",
	country: "US",
}

interface LocaleContext {
	locale: typeof defaultLocale
}

export const LocaleContext = createContext<LocaleContext>({
	locale: defaultLocale,
})

export default function useLocale() {
	return useContext(LocaleContext)
}
