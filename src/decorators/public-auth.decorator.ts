import type { CustomDecorator } from '@nestjs/common'

import { SetMetadata } from '@nestjs/common'

import { IS_PUBLIC_AUTH } from '../constants/better-auth.const.ts'

export const Public = (): CustomDecorator<typeof IS_PUBLIC_AUTH> => SetMetadata(IS_PUBLIC_AUTH, true)
