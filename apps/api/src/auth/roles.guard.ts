import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import type { RolMembresia } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

export interface MembresiaContext {
  id: string;
  conjuntoId: string;
  rol: RolMembresia;
}

const CONJUNTO_HEADER = 'x-conjunto-id';

/**
 * Resuelve el conjunto activo desde la cabecera `x-conjunto-id`, carga la
 * membresia del usuario y verifica los roles exigidos por `@Roles()`.
 * Deja la membresia en `request.membresia`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RolMembresia[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; membresia?: MembresiaContext }>();

    const user = request.user;
    if (!user) throw new ForbiddenException('No autenticado');

    const conjuntoId = request.header(CONJUNTO_HEADER);
    if (!conjuntoId) {
      throw new BadRequestException(`Falta la cabecera ${CONJUNTO_HEADER}`);
    }

    const membresia = await this.prisma.membresia.findUnique({
      where: { usuarioId_conjuntoId: { usuarioId: user.id, conjuntoId } },
      select: { id: true, conjuntoId: true, rol: true, activo: true },
    });

    if (!membresia || !membresia.activo) {
      throw new ForbiddenException('No perteneces a este conjunto');
    }
    if (!requiredRoles.includes(membresia.rol)) {
      throw new ForbiddenException('No tienes permisos para esta accion');
    }

    request.membresia = {
      id: membresia.id,
      conjuntoId: membresia.conjuntoId,
      rol: membresia.rol,
    };
    return true;
  }
}
