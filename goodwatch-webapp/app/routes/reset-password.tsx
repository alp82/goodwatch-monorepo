import { getAuthPosters } from "~/server/auth-posters.server"
import { authFetch } from "~/utils/auth-session"
import type { LoaderFunctionArgs, MetaFunction, ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { KeyIcon, LinkSlashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline"
import { useNavigate, useSearchParams } from "@remix-run/react"
import { type FormEvent, useState } from "react"
import { createServerClient } from "@supabase/ssr"
import { parse, serialize } from "@supabase/ssr"
import { type PageMeta, buildMeta } from "~/utils/meta"

export const loader = async () => json({ posters: await getAuthPosters() })
