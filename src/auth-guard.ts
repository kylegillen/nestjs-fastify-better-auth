import type { CanActivate, ContextType, ExecutionContext } from '@nestjs/common'
import type { Auth } from 'better-auth'
import type { FastifyRequest } from 'fastify'
import type { SocketWithUserSession, UserSession } from './auth-types.ts'

import { Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { APIError } from 'better-auth/api'
import { fromNodeHeaders } from 'better-auth/node'
import { AUTH_INSTANCE_KEY } from './symbols.ts'

/**
 * NestJS guard that handles authentication for protected routes
 * Can be configured with @Public() or @Optional() decorators to modify authentication behavior
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AUTH_INSTANCE_KEY)
    private readonly auth: Auth,
  ) { }

  /**
   * Validates if the current request is authenticated
   * Attaches session and user information to the request object
   * @param context - The execution context of the current request
   * @returns True if the request is authorized to proceed, throws an error otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    /**
     * Public
     */

    const isPublic = this.reflector.getAllAndOverride<boolean>('PUBLIC', [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) return true

    /**
     * Protected
     */

    const contextType: ContextType & 'graphql' = context.getType()

    /**
     * Attach session to WebSocket request
     */
    if (contextType === 'ws') {
      const socket = context.switchToWs().getClient<SocketWithUserSession>()
      try {
        const session = await this.auth.api.getSession({
          headers: fromNodeHeaders(socket?.handshake?.headers),
        })
        socket.session = session
      }
      catch {
        socket.disconnect()
        return false
      }
      return true
    }

    let request: FastifyRequest & UserSession

    if (contextType === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context)
      request = gqlCtx.getContext()?.req
    }
    else {
      request = context.switchToHttp().getRequest()
    }

    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request?.headers),
    })

    request.session = session as unknown as UserSession['session']
    request.user = (session?.user as unknown as UserSession['user']) ?? null // useful for observability tools like Sentry

    /**
     * Optional
     */

    const isOptional = this.reflector.getAllAndOverride<boolean>('OPTIONAL', [
      context.getHandler(),
      context.getClass(),
    ])

    if (isOptional && !session) return true

    if (!session)
      throw new APIError(401, {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      })

    return true
  }
}
