import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { FastifyReply as Reply } from 'fastify'
import { Catch } from '@nestjs/common'
import { APIError } from 'better-auth/api'

@Catch(APIError)
export class APIErrorExceptionFilter implements ExceptionFilter {
  catch(exception: APIError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Reply>()
    const status = exception.statusCode
    const message = exception.body?.message

    response.status(status).send({
      statusCode: status,
      message,
    })
  }
}
