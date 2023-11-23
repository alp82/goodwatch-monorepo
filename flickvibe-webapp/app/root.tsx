import React from 'react'
import type { LinksFunction, MetaFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { Analytics } from '@vercel/analytics/react'

import cssMain from "~/main.css";
import cssTailwind from "~/tailwind.css";
import Header from '~/ui/Header'
import Footer from "~/ui/Footer";

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
];


export default function App() {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <Meta />
        <Links />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Gabarito:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body className="flex flex-col h-screen bg-gray-900">
        <Analytics />
        <Header />
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
