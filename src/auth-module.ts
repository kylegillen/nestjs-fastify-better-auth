import type { DynamicModule, MiddlewareConsumer, NestModule, OnModuleInit, Provider } from '@nestjs/common'
import type { Auth } from 'better-auth'
import type { FastifyInstance, FastifyReply as Reply, FastifyRequest as Request } from 'fastify'

import type { AuthAsyncOptions, AuthModuleOptions } from './auth-types.ts'
import { Inject, Logger, Module } from '@nestjs/common'
import { APP_FILTER, DiscoveryModule, DiscoveryService, HttpAdapterHost, MetadataScanner } from '@nestjs/core'
import { createAuthMiddleware } from 'better-auth/api'
import { APIErrorExceptionFilter } from './api-error-exception-filter.ts'
import { AuthService } from './auth-service.ts'
import { AFTER_HOOK_KEY, AUTH_INSTANCE_KEY, AUTH_MODULE_OPTIONS_KEY, BEFORE_HOOK_KEY, HOOK_KEY } from './symbols.ts'

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
})
export class AuthModule implements NestModule, OnModuleInit {
  private logger = new Logger(AuthModule.name)
  constructor(
    @Inject(AUTH_INSTANCE_KEY) private readonly auth: Auth,
    @Inject(DiscoveryService)
    private discoveryService: DiscoveryService,
    @Inject(MetadataScanner)
    private metadataScanner: MetadataScanner,
    @Inject(HttpAdapterHost)
    private readonly adapter: HttpAdapterHost,
  ) { }

  onModuleInit(): void {
    // Setup hooks
    if (!this.auth.options.hooks) return

    const providers = this.discoveryService
      .getProviders()
      .filter(
        ({ metatype }) => metatype && Reflect.getMetadata(HOOK_KEY, metatype),
      )

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
      async (request: Request, reply: Reply) => {
        try {
          const url = new URL(
            request.url,
            `${request.protocol}://${request.hostname}`,
          )

          const headers = new Headers()
          Object.entries(request.headers).forEach(([key, value]) => {
            if (value) headers.append(key, value.toString())
          })

          const req = new Request(url.toString(), {
            method: request.method,
            headers,
            body: request.body ? JSON.stringify(request.body) : undefined,
          })

          const response = await this.auth.handler(req)

          reply.status(response.status)
          response.headers.forEach((value, key) => reply.header(key, value))
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
    this.logger.log(`AuthModule initialized at '${basePath}/*'`)
  }

  private setupHooks(providerMethod: (ctx: any) => Promise<void>) {
    if (!this.auth.options.hooks) return

    for (const { metadataKey, hookType } of HOOKS) {
      const hookPath = Reflect.getMetadata(metadataKey, providerMethod)
      if (!hookPath) continue

      const originalHook = this.auth.options.hooks[hookType]
      this.auth.options.hooks[hookType] = createAuthMiddleware(async (ctx) => {
        if (originalHook) {
          await originalHook(ctx)
        }

        if (hookPath === ctx.path) {
          await providerMethod(ctx)
        }
      })
    }
  }

  static forRoot(opts: AuthModuleOptions): DynamicModule {
    // Initialize hooks with an empty object if undefined
    // Without this initialization, the setupHook method won't be able to properly override hooks
    // It won't throw an error, but any hook functions we try to add won't be called
    const auth = opts.auth as unknown as Auth
    const options = opts.options ?? {}

    auth.options.hooks = {
      ...auth.options.hooks,
    }

    const providers: Provider[] = [
      {
        provide: AUTH_INSTANCE_KEY,
        useValue: auth,
      },
      {
        provide: AUTH_MODULE_OPTIONS_KEY,
        useValue: options,
      },
      AuthService,
    ]

    if (!options?.disableExceptionFilter) {
      providers.push({
        provide: APP_FILTER,
        useClass: APIErrorExceptionFilter,
      })
    }

    return {
      global: true,
      module: AuthModule,
      providers,
      exports: [
        {
          provide: AUTH_INSTANCE_KEY,
          useValue: auth,
        },
        {
          provide: AUTH_MODULE_OPTIONS_KEY,
          useValue: options,
        },
        AuthService,
      ],
    }
  }

  static forRootAsync(opts: AuthAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: AUTH_INSTANCE_KEY,
        useFactory: async (...args: any[]) => {
          const betterAuthConfig = await opts.useFactory(...args)
          return betterAuthConfig
        },
        inject: opts.inject
          ? [...opts.inject, AuthService]
          : [AuthService],
      },
      {
        provide: AUTH_MODULE_OPTIONS_KEY,
        useValue: opts.options,
      },
      AuthService,
    ]

    if (!opts.options?.disableExceptionFilter) {
      providers.push({
        provide: APP_FILTER,
        useClass: APIErrorExceptionFilter,
      })
    }

    return {
      global: true,
      module: AuthModule,
      imports: opts.imports || [],
      providers,
      exports: [
        AUTH_INSTANCE_KEY,
        {
          provide: AUTH_MODULE_OPTIONS_KEY,
          useValue: opts.options,
        },
        AuthService,
      ],
    }
  }
}
