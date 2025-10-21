import type { DynamicModule, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common'
import type { FastifyAdapter } from '@nestjs/platform-fastify'
import type { Auth } from 'better-auth'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { Inject, Logger, Module } from '@nestjs/common'
import { APP_GUARD, DiscoveryModule, DiscoveryService, HttpAdapterHost, MetadataScanner } from '@nestjs/core'
import { createAuthMiddleware } from 'better-auth/api'

import type { ASYNC_OPTIONS_TYPE, AuthModuleOptions, OPTIONS_TYPE } from './auth-module.definition.ts'

import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './auth-module.definition.ts'
import { AuthGuard } from './auth.guard.ts'
import { AuthService } from './auth.service.ts'
import { AFTER_HOOK_KEY, BEFORE_HOOK_KEY, HOOK_KEY } from './symbols.ts'

const HOOKS = [
  { metadataKey: BEFORE_HOOK_KEY, hookType: 'before' as const },
  { metadataKey: AFTER_HOOK_KEY, hookType: 'after' as const },
]

/**
 * NestJS module that integrates the Auth library with NestJS applications.
 * Provides authentication middleware, hooks, and exception handling.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule
  extends ConfigurableModuleClass
  implements NestModule, OnModuleInit {
  private readonly logger = new Logger(AuthModule.name)

  constructor(
    @Inject()
    private readonly discoveryService: DiscoveryService,
    @Inject(MetadataScanner)
    private readonly metadataScanner: MetadataScanner,
    @Inject(HttpAdapterHost)
    private readonly adapter: HttpAdapterHost,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    super()
  }

  onModuleInit(): void {
    const providers = this.discoveryService
      .getProviders()
      .filter(
        ({ metatype }) =>
          metatype && Reflect.getMetadata(HOOK_KEY, metatype),
      )

    const hasHookProviders = providers.length > 0
    const hooksConfigured = typeof this.options.auth.options.hooks === 'object'

    if (hasHookProviders && !hooksConfigured) {
      throw new Error(
        'Detected @Hook providers but Better Auth \'hooks\' are not configured. Add \'hooks: {}\' to your betterAuth(...) options.',
      )
    }

    if (!hooksConfigured) return

    for (const provider of providers) {
      const providerPrototype = Object.getPrototypeOf(provider.instance)
      const methods = this.metadataScanner.getAllMethodNames(providerPrototype)

      for (const method of methods) {
        const providerMethod = providerPrototype[method]
        this.setupHooks(
          providerMethod,
          provider.instance,
        )
      }
    }
  }

  configure(_consumer: MiddlewareConsumer): void {
    const fastifyAdapter = this.adapter.httpAdapter as FastifyAdapter
    const trustedOrigins = this.options.auth.options.trustedOrigins
    // function-based trustedOrigins requires a Request (from web-apis) object to evaluate, which is not available in NestJS (we only have a express Request object)
    // if we ever need this, take a look at better-call which show an implementation for this
    const isNotFunctionBased = trustedOrigins && Array.isArray(trustedOrigins)

    if (!this.options.disableTrustedOriginsCors && isNotFunctionBased) {
      fastifyAdapter.enableCors({
        origin: trustedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
      })
    }
    else if (
      trustedOrigins
      && !this.options.disableTrustedOriginsCors
      && !isNotFunctionBased
    ) {
      throw new Error('Function-based trustedOrigins not supported in NestJS. Use string array or disable CORS with disableTrustedOriginsCors: true.')
    }

    let basePath = this.options.auth.options.basePath ?? '/api/auth'

    // Ensure basePath starts with /
    if (!basePath.startsWith('/')) {
      basePath = `/${basePath}`
    }

    // Ensure basePath doesn't end with /
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

          const response = await this.options.auth.handler(newRequest)
          reply.status(response.status)
          for (const [key, value] of response.headers.entries()) {
            reply.header(key, value)
          }
          reply.send(
            response.body
              ? await response.text()
              : {
                  status: response.status,
                  message: response.statusText,
                },
          )
        }
        catch (error) {
          this.logger.fatal(`Better auth error ${String(error)}`)
          reply.status(500).send({
            error: 'Internal authentication error',
            code: 'AUTH_FAILURE',
          })
        }
      },
    )
  }

  private setupHooks(
    providerMethod: (...arguments_: unknown[]) => unknown,
    providerClass: { new(...arguments_: unknown[]): unknown },
  ): void {
    if (!this.options.auth.options.hooks) return

    for (const { metadataKey, hookType } of HOOKS) {
      const hasHook = Reflect.hasMetadata(metadataKey, providerMethod)
      if (!hasHook) continue

      const hookPath = Reflect.getMetadata(metadataKey, providerMethod)

      const originalHook = this.options.auth.options.hooks[hookType]
      this.options.auth.options.hooks[hookType] = createAuthMiddleware(
        async (context) => {
          if (originalHook) {
            await originalHook(context)
          }

          if (hookPath && hookPath !== context.path) return

          await providerMethod.apply(
            providerClass,
            [context],
          )
        },
      )
    }
  }

  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const forRootAsyncResult = super.forRootAsync(options)
    return {
      ...super.forRootAsync(options),
      providers: [
        ...(forRootAsyncResult.providers ?? []),
        ...(options.disableGlobalAuthGuard
          ? []
          : [
              {
                provide: APP_GUARD,
                useClass: AuthGuard,
              },
            ]),
      ],
    }
  }

  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule
  static forRoot(
    argument1: Auth | typeof OPTIONS_TYPE,
    argument2?: Omit<typeof OPTIONS_TYPE, 'auth'>,
  ): DynamicModule {
    const normalizedOptions: typeof OPTIONS_TYPE
      = typeof argument1 === 'object' && argument1 !== null && 'auth' in (argument1 as object)
        ? (argument1 as typeof OPTIONS_TYPE)
        : ({
            ...argument2,
            auth: argument1 as Auth,
          } as typeof OPTIONS_TYPE)

    const forRootResult = super.forRoot(normalizedOptions)

    return {
      ...forRootResult,
      providers: [
        ...(forRootResult.providers ?? []),
        ...(normalizedOptions.disableGlobalAuthGuard
          ? []
          : [
              {
                provide: APP_GUARD,
                useClass: AuthGuard,
              },
            ]),
      ],
    }
  }
}
