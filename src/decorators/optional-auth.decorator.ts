import type { CustomDecorator } from '@nestjs/common'

import { SetMetadata } from '@nestjs/common'

import { IS_OPTIONAL_AUTH } from '../constants/better-auth.const.ts'

export const Optional = (): CustomDecorator<typeof IS_OPTIONAL_AUTH> => SetMetadata(IS_OPTIONAL_AUTH, true)
