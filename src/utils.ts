import type { ContextType, ExecutionContext } from '@nestjs/common'
import type { GqlContextType } from '@nestjs/graphql'
import type { FastifyRequest } from 'fastify'
import type { Socket } from 'socket.io'

import { GqlExecutionContext } from '@nestjs/graphql'

/**
 * Extracts the request object from either HTTP or GraphQL execution context
 * @param context - The execution context
 * @returns The request object
 */
export function getRequestFromContext(context: ExecutionContext): (FastifyRequest | Socket) {
  const contextType = context.getType<ContextType | GqlContextType>()

  if (contextType === 'ws') {
    return context.switchToWs().getClient<Socket>()
  }
  if (contextType === 'graphql') {
    return GqlExecutionContext.create(context).getContext().req as FastifyRequest
  }
  return context.switchToHttp().getRequest<FastifyRequest>()
}
