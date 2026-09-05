import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/jwt.strategy.js';

/** Inyecta el usuario autenticado (`request.user`). */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
