import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { FastifyReply as Reply } from 'fastify'

import { Catch } from '@nestjs/common'
import { APIError } from 'better-auth/api'

@Catch(APIError)
export class BetterAuthExceptionFilter implements ExceptionFilter {
  catch(exception: APIError, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const response = context.getResponse<Reply>()
    const status = exception.statusCode
    const message = exception.body?.message

    response.status(status).send({
      statusCode: status,
      message,
    })
  }
}
