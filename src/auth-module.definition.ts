import { ConfigurableModuleBuilder } from '@nestjs/common'

import type { Auth } from './auth.types.ts'

export interface AuthModuleOptions<A = Auth> {
  auth: A
  disableTrustedOriginsCors?: boolean
  // disableBodyParser?: boolean
  disableGlobalAuthGuard?: boolean
}

export const MODULE_OPTIONS_TOKEN = Symbol('AUTH_MODULE_OPTIONS')

export const {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<AuthModuleOptions>({
  optionsInjectionToken: MODULE_OPTIONS_TOKEN,
})
  .setClassMethodName('forRoot')
  .setExtras({
    isGlobal: true,
    disableTrustedOriginsCors: false,
    disableBodyParser: false,
    disableGlobalAuthGuard: false,
  }, (definition, extras) => {
    return {
      ...definition,
      exports: [MODULE_OPTIONS_TOKEN],
      global: extras.isGlobal,
    }
  })
  .build()
