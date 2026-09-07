import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NaturalezaParqueadero, TipoUnidad } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarParqueaderoDto, CrearParqueaderoDto } from './dto/parqueadero.dto.js';
import { problemaDeUnidad } from './reglas-parqueadero.js';

const CON_CONTEXTO = {
  agrupacion: { select: { id: true, nombre: true, tipo: true } },
  /// La unidad que el cupo ES (solo PRIVADO), no la que lo usa.
  unidad: { select: { id: true, identificador: true } },
} as const;

@Injectable()
export class ParqueaderosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    conjuntoId: string,
    opciones: {
      incluirInactivos?: boolean;
      naturaleza?: NaturalezaParqueadero;
      agrupacionId?: string;
      soloLibres?: boolean;
    } = {},
  ) {
    return this.prisma.parqueadero.findMany({
      where: {
        conjuntoId,
        ...(opciones.incluirInactivos ? {} : { activo: true }),
        ...(opciones.naturaleza ? { naturaleza: opciones.naturaleza } : {}),
        ...(opciones.agrupacionId ? { agrupacionId: opciones.agrupacionId } : {}),
        // "Libre" = sin ninguna asignacion vigente. Se pregunta por la ausencia
        // de una fila abierta, no por un campo `ocupado`: ese campo habria que
        // mantenerlo de acuerdo con las asignaciones y algun dia mentiria.
        ...(opciones.soloLibres ? { asignaciones: { none: { hasta: null } } } : {}),
      },
      orderBy: [{ naturaleza: 'asc' }, { identificador: 'asc' }],
      include: {
        ...CON_CONTEXTO,
        asignaciones: {
          where: { hasta: null },
          select: {
            id: true,
            origen: true,
            desde: true,
            unidad: { select: { id: true, identificador: true } },
          },
        },
      },
    });
  }

  async obtener(conjuntoId: string, id: string) {
    const cupo = await this.prisma.parqueadero.findFirst({
      where: { id, conjuntoId },
      include: {
        ...CON_CONTEXTO,
        asignaciones: {
          orderBy: { desde: 'desc' },
          include: { unidad: { select: { id: true, identificador: true } } },
        },
      },
    });
    if (!cupo) throw new NotFoundException('Ese parqueadero no existe en este conjunto');
    return cupo;
  }

  async crear(conjuntoId: string, dto: CrearParqueaderoDto) {
    await this.validar(conjuntoId, dto, dto.naturaleza);
    return this.prisma.parqueadero.create({
      data: { ...dto, conjuntoId },
      include: CON_CONTEXTO,
    });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarParqueaderoDto) {
    const cupo = await this.exigir(conjuntoId, id);
    // La naturaleza resultante manda: si el dto la cambia, las reglas se
    // evaluan contra la nueva, no contra la que habia.
    const naturaleza = dto.naturaleza ?? cupo.naturaleza;
    const unidadId = dto.unidadId === undefined ? cupo.unidadId : dto.unidadId;
    await this.validar(conjuntoId, { ...dto, unidadId: unidadId ?? undefined }, naturaleza, id);

    // Cambiar la naturaleza de un cupo que ya tiene gente asignada puede dejar
    // asignaciones que hoy serian imposibles de crear. Se bloquea: primero se
    // cierran, despues se cambia.
    if (dto.naturaleza && dto.naturaleza !== cupo.naturaleza) {
      const vigentes = await this.prisma.asignacionParqueadero.count({
        where: { parqueaderoId: id, hasta: null },
      });
      if (vigentes > 0) {
        throw new BadRequestException(
          `No se puede cambiar la naturaleza mientras haya ${vigentes} asignacion(es) vigente(s): ` +
            'quedarian con un origen que hoy seria invalido. Cierralas primero.',
        );
      }
    }

    return this.prisma.parqueadero.update({ where: { id }, data: dto, include: CON_CONTEXTO });
  }

  async exigir(conjuntoId: string, id: string) {
    const cupo = await this.prisma.parqueadero.findFirst({ where: { id, conjuntoId } });
    if (!cupo) throw new NotFoundException('Ese parqueadero no existe en este conjunto');
    return cupo;
  }

  private async validar(
    conjuntoId: string,
    dto: Partial<CrearParqueaderoDto>,
    naturaleza: NaturalezaParqueadero,
    idActual?: string,
  ): Promise<void> {
    const problema = problemaDeUnidad(naturaleza, dto.unidadId);
    if (problema) throw new BadRequestException(problema);

    if (dto.agrupacionId) {
      const agrupacion = await this.prisma.agrupacion.findFirst({
        where: { id: dto.agrupacionId, conjuntoId },
        select: { id: true },
      });
      if (!agrupacion) throw new BadRequestException('Esa agrupacion no existe en este conjunto');
    }

    if (dto.unidadId) {
      const unidad = await this.prisma.unidad.findFirst({
        where: { id: dto.unidadId, conjuntoId },
        select: { id: true, tipo: true, identificador: true },
      });
      if (!unidad) throw new BadRequestException('Esa unidad no existe en este conjunto');
      if (unidad.tipo !== TipoUnidad.PARQUEADERO) {
        throw new BadRequestException(
          `La unidad "${unidad.identificador}" es de tipo ${unidad.tipo}. Un cupo PRIVADO ES una ` +
            'unidad de tipo PARQUEADERO, con su propia matricula y coeficiente.',
        );
      }
      // Dos cupos no pueden ser la misma unidad: la matricula es una sola.
      const yaEs = await this.prisma.parqueadero.findFirst({
        where: { unidadId: dto.unidadId, ...(idActual ? { NOT: { id: idActual } } : {}) },
        select: { identificador: true },
      });
      if (yaEs) {
        throw new BadRequestException(`Esa unidad ya es el cupo "${yaEs.identificador}"`);
      }
    }

    if (dto.identificador) {
      const repetido = await this.prisma.parqueadero.findFirst({
        where: {
          conjuntoId,
          identificador: dto.identificador,
          ...(idActual ? { NOT: { id: idActual } } : {}),
        },
        select: { id: true },
      });
      if (repetido) throw new BadRequestException(`Ya existe el cupo "${dto.identificador}"`);
    }
  }
}
