import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarEspacioDto, CrearEspacioDto } from './dto/espacio.dto.js';

@Injectable()
export class EspaciosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(conjuntoId: string, incluirInactivos = false) {
    return this.prisma.espacioReservable.findMany({
      where: { conjuntoId, ...(incluirInactivos ? {} : { activo: true }) },
      orderBy: { nombre: 'asc' },
      include: {
        zonaComun: { select: { id: true, nombre: true, tipo: true, aforo: true } },
        agrupacion: { select: { id: true, nombre: true } },
        politica: true,
      },
    });
  }

  async crear(conjuntoId: string, dto: CrearEspacioDto) {
    await this.validar(conjuntoId, dto);
    return this.prisma.espacioReservable.create({ data: { ...dto, conjuntoId } });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarEspacioDto) {
    await this.obtener(conjuntoId, id);
    await this.validar(conjuntoId, dto, id);
    return this.prisma.espacioReservable.update({ where: { id }, data: dto });
  }

  /**
   * Cuantos cupos quedan en una franja.
   *
   * Es la pregunta que hace la app antes de dejar apartar, y la que deberia
   * mirar porteria antes de dejar entrar un carro sin reserva.
   *
   * OJO: cuenta RESERVAS, no ocupacion real. Mientras no exista control de
   * ingreso, un carro que entro sin reservar es invisible aqui. Ver
   * docs/pendientes.md.
   */
  async disponibilidad(conjuntoId: string, id: string, desde: Date, fin: Date) {
    const espacio = await this.obtener(conjuntoId, id);
    if (fin <= desde) throw new BadRequestException('El fin va despues del inicio');

    const ocupados = await this.prisma.reserva.count({
      where: {
        espacioId: id,
        estado: { in: ['SOLICITADA', 'CONFIRMADA'] },
        inicio: { lt: fin },
        // Una reserva abierta (fin null) ocupa el cupo hasta que porteria
        // registre la salida: cuenta como ocupada siempre.
        OR: [{ fin: null }, { fin: { gt: desde } }],
      },
    });

    return {
      espacioId: id,
      nombre: espacio.nombre,
      capacidad: espacio.capacidad,
      reservados: ocupados,
      disponibles: Math.max(0, espacio.capacidad - ocupados),
      advertencia:
        'Incluye las reservas abiertas, que ocupan hasta que porteria registre la salida.',
    };
  }

  async obtener(conjuntoId: string, id: string) {
    const espacio = await this.prisma.espacioReservable.findFirst({ where: { id, conjuntoId } });
    if (!espacio) throw new NotFoundException('Ese espacio reservable no existe en este conjunto');
    return espacio;
  }

  /**
   * Un espacio apunta a UNA de dos cosas: una zona comun concreta, o el pool de
   * parqueaderos de cierta naturaleza. Ni las dos ni ninguna.
   */
  private async validar(conjuntoId: string, dto: Partial<CrearEspacioDto>, idActual?: string) {
    const tieneZona = Boolean(dto.zonaComunId);
    const tienePool = Boolean(dto.naturalezaParqueadero);

    if (tieneZona && tienePool) {
      throw new BadRequestException(
        'Un espacio es una zona comun o un pool de parqueaderos, no las dos',
      );
    }
    // Al crear hay que decir a que apunta; al editar puede venir solo el nombre.
    if (!idActual && !tieneZona && !tienePool) {
      throw new BadRequestException(
        'Falta decir a que apunta: una zona comun (zonaComunId) o un pool (naturalezaParqueadero)',
      );
    }

    if (dto.zonaComunId) {
      const zona = await this.prisma.zonaComun.findFirst({
        where: { id: dto.zonaComunId, conjuntoId },
        select: { id: true },
      });
      if (!zona) throw new BadRequestException('Esa zona comun no existe en este conjunto');

      const ocupada = await this.prisma.espacioReservable.findFirst({
        where: {
          zonaComunId: dto.zonaComunId,
          ...(idActual ? { NOT: { id: idActual } } : {}),
        },
        select: { nombre: true },
      });
      if (ocupada) {
        throw new BadRequestException(`Esa zona comun ya es el espacio "${ocupada.nombre}"`);
      }
    }

    if (dto.agrupacionId) {
      const agrupacion = await this.prisma.agrupacion.findFirst({
        where: { id: dto.agrupacionId, conjuntoId },
        select: { id: true },
      });
      if (!agrupacion) throw new BadRequestException('Esa agrupacion no existe en este conjunto');
    }

    if (dto.nombre) {
      const repetido = await this.prisma.espacioReservable.findFirst({
        where: { conjuntoId, nombre: dto.nombre, ...(idActual ? { NOT: { id: idActual } } : {}) },
        select: { id: true },
      });
      if (repetido) throw new BadRequestException(`Ya existe un espacio "${dto.nombre}"`);
    }
  }
}
