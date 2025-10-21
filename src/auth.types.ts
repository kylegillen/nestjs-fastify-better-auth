import type { getSession } from 'better-auth/api'
import type { FastifyRequest } from 'fastify'
import type { Socket } from 'socket.io'

/**
 * Type representing a valid user session after authentication
 * Excludes null and undefined values from the session return type
 */
export type BaseUserSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getSession>>>
>

export type UserSession = BaseUserSession & {
  user: BaseUserSession['user'] & {
    role?: string | string[]
  }
}

export type RequestWithSession = (FastifyRequest | Socket) & {
  session: UserSession | null
  user: UserSession['user'] | null
}
