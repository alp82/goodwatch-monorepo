import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

type CookieConsent = 'undecided' | 'yes' | 'no'

export function cookieConsentGiven(): CookieConsent {
  if (!localStorage.getItem('cookie_consent')) {
    return 'undecided';
  }
  return localStorage.getItem('cookie_consent') as CookieConsent;
}


export default function CookieConsent() {
  const [consentGiven, setConsentGiven] = useState<CookieConsent | ''>('');

  useEffect(() => {
    // We want this to only run once the client loads
    // or else it causes a hydration error
    setConsentGiven(cookieConsentGiven());
  }, []);

  useEffect(() => {
    if (consentGiven !== '') {
      posthog.set_config({ persistence: consentGiven === 'yes' ? 'localStorage+cookie' : 'memory' });
    }
  }, [consentGiven]);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookie_consent', 'yes');
    setConsentGiven('yes');
  };

  const handleDeclineCookies = () => {
    localStorage.setItem('cookie_consent', 'no');
    setConsentGiven('no');
  };

  return (
    <>
      {consentGiven === 'undecided' ? (
        <div className="fixed z-[200] bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 w-full sm:max-w-md transition-transform duration-70">
          <div className="text-gray-200 bg-slate-800 rounded-md m-2">
            <div className="grid gap-2">
              <div className="border-b border-slate-600 h-14 flex items-center justify-between p-4">
                <h1 className="text-lg font-medium">We use cookies</h1>
                🍪
              </div>
              <div className="p-4">
                <p className="text-sm font-normal">
                  We use cookies to ensure you get the best experience on our website. For more information on how we use cookies, please see our cookie policy.
                  <br />
                  <br />
                  <span className="text-xs">By clicking "<span className="font-medium opacity-80">Accept</span>", you agree to our use of cookies.</span>
                  <br />
                  <a href="/privacy" className="text-xs underline">Learn more.</a>
                </p>
              </div>
              <div className="flex gap-2 p-4 py-5 border-t border-slate-600 bg-background/20">
                <button onClick={handleAcceptCookies} className="w-full p-2 bg-indigo-800 hover:bg-indigo-700 ring-1 ring-inset ring-gray-600 focus:z-10 font-semibold">Accept</button>
                <button onClick={handleDeclineCookies} className="w-full p-2 bg-gray-800 hover:bg-gray-700 ring-1 ring-inset ring-gray-600 focus:z-10">Decline</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}