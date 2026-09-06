import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';

/**
 * Inyecta el conjunto en el que el usuario esta operando, con sus roles
 * efectivos y sus permisos. Solo disponible en rutas con `@RequierePermiso()`.
 */
export const ConjuntoActivo = createParamDecorator(
  (data: keyof Ctx | undefined, ctx: ExecutionContext): Ctx | Ctx[keyof Ctx] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { conjuntoActivo?: Ctx }>();
    if (!request.conjuntoActivo) return undefined;
    return data ? request.conjuntoActivo[data] : request.conjuntoActivo;
  },
);
