import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { MembresiaContext } from '../../auth/roles.guard.js';

/**
 * Inyecta la membresia del usuario en el conjunto activo.
 * Solo esta disponible en rutas protegidas con `@Roles()`.
 */
export const Membresia = createParamDecorator(
  (
    data: keyof MembresiaContext | undefined,
    ctx: ExecutionContext,
  ): MembresiaContext | MembresiaContext[keyof MembresiaContext] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { membresia?: MembresiaContext }>();
    if (!request.membresia) return undefined;
    return data ? request.membresia[data] : request.membresia;
  },
);
