import type { ModuleMetadata } from '@nestjs/common'
import type { betterAuth } from 'better-auth'
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

interface AuthOptions {
  disableExceptionFilter?: boolean
  // disableTrustedOriginsCors?: boolean
  // disableBodyParser?: boolean
}

export interface AuthModuleOptions {
  auth: typeof betterAuth
  options?: AuthOptions
}

export interface AuthAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<typeof betterAuth> | typeof betterAuth
  inject?: any[]
  options?: AuthOptions
}
