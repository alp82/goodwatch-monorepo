import { useEffect, useState } from 'react'

export default function CookieConsent({ onAcceptCallback = () => { }, onDeclineCallback = () => { } }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hide, setHide] = useState(false);

  const accept = () => {
    document.cookie = "cookieConsent=true; expires=Fri, 31 Dec 9999 23:59:59 GMT";

    setIsOpen(false);
    setTimeout(() => {
      setHide(true);
    }, 700);
    onAcceptCallback();
  };

  const decline = () => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 14); // Set expiration date to two weeks from now
    document.cookie = `cookieConsent=false; expires=${expirationDate.toUTCString()}`;

    setIsOpen(false);
    setTimeout(() => {
      setHide(true);
    }, 700);
    onDeclineCallback();
  };

  useEffect(() => {
    if (!document.cookie.includes("cookieConsent=")) {
      setIsOpen(true)
    }
  }, [])

  return (
    <div className={`fixed z-[200] bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 w-full sm:max-w-md transition-transform duration-700 ${!isOpen ? 'transition-[opacity,transform] translate-y-8 opacity-0' : 'transition-[opacity,transform] translate-y-0 opacity-100'} ${hide && "hidden"}`}>
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
            <button onClick={decline} className="w-full p-2 bg-gray-800 hover:bg-gray-700 ring-1 ring-inset ring-gray-600 focus:z-10">Decline</button>
            <button onClick={accept} className="w-full p-2 bg-indigo-800 hover:bg-indigo-700 ring-1 ring-inset ring-gray-600 focus:z-10 font-semibold">Accept</button>
          </div>
        </div>
      </div>
    </div>
  )
}