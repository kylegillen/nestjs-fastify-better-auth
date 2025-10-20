import { AFTER_HOOK_KEY, BEFORE_HOOK_KEY } from './hooks.const.ts'

export const IS_PUBLIC_AUTH = Symbol('IS_PUBLIC_AUTH')
export const IS_OPTIONAL_AUTH = Symbol('IS_OPTIONAL_AUTH')

export const BETTER_AUTH_HOOKS = [
  { metadataKey: BEFORE_HOOK_KEY, hookType: 'before' as const },
  { metadataKey: AFTER_HOOK_KEY, hookType: 'after' as const },
]
