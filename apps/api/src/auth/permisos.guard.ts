import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISOS_KEY } from '../common/decorators/requiere-permiso.decorator.js';
import type { CodigoPermiso } from '../common/permisos.js';
import { AlcanceService } from './alcance.service.js';
import type { AuthUser } from './auth-user.js';
import type { ConjuntoActivo } from './conjunto-activo.js';

const CONJUNTO_HEADER = 'x-conjunto-id';

/**
 * Autorizacion.
 *
 * QUE puede hacer la persona lo resuelve `AlcanceService`, que es el mismo que
 * responde `/auth/me`: si la interfaz y el guard no leyeran la misma regla, la
 * app dibujaria botones que el guard rechaza.
 *
 * Aqui solo queda lo que es de esta peticion: leer la cabecera, comparar contra
 * lo que el endpoint exige, y elegir el codigo HTTP.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly alcance: AlcanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<CodigoPermiso[] | undefined>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; conjuntoActivo?: ConjuntoActivo }>();

    const user = request.user;
    if (!user) throw new ForbiddenException('No autenticado');

    const conjuntoId = request.header(CONJUNTO_HEADER);
    if (!conjuntoId) throw new BadRequestException(`Falta la cabecera ${CONJUNTO_HEADER}`);

    const resolucion = await this.alcance.enElConjunto(user.id, conjuntoId);
    if (resolucion.tipo === 'sin-vinculo') {
      throw new ForbiddenException('No perteneces a este conjunto');
    }
    if (resolucion.tipo === 'conjunto-no-existe') {
      throw new ForbiddenException('Ese conjunto no existe');
    }

    const { alcance } = resolucion;
    if (!requeridos.some((codigo) => alcance.permisos.has(codigo))) {
      throw new ForbiddenException('No tienes permisos para esta accion');
    }

    request.conjuntoActivo = alcance;
    return true;
  }
}
