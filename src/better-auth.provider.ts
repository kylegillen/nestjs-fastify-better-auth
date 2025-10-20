import type { Provider } from '@nestjs/common'
import type { BetterAuthOptions } from 'better-auth'

import { Inject } from '@nestjs/common'
import { betterAuth } from 'better-auth'

import { BETTER_AUTH_OPTIONS } from './constants/better-auth.module-definition.ts'

export const BETTER_AUTH_PROVIDER_TOKEN = Symbol('BETTER_AUTH_PROVIDER_TOKEN')

export const BetterAuthProvider: Provider = {
  provide: BETTER_AUTH_PROVIDER_TOKEN,
  inject: [BETTER_AUTH_OPTIONS],
  useFactory: async (options: BetterAuthOptions) => {
    return betterAuth(options)
  },
}

export const InjectBetterAuth = (): ParameterDecorator => Inject(BETTER_AUTH_PROVIDER_TOKEN)
export const injectBetterAuthToken = (): symbol => BETTER_AUTH_PROVIDER_TOKEN
