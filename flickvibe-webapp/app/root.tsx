import React from 'react'
import type { LinksFunction, MetaFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration, useRouteError,
} from '@remix-run/react'
import { Analytics } from '@vercel/analytics/react'
import { ToastContainer } from 'react-toastify'

import Header from '~/ui/Header'
import Footer from "~/ui/Footer";
import InfoBox from '~/ui/InfoBox'

import cssMain from "~/main.css";
import cssTailwind from "~/tailwind.css";
import cssToastify from 'react-toastify/dist/ReactToastify.css';

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "GoodWatch",
  viewport: "width=device-width,initial-scale=1",
});

export const links: LinksFunction = () => [
  {
    rel: "icon",
    href: "/favicon.png",
    type: "image/png",
  },
  { rel: "stylesheet", href: cssTailwind },
  { rel: "stylesheet", href: cssMain },
  { rel: "stylesheet", href: cssToastify },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@700&display=swap" },
];


export function ErrorBoundary() {
  const error = useRouteError();
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
        <div className="mt-6 p-3 bg-red-900 overflow-hidden">
          <strong>{error.message}</strong>
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
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="flex flex-col h-screen bg-gray-900">
        <Analytics />
        <Header />
        <ToastContainer />
        <div className="flex-grow mx-auto mt-2 w-full max-w-7xl px-2 sm:px-6 lg:px-8 text-neutral-300">
          <Outlet />
        </div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
