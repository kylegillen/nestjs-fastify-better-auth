import type { Auth } from 'better-auth'

import { InjectBetterAuth } from './better-auth.provider.ts'

/**
 * NestJS service that provides access to the Better Auth instance
 * Use generics to support auth instances extended by plugins
 */
export class BetterAuthService<T extends { api: T['api'] } = Auth> {
  constructor(
    @InjectBetterAuth()
    private readonly auth: T,
  ) {}

  /**
   * Returns the API endpoints provided by the auth instance
   */
  public get api(): T['api'] {
    return this.auth.api
  }

  /**
   * Returns the complete auth instance
   * Access this for plugin-specific functionality
   */
  public get instance(): T {
    return this.auth
  }
}
