import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CodigoPermiso } from '../common/permisos.js';
import { PERMISOS_KEY } from '../common/decorators/requiere-permiso.decorator.js';
import { rolDeRelacion } from '../common/roles-derivados.js';
import { rolVigente } from '../common/rol-vigente.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';
import type { ConjuntoActivo } from './conjunto-activo.js';
import { PermisosService } from './permisos.service.js';

const CONJUNTO_HEADER = 'x-conjunto-id';

/**
 * Autorizacion. Resuelve, para el conjunto que indica `x-conjunto-id`:
 *
 *   1. los roles OTORGADOS al usuario (vigentes hoy)
 *   2. mas los roles DERIVADOS de sus unidades (propietario, residente)
 *   3. los permisos que dan esos roles
 *   4. y comprueba si alguno satisface lo que el endpoint exige
 *
 * Deja todo en `request.conjuntoActivo`.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
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

    const vinculo = await this.prisma.usuarioConjunto.findUnique({
      where: { usuarioId_conjuntoId: { usuarioId: user.id, conjuntoId } },
      select: {
        id: true,
        conjuntoId: true,
        activo: true,
        roles: { where: rolVigente(), select: { rol: { select: { codigo: true } } } },
      },
    });

    if (!vinculo || !vinculo.activo) {
      throw new ForbiddenException('No perteneces a este conjunto');
    }

    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: {
        usuarioId: user.id,
        unidad: { conjuntoId },
        OR: [{ hasta: null }, { hasta: { gt: new Date() } }],
      },
      select: { relacion: true },
      distinct: ['relacion'],
    });

    const roles = [
      ...new Set([
        ...vinculo.roles.map((a) => a.rol.codigo as string),
        ...ocupaciones.map((o) => rolDeRelacion(o.relacion) as string),
      ]),
    ];

    const permisos = await this.permisos.permisosDe(roles);
    if (!requeridos.some((codigo) => permisos.has(codigo))) {
      throw new ForbiddenException('No tienes permisos para esta accion');
    }

    request.conjuntoActivo = { id: vinculo.id, conjuntoId: vinculo.conjuntoId, roles, permisos };
    return true;
  }
}
