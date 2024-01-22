import { createContext, useContext } from 'react'
import acceptLanguage from 'accept-language-parser'

export const defaultLocale = {
  language: 'en',
  country: 'DE',
}

export const getLocaleFromRequest = (request: Request) => {
  const languages = acceptLanguage.parse(
    request.headers.get('Accept-Language') || ''
  )

  if (languages?.length < 1) return {
    locale: defaultLocale,
  }

  return {
    locale: {
      language: languages[0].code.toLowerCase() || defaultLocale.language,
      country: languages[0].region?.toUpperCase() || defaultLocale.country,
    }
  }
}

interface LocaleContext {
  locale: typeof defaultLocale
}

export const LocaleContext = createContext<LocaleContext>({
  locale: defaultLocale,
});

export default function useLocale() {
  return useContext(LocaleContext);
}