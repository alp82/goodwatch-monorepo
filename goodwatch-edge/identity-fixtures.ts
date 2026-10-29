// Ported from app/server/cache-identity.test.ts; used against both entry points.
export const languageFixtures = [
	['', 'US', 'en'], ['en', 'US', 'en'],
	['de-DE,de;q=0.9,en;q=0.8', 'DE', 'de'],
	['en,de-AT;q=0.8', 'AT', 'en'],
	['de-DE;q=0.3,fr-CA;q=0.9,en-US;q=0.5', 'CA', 'fr'],
	['zh-Hant-TW,en;q=0.8', 'TW', 'zh-Hant'],
	['fil-PH', 'PH', 'en'], ['1234 !@#', 'US', 'en'],
	['garbage', 'US', 'en'], ['*', 'US', 'en'],
] as const
export const authFixtures = [
	'sb-testref-auth-token=forged', 'sb-testref-auth-token=',
	'gw.session_token=x', 'a=b;\t__Secure-gw.session_token=x',
	'a=b; sb-testref-auth-token.0=x', 'sb-testref-auth-token.1=x; a=b',
] as const
