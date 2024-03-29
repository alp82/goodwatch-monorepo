import React from 'react'
import type { LinksFunction, LoaderFunction } from '@remix-run/node'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useRouteError,
} from '@remix-run/react'
import { Analytics } from '@vercel/analytics/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastContainer } from 'react-toastify'

import Header from '~/ui/Header'
import Footer from '~/ui/Footer'
import InfoBox from '~/ui/InfoBox'
import BottomNav from '~/ui/nav/BottomNav'
import { getLocaleFromRequest, LocaleContext } from '~/utils/locale'

import cssMain from '~/main.css?url'
import cssTailwind from '~/tailwind.css?url'
import cssToastify from 'react-toastify/dist/ReactToastify.css?url'
import cssRemixDevTools from 'remix-development-tools/index.css?url'

export const links: LinksFunction = () => [
  ...(process.env.NODE_ENV === "development" ? [{ rel: "stylesheet", href: cssRemixDevTools }] : []),
  { rel: "stylesheet", href: cssMain },
  { rel: "stylesheet", href: cssTailwind },
  { rel: "stylesheet", href: cssToastify },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@700&display=swap" },
];

type LoaderData = {
  locale: {
    language: string
    country: string
  }
}

export const loader: LoaderFunction = ({ request }) => {
  const { locale } = getLocaleFromRequest(request)

  return {
    locale,
  }
}

export function ErrorBoundary() {
  // TODO migrate: https://remix.run/docs/en/main/start/v2#catchboundary-and-errorboundary
  const error = useRouteError()
  console.error(error);
  return (
    <html>
    <head>
      <title>Oh no!</title>
      <meta charSet="utf-8"/>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
      />
      <Meta/>
      <Links/>
    </head>
    <body className="flex flex-col h-screen bg-gray-900">
    <Header/>
    <main className="relative flex-grow mx-auto mt-12 w-full max-w-7xl px-2 sm:px-6 lg:px-8 text-neutral-300">
        <InfoBox text="Sorry, but an error occurred" />
        <div className="mt-6 p-3 bg-red-900 overflow-x-auto flex flex-col gap-2">
          <strong>{error.message}</strong>
          <button className="m-2 p-2 w-32 text-grey-100 bg-gray-900 hover:bg-gray-800" onClick={() => window.location.reload()}>Try Again</button>
          {error.stack && <pre className="mt-2">
            {JSON.stringify(error.stack, null, 2).replace(/\\n/g, '\n')}
          </pre>}
        </div>
      </main>
      <Footer />
      <ToastContainer />
      <BottomNav />
      <ScrollRestoration />
      <Scripts />
      <Analytics />
    </body>
    </html>
  );
}


export default function App() {
  const location = useLocation()
  const { locale } = useLoaderData<LoaderData>()
  return (
    <html lang="en" className="scroll-smooth">
    <head>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
      />
      <Meta/>
      <Links/>
    </head>
    <LocaleContext.Provider value={{locale}}>
      <body className="flex flex-col h-screen bg-gray-900">
          <Header />
          <main className="relative flex-grow mx-auto mt-16 pb-20 lg:pb-2 w-full text-neutral-300">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{x: '-2%', opacity: 0}}
                animate={{x: '0', opacity: 1}}
                exit={{x: '2%', opacity: 0}}
                transition={{duration: 0.2, type: 'tween'}}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          <Footer />
          <ToastContainer />
          <BottomNav />
          <ScrollRestoration />
          <Scripts />
          <Analytics />
        </body>
      </LocaleContext.Provider>
    </html>
  );
}
