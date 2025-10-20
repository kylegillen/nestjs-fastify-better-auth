import type { CanActivate, ContextType, ExecutionContext } from '@nestjs/common'
import type { Auth } from 'better-auth'
import type { FastifyRequest } from 'fastify'

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { fromNodeHeaders } from 'better-auth/node'
import { Socket } from 'socket.io'

import type { AuthSession, SessionUser } from '../types/better-auth.type.ts'

import { InjectBetterAuth } from '../better-auth.provider.ts'
import { IS_OPTIONAL_AUTH, IS_PUBLIC_AUTH } from '../constants/better-auth.const.ts'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @InjectBetterAuth() private readonly auth: Auth,
  ) {}

  /**
   * Validates if the current request is authenticated for all REST, GraphQL & Websockets
   * Attaches session and user information to the request object
   * @param context - The execution context of the current request
   * @returns True if the request is authorized to proceed, throws an error otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_AUTH,
      [context.getHandler(), context.getClass()],
    )

    if (isAuthPublic) {
      return true
    }

    const contextType: ContextType & 'graphql' = context.getType()

    if (contextType === 'ws') {
      const socket = context.switchToWs().getClient<Socket & { session?: AuthSession }>()
      try {
        const session = await this.auth.api.getSession({
          headers: fromNodeHeaders(socket.handshake.headers),
        }) as AuthSession
        /* eslint-disable dot-notation */
        socket['session'] = session
      }
      catch {
        socket.disconnect()
        return false
      }
      return true
    }

    let request: FastifyRequest & { session?: AuthSession, user?: SessionUser }

    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context)
      request = gqlContext.getContext()?.req
    }
    else {
      request = context.switchToHttp().getRequest()
    }

    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    }) as AuthSession

    request['session'] = session
    request['user'] = session?.user ?? null // For Sentry

    const isAuthOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH,
      [context.getHandler(), context.getClass()],
    )

    if (isAuthOptional && !session) {
      return true
    }

    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
      })
    }

    return true
  }
}
