import type { getSession } from 'better-auth/api'

export type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getSession>>>
>

export type SessionUser = AuthSession['user']
export type SessionDetails = AuthSession['session']
