import type { BetterAuthOptions } from 'better-auth'

import { ConfigurableModuleBuilder } from '@nestjs/common'

export const {
  ConfigurableModuleClass: ConfigurableBetterAuthModule,
  MODULE_OPTIONS_TOKEN: BETTER_AUTH_OPTIONS,
} = new ConfigurableModuleBuilder<BetterAuthOptions>()
  .setClassMethodName('forRoot')
  .build()
