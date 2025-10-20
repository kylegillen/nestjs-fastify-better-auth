import type { MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common'
import type { Auth } from 'better-auth'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { Global, HttpStatus, Inject, Logger, Module } from '@nestjs/common'
import { DiscoveryModule, DiscoveryService, HttpAdapterHost, MetadataScanner } from '@nestjs/core'
import { createAuthMiddleware } from 'better-auth/plugins'

import { BetterAuthProvider, InjectBetterAuth } from './better-auth.provider.ts'
import { BetterAuthService } from './better-auth.service.ts'
import { BETTER_AUTH_HOOKS } from './constants/better-auth.const.ts'
import { ConfigurableBetterAuthModule } from './constants/better-auth.module-definition.ts'
import { HOOK_KEY } from './constants/hooks.const.ts'

@Global()
@Module({
  imports: [
    DiscoveryModule,
  ],
  providers: [
    BetterAuthProvider,
    BetterAuthService,
  ],
  exports: [
    BetterAuthProvider,
    BetterAuthService,
  ],
})
export class BetterAuthModule extends ConfigurableBetterAuthModule implements NestModule, OnModuleInit {
  private readonly logger = new Logger(this.constructor.name)

  constructor(
    @InjectBetterAuth() private readonly auth: Auth,
    @Inject(DiscoveryService) private discoveryService: DiscoveryService,
    @Inject(MetadataScanner) private metadataScanner: MetadataScanner,
    @Inject(HttpAdapterHost) private readonly adapter: HttpAdapterHost,
  ) {
    super()
  }

  onModuleInit(): void {
    if (!this.auth.options.hooks) {
      return
    }

    const providers = this.discoveryService
      .getProviders()
      .filter(({ metatype }) => metatype && Reflect.getMetadata(HOOK_KEY, metatype))

    for (const provider of providers) {
      const providerPrototype = Object.getPrototypeOf(provider.instance)
      const methods = this.metadataScanner.getAllMethodNames(providerPrototype)

      for (const method of methods) {
        const providerMethod = providerPrototype[method]
        this.setupHooks(providerMethod)
      }
    }
  }

  configure(_: MiddlewareConsumer): void {
    let basePath = this.auth.options.basePath ?? '/api/auth'

    // Ensure the basePath starts with / and doesn't end with /
    if (!basePath.startsWith('/')) {
      basePath = `/${basePath}`
    }
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1)
    }

    (this.adapter.httpAdapter.getInstance() as FastifyInstance).all(
      `${basePath}/*`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const url = new URL(
            request.url,
            `${request.protocol}://${request.hostname}`,
          )

          const headers = new Headers()
          for (const [key, value] of Object.entries(request.headers)) {
            if (value) {
              headers.append(key, value.toString())
            }
          }

          const newRequest = new Request(url.toString(), {
            method: request.method,
            headers,
            body: request.body ? JSON.stringify(request.body) : undefined,
          })

          const newResponse = await this.auth.handler(newRequest)

          reply.status(newResponse.status)
          for (const [key, value] of newResponse.headers.entries()) {
            reply.header(key, value)
          }
          reply.send(
            newResponse.body
              ? await newResponse.text()
              : {
                status: newResponse.status,
                message: newResponse.statusText,
              },
          )
        }
        catch (error) {
          this.logger.fatal(`Better auth error ${String(error)}`)
          reply
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .send({
              error: 'Internal authentication error',
              code: 'AUTH_FAILURE',
            })
        }
      },
    )
    this.logger.log(`${this.constructor.name} initialized at '${basePath}/*'`)
  }

  private setupHooks(providerMethod: (context: any) => Promise<void>): void {
    if (!this.auth.options.hooks) {
      return
    }

    for (const { metadataKey, hookType } of BETTER_AUTH_HOOKS) {
      const hookPath = Reflect.getMetadata(metadataKey, providerMethod)
      if (!hookPath) {
        continue
      }

      const originalHook = this.auth.options.hooks[hookType]
      this.auth.options.hooks[hookType] = createAuthMiddleware(async (context) => {
        if (originalHook) {
          await originalHook(context)
        }

        if (hookPath === context.path) {
          await providerMethod(context)
        }
      })
    }
  }
}
