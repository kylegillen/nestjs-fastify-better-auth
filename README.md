# NestJS Fastify Better Auth Integration

A comprehensive NestJS with Fastify integration library for [Better Auth](https://www.better-auth.com/), providing seamless authentication and authorization for your NestJS applications.

```bash
# Using npm
npm install @kylegillen/nestjs-fastify-better-auth

# Using yarn
yarn add @kylegillen/nestjs-fastify-better-auth

# Using pnpm
pnpm add @kylegillen/nestjs-fastify-better-auth

# Using bun
bun add @kylegillen/nestjs-fastify-better-auth
```

## Prerequisites

Before you start, make sure you have:
- A working NestJS application
- Better Auth installed and configured ([installation guide](https://www.better-auth.com/docs/installation))

## Usage

Import the `AuthModule` in your root module:

```ts title="app.module.ts"
import { Module } from '@nestjs/common'
import { AuthModule } from '@kylegillen/nestjs-fastify-better-auth'
import { auth } from './auth'

@Module({
  imports: [
    AuthModule.forRoot({
      auth: auth
    }),
  ],
})
export class AppModule {}
```
Below is a valid configuration for asynchronous registration of the module.

```ts title="app.module.ts"
import { Module } from '@nestjs/common'
import { AuthModule } from '@kylegillen/nestjs-fastify-better-auth'
import { auth } from './auth'

@Module({
  imports: [
    AuthModule.forRootAsync({
      useFactory: () => {
        return auth
      }
      imports: [],
      inject: []
    }),
  ],
})
export class AppModule {}
```

## Route Protection

Better Auth provides an `AuthGuard` to protect your routes. You can choose one of two approaches to implement route protection:

**Option 1: Controller or Route Level Protection**

Apply the guard to specific controllers or routes:

```ts title="app.controller.ts"
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, Optional, Public } from '@thallesp/nestjs-better-auth';

@Controller('users')
@UseGuards(AuthGuard) // Apply to all routes in this controller
export class UserController {
  @Get('me')
  async getProfile() {
    return { message: "Protected route" };
  }

  @Optional()
  @Get('optional')
  async getOptional() {
    return { message: "Optional route" };
  }

  @Public()
  @Get('public')
  async getPublic() {
    return { message: "Public route" };
  }
}
```

**Option 2: Global Protection**

Alternatively, you can register the guard globally using `APP_GUARD` to protect all routes by default:

```ts title="app.module.ts"
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule, AuthGuard } from '@thallesp/nestjs-better-auth';
import { auth } from "./auth";

@Module({
  imports: [
    AuthModule.forRoot(auth),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

> [!NOTE]  
> Choose either the controller/route level approach or the global approach based on your needs. You don't need to implement both.

## Decorators

Better Auth provides several decorators to enhance your authentication setup:

### Session Decorator

Access the user session in your controllers:

```ts title="user.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('users')
export class UserController {
  @Get('me')
  async getProfile(@Session() session: UserSession) {
    return session;
  }
}
```

### Public and Optional Decorators

Control authentication requirements for specific routes:

```ts title="app.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { Public, Optional } from '@thallesp/nestjs-better-auth';

@Controller('users')
export class UserController {
  @Get('public')
  @Public() // Mark this route as public (no authentication required)
  async publicRoute() {
    return { message: "This route is public" };
  }

  @Get('optional')
  @Optional() // Authentication is optional for this route
  async optionalRoute(@Session() session: UserSession) {
    return { authenticated: !!session, session };
  }
}
```

Alternatively, use it as a class decorator to specify access for an entire controller:
```ts title="app.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { Public, Optional } from '@thallesp/nestjs-better-auth';

@Public() // All routes inside this controller are public
@Controller('public')
export class PublicController { /* */ }

@Optional() // Authentication is optional for all routes inside this controller
@Controller('optional')
export class OptionalController { /* */ }
```