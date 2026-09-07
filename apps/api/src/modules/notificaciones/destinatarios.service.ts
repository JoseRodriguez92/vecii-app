import { Injectable } from '@nestjs/common';
import { rolVigente } from '../../common/rol-vigente.js';
import { ROL } from '../../common/roles.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { conSusHijas } from '../estructura/arbol-agrupaciones.js';
import type { Destinatario } from './destinatarios.js';

/**
 * Traduce "a quien" a una lista de personas.
 *
 * Esta aparte de `NotificacionesService` porque son dos preguntas distintas:
 * alla se decide QUE se guarda y como se ve; aca, QUIEN debe enterarse. La
 * segunda es la que tiene reglas del negocio adentro —quien vive hoy en la
 * unidad, que cuelga de esa etapa, quien tiene ese permiso— y es la que hay que
 * poder leer sola.
 */
@Injectable()
export class DestinatariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sin repetidos: el administrador tambien vive en el conjunto. */
  async resolver(conjuntoId: string, para: Destinatario): Promise<string[]> {
    if ('persona' in para) return [para.persona];
    if ('unidad' in para) return this.deUnidades(conjuntoId, [para.unidad]);
    if ('agrupacion' in para) {
      const ramas = await conSusHijas(this.prisma, conjuntoId, para.agrupacion);
      return this.deUnidades(conjuntoId, undefined, ramas);
    }
    if ('conjunto' in para) {
      const vinculos = await this.prisma.usuarioConjunto.findMany({
        where: { conjuntoId, activo: true },
        select: { usuarioId: true },
      });
      return [...new Set(vinculos.map((v) => v.usuarioId))];
    }
    return this.conElPermiso(conjuntoId, para.permiso);
  }

  /** Quien vive, hoy, en esas unidades. */
  private async deUnidades(conjuntoId: string, unidadIds?: string[], agrupacionIds?: string[]) {
    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: {
        unidad: {
          conjuntoId,
          ...(unidadIds ? { id: { in: unidadIds } } : {}),
          ...(agrupacionIds ? { agrupacionId: { in: agrupacionIds } } : {}),
        },
        ...rolVigente(),
      },
      select: { usuarioId: true },
    });
    return [...new Set(ocupaciones.map((o) => o.usuarioId))];
  }

  /**
   * Quien puede hacer algo en este conjunto.
   *
   * Junta las dos fuentes que aplican aca: los cargos otorgados y los roles
   * DERIVADOS de vivir en una unidad (propietario, residente). No incluye a los
   * usuarios de plataforma a proposito: el equipo de Vecii entra a todos los
   * conjuntos, y si contaran, a un solo empleado le llegarian los avisos de los
   * cuatrocientos.
   */
  private async conElPermiso(conjuntoId: string, permiso: string): Promise<string[]> {
    const roles = await this.prisma.rol.findMany({
      where: {
        OR: [{ conjuntoId: null }, { conjuntoId }],
        permisos: { some: { permiso: { codigo: permiso } } },
      },
      select: { id: true, codigo: true },
    });
    if (roles.length === 0) return [];

    const otorgados = await this.prisma.usuarioConjuntoRol.findMany({
      where: {
        rolId: { in: roles.map((r) => r.id) },
        usuarioConjunto: { conjuntoId, activo: true },
        ...rolVigente(),
      },
      select: { usuarioConjunto: { select: { usuarioId: true } } },
    });
    const ids = otorgados.map((o) => o.usuarioConjunto.usuarioId);

    // Propietario y residente no se otorgan: salen de vivir en una unidad.
    const derivados = roles.map((r) => r.codigo);
    if (derivados.includes(ROL.PROPIETARIO) || derivados.includes(ROL.RESIDENTE)) {
      ids.push(...(await this.deUnidades(conjuntoId)));
    }

    return [...new Set(ids)];
  }
}
