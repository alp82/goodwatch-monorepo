import React, { createContext } from 'react'
import type { LinksFunction, LoaderFunction, MetaFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration, useLoaderData, useLocation, useRouteError,
} from '@remix-run/react'
import { Analytics } from '@vercel/analytics/react'
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { AnimatePresence, motion } from 'framer-motion'
import { ToastContainer } from 'react-toastify'
import cssToastify from 'react-toastify/dist/ReactToastify.css'
import acceptLanguage from 'accept-language-parser'

import Header from '~/ui/Header'
import Footer from "~/ui/Footer";
import InfoBox from '~/ui/InfoBox'
import BottomNav from '~/ui/nav/BottomNav'
import { defaultLocale, getLocaleFromRequest, LocaleContext } from '~/utils/locale'

import cssMain from "~/main.css";
import cssTailwind from "~/tailwind.css";

// if (typeof document !== "undefined") {
//   const faro = initializeFaro({
//     url: 'https://faro-collector-prod-eu-west-2.grafana.net/collect/4adfc01553e8f9e34abb2a702a8b9103',
//     app: {
//       name: 'GoodWatch WebApp',
//       version: '1.0.0',
//       environment: 'production'
//     },
//     instrumentations: [
//       // Mandatory, overwriting the instrumentations array would cause the default instrumentations to be omitted
//       ...getWebInstrumentations(),
//
//       // Initialization of the tracing package.
//       // This packages is optional because it increases the bundle size noticeably. Only add it if you want tracing data.
//       new TracingInstrumentation(),
//     ],
//   });
// }

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "GoodWatch",
  viewport: "width=device-width,initial-scale=1",
});

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: cssTailwind },
  { rel: "stylesheet", href: cssMain },
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
  const error = useRouteError()
  console.error(error);
  return (
    <html>
    <head>
      <title>Oh no!</title>
      <Meta />
      <Links />
    </head>
    <body>
    <body className="flex flex-col h-screen bg-gray-900">
      <Analytics />
      <Header />
      <div className="flex-grow mx-auto mt-12 w-full max-w-7xl px-2 sm:px-6 lg:px-8 text-neutral-300">
        <InfoBox text="Sorry, but an error occurred" />
        <div className="mt-6 p-3 bg-red-900 overflow-x-auto flex flex-col gap-2">
          <strong>{error.message}</strong>
          <button className="m-2 p-2 w-32 text-grey-100 bg-gray-900 hover:bg-gray-800" onClick={() => window.location.reload()}>Try Again</button>
          {error.stack && <pre className="mt-2">
            {JSON.stringify(error.stack, null, 2).replace(/\\n/g, '\n')}
          </pre>}
        </div>
      </div>
      <Footer />
      <ScrollRestoration />
      <Scripts />
      <LiveReload />
    </body>
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
        <Meta />
        <Links />
      </head>
      <LocaleContext.Provider value={{locale}}>
        <body className="flex flex-col h-screen bg-gray-900">
          <Analytics />
          <Header />
          <ToastContainer />
          <div className="flex-grow mx-auto mt-2 pb-20 lg:pb-2 px-2 sm:px-6 w-full max-w-7xl lg:px-8 text-neutral-300">
            <AnimatePresence mode="wait">
              <motion.main
                key={location.pathname}
                initial={{x: '-2%', opacity: 0}}
                animate={{x: '0', opacity: 1}}
                exit={{x: '2%', opacity: 0}}
                transition={{duration: 0.2, type: 'tween'}}
              >
                <Outlet />
              </motion.main>
            </AnimatePresence>
          </div>
          <Footer />
          <BottomNav />
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </body>
      </LocaleContext.Provider>
    </html>
  );
}
