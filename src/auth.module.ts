import type { DynamicModule, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { Inject, Logger, Module, RequestMethod } from '@nestjs/common'
import { APP_GUARD, DiscoveryModule, DiscoveryService, HttpAdapterHost, MetadataScanner } from '@nestjs/core'
import { createAuthMiddleware } from 'better-auth/api'

import type { ASYNC_OPTIONS_TYPE, AuthModuleOptions, OPTIONS_TYPE } from './auth-module.definition.ts'
import type { Auth } from './auth.types.ts'

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

  configure(consumer: MiddlewareConsumer): void {
    const trustedOrigins = this.options.auth.options.trustedOrigins
    const isArrayOrigins = trustedOrigins && Array.isArray(trustedOrigins)

    let basePath = this.options.auth.options.basePath ?? '/api/auth'

    // Ensure basePath starts with /
    if (!basePath.startsWith('/')) {
      basePath = `/${basePath}`
    }

    // Ensure basePath doesn't end with /
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1)
    }

    consumer.apply((request: FastifyRequest['raw'], reply: FastifyReply['raw']) => {
      const origin = request.headers.origin

      // Add CORS headers if origin is trusted
      if (origin && isArrayOrigins && trustedOrigins.includes(origin)) {
        reply.setHeader('Access-Control-Allow-Origin', origin)
        reply.setHeader('Access-Control-Allow-Credentials', 'true')
        reply.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        reply.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      }

      // Handle preflight
      if (request.method === 'OPTIONS') {
        reply.statusCode = 204
        reply.end()
        return
      }

      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) {
          headers.append(key, value.toString())
        }
      }

      let body = ''
      request.on('data', chunk => (body += chunk))

      request.on('end', async () => {
        // Create Fetch API-compatible request
        const newRequest = new Request(
          `https://${request.headers.host}${(request as any).originalUrl}`,
          {
            method: request.method,
            headers,
            body: body || undefined,
          },
        )

        // Process authentication request
        const response = await this.options.auth.handler(newRequest)

        reply.setHeaders(response.headers)
        reply.statusCode = response.status

        reply.end(response.body
          ? await response.text()
          : null)
      })
    }).forRoutes({ path: `${basePath}/*path`, method: RequestMethod.ALL })
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

    const providers = forRootAsyncResult.providers?.map((provider) => {
      if ((provider as any).provide === MODULE_OPTIONS_TOKEN) {
        const original = provider as any
        return {
          ...original,
          useFactory: async (...arguments_: any[]) => {
            const baseOptions = await original.useFactory(...arguments_)
            return {
              ...baseOptions,
              disableGlobalAuthGuard: options.disableGlobalAuthGuard ?? false,
            }
          },
        }
      }
      return provider
    })

    return {
      ...forRootAsyncResult,
      providers: [
        ...providers ?? [],
        ...(options.disableGlobalAuthGuard
          ? []
          : [{
            provide: APP_GUARD,
            useClass: AuthGuard,
          }]),
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

    const forRootResult = super.forRoot({
      ...normalizedOptions,
      disableGlobalAuthGuard: normalizedOptions.disableGlobalAuthGuard ?? false,
    })

    return {
      ...forRootResult,
      providers: [
        ...(forRootResult.providers ?? []),
        ...(normalizedOptions.disableGlobalAuthGuard
          ? []
          : [{
            provide: APP_GUARD,
            useClass: AuthGuard,
          }]),
      ],
    }
  }
}
