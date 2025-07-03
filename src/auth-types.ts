import type { getSession } from 'better-auth/api'
import type { FastifyRequest } from 'fastify'
import type { Socket as SocketIOSocket } from 'socket.io'

interface ClientToServerEvents { }
interface ServerToClientEvents { }
interface InterServerEvents { }

interface SocketData {
  session?: unknown
}

/**
 * Type representing a valid user session after authentication
 * Excludes null and undefined values from the session return type
 */
export type UserSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getSession>>>
>

export type CurrentUserSession = UserSession & {
  headers: FastifyRequest['headers']
}

export type Socket = SocketIOSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export type SocketWithUserSession = Socket & {
  session: UserSession | null
}
