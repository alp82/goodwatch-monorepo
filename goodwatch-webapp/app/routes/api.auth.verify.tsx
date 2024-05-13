import { json, LoaderFunction } from '@remix-run/node'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/auth-js'

import { getUser } from '~/utils/auth'

type LoaderData = {
  user: Awaited<User | undefined>
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const auth_token = url.searchParams.get('auth_token') || ''

  const supabase = createBrowserClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  const  { user } = await getUser(auth_token, supabase)

  return json<LoaderData>({
    user: user?.user,
  })
}

export default function AuthVerify() {}