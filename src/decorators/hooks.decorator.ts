import { SetMetadata } from '@nestjs/common'

import {
  AFTER_HOOK_KEY,
  BEFORE_HOOK_KEY,
  HOOK_KEY,
} from '../constants/hooks.const.ts'

/**
 * Registers a method to be executed before a specific auth route is processed.
 * @param path - The auth route path that triggers this hook (must start with '/')
 */
export const BeforeHook = (path: `/${string}`): ClassDecorator =>
  SetMetadata(BEFORE_HOOK_KEY, path)

/**
 * Registers a method to be executed after a specific auth route is processed.
 * @param path - The auth route path that triggers this hook (must start with '/')
 */
export const AfterHook = (path: `/${string}`): ClassDecorator =>
  SetMetadata(AFTER_HOOK_KEY, path)

/**
 * Class decorator that marks a provider as containing hook methods.
 * Must be applied to classes that use BeforeHook or AfterHook decorators.
 */
export const Hook = (): ClassDecorator => SetMetadata(HOOK_KEY, true)
