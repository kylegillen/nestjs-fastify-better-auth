import type { ContextType, ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { createParamDecorator } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'

import type { AuthSession } from '../types/better-auth.type.ts'

type CurrentUserSession = AuthSession & { headers: FastifyRequest['headers'] }
  | AuthSession['user'] | AuthSession['session']
  | { headers: FastifyRequest['headers'] }

/* eslint-disable ts/no-redeclare */
export const CurrentUserSession = createParamDecorator((
  data: keyof AuthSession | 'headers',
  context: ExecutionContext,
): CurrentUserSession => {
  const contextType: ContextType & 'graphql' = context.getType()

  let request: FastifyRequest & { session: AuthSession }

  if (contextType === 'graphql') {
    const gqlContext = GqlExecutionContext.create(context)
    request = gqlContext.getContext()?.req
  }
  else {
    request = context.switchToHttp().getRequest()
  }

  switch (data) {
    case null:
    case undefined: {
      return {
        ...request?.session,
        headers: request?.headers,
      }
    }
    case 'session':
    case 'user': {
      return request.session?.[data]
    }
    case 'headers': {
      return {
        headers: request.headers,
      }
    }
  }
})
