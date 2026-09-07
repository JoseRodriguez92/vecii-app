import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarZonaComunDto, CrearZonaComunDto } from './dto/zona-comun.dto.js';
import { conHoras } from './horas.js';

/** Lo que trae toda respuesta de zona: el espacio que la aparta, si existe. */
const CON_ESPACIO = {
  agrupacion: { select: { id: true, nombre: true, tipo: true } },
  espacio: { select: { id: true, nombre: true, capacidad: true, activo: true } },
} as const;

@Injectable()
export class ZonasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    conjuntoId: string,
    opciones: { incluirInactivas?: boolean; agrupacionId?: string; soloReservables?: boolean } = {},
  ) {
    return this.prisma.zonaComun.findMany({
      where: {
        conjuntoId,
        ...(opciones.incluirInactivas ? {} : { activo: true }),
        ...(opciones.agrupacionId ? { agrupacionId: opciones.agrupacionId } : {}),
        // "Se reserva" no es un campo: es tener un espacio reservable apuntando aca.
        ...(opciones.soloReservables ? { espacio: { isNot: null } } : {}),
      },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      include: { ...CON_ESPACIO, _count: { select: { horarios: true } } },
    });
  }

  /**
   * Una zona con sus franjas. Es la pantalla del residente: que es, para cuantos
   * y a que horas abre.
   */
  async obtener(conjuntoId: string, id: string) {
    const zona = await this.prisma.zonaComun.findFirst({
      where: { id, conjuntoId },
      include: {
        ...CON_ESPACIO,
        horarios: { orderBy: [{ dia: 'asc' }, { apertura: 'asc' }] },
      },
    });
    if (!zona) throw new NotFoundException('Esa zona comun no existe en este conjunto');
    return { ...zona, horarios: zona.horarios.map(conHoras) };
  }

  async crear(conjuntoId: string, dto: CrearZonaComunDto) {
    await this.validar(conjuntoId, dto);
    return this.prisma.zonaComun.create({
      data: { ...dto, conjuntoId },
      include: CON_ESPACIO,
    });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarZonaComunDto) {
    const zona = await this.exigir(conjuntoId, id);
    await this.validar(conjuntoId, dto, id);

    // Sacar de servicio una zona que todavia se puede apartar dejaria a la gente
    // reservando algo que esta en mantenimiento. Cruza dos tablas, asi que no hay
    // CHECK que lo vea: va aca.
    const espacio = await this.prisma.espacioReservable.findFirst({
      where: { zonaComunId: id },
      select: { nombre: true, activo: true },
    });

    if (dto.activo === false && zona.activo && espacio?.activo) {
      throw new BadRequestException(
        `No se puede sacar de servicio mientras el espacio "${espacio.nombre}" siga activo: ` +
          'la gente podria seguir apartandola. Desactiva primero el espacio.',
      );
    }

    return this.prisma.zonaComun.update({ where: { id }, data: dto, include: CON_ESPACIO });
  }

  /** Existe y es de este conjunto. La usan tambien los horarios. */
  async exigir(conjuntoId: string, id: string) {
    const zona = await this.prisma.zonaComun.findFirst({ where: { id, conjuntoId } });
    if (!zona) throw new NotFoundException('Esa zona comun no existe en este conjunto');
    return zona;
  }

  private async validar(
    conjuntoId: string,
    dto: Partial<CrearZonaComunDto>,
    idActual?: string,
  ): Promise<void> {
    if (dto.agrupacionId) {
      const agrupacion = await this.prisma.agrupacion.findFirst({
        where: { id: dto.agrupacionId, conjuntoId },
        select: { id: true },
      });
      if (!agrupacion) throw new BadRequestException('Esa agrupacion no existe en este conjunto');
    }

    // La base ya lo impide con @@unique([conjuntoId, nombre]), pero de ahi sale
    // un P2002 que hoy se traduce en un HTTP 500. Ver docs/pendientes.md.
    if (dto.nombre) {
      const repetida = await this.prisma.zonaComun.findFirst({
        where: { conjuntoId, nombre: dto.nombre, ...(idActual ? { NOT: { id: idActual } } : {}) },
        select: { id: true },
      });
      if (repetida) throw new BadRequestException(`Ya existe una zona comun "${dto.nombre}"`);
    }
  }
}
