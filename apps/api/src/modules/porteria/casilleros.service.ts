import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarCasilleroDto, CrearCasilleroDto } from './dto/casillero.dto.js';

@Injectable()
export class CasillerosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(conjuntoId: string, opciones: { agrupacionId?: string; sinUnidad?: boolean } = {}) {
    return this.prisma.casillero.findMany({
      where: {
        conjuntoId,
        ...(opciones.agrupacionId ? { agrupacionId: opciones.agrupacionId } : {}),
        ...(opciones.sinUnidad ? { unidadId: null } : {}),
      },
      orderBy: { identificador: 'asc' },
      include: {
        unidad: { select: { id: true, identificador: true, tipo: true } },
        agrupacion: { select: { id: true, nombre: true } },
      },
    });
  }

  async crear(conjuntoId: string, dto: CrearCasilleroDto) {
    await this.validar(conjuntoId, dto);
    return this.prisma.casillero.create({ data: { ...dto, conjuntoId } });
  }

  /**
   * Carga masiva. Existe por la misma razon que la de unidades: nadie va a crear
   * 120 casilleros de a uno, y una app que se lo exija termina sin casilleros.
   *
   * Todo o nada. Un conjunto con la mitad de las casillas cargadas parece
   * completo y es peor que uno vacio.
   */
  async importar(conjuntoId: string, casilleros: CrearCasilleroDto[]) {
    const repetidos = casilleros
      .map((c) => c.identificador)
      .filter((id, i, todos) => todos.indexOf(id) !== i);
    if (repetidos.length) {
      throw new BadRequestException(
        `El archivo trae identificadores repetidos: ${[...new Set(repetidos)].join(', ')}`,
      );
    }

    for (const dto of casilleros) await this.validar(conjuntoId, dto);

    await this.prisma.casillero.createMany({
      data: casilleros.map((c) => ({ ...c, conjuntoId })),
    });
    return this.prisma.casillero.findMany({
      where: { conjuntoId },
      orderBy: { identificador: 'asc' },
    });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarCasilleroDto) {
    const existe = await this.prisma.casillero.findFirst({ where: { id, conjuntoId } });
    if (!existe) throw new NotFoundException('Casillero no encontrado');
    await this.validar(conjuntoId, dto, id);
    return this.prisma.casillero.update({ where: { id }, data: dto });
  }

  /**
   * Comprueba que lo que apunta el casillero sea del mismo conjunto.
   *
   * Las FK compuestas ya impiden a nivel de base que un casillero del conjunto A
   * apunte a una unidad del B, pero el error que devuelve Postgres es ilegible.
   * Esto es para que el mensaje sirva.
   */
  private async validar(conjuntoId: string, dto: Partial<CrearCasilleroDto>, idActual?: string) {
    const db = this.prisma;

    if (dto.unidadId) {
      const unidad = await db.unidad.findFirst({ where: { id: dto.unidadId, conjuntoId } });
      if (!unidad) throw new BadRequestException('Esa unidad no existe en este conjunto');

      const ocupado = await db.casillero.findFirst({
        where: { conjuntoId, unidadId: dto.unidadId, ...(idActual ? { NOT: { id: idActual } } : {}) },
      });
      if (ocupado) {
        throw new BadRequestException(
          `La unidad ${unidad.identificador} ya tiene el casillero ${ocupado.identificador}`,
        );
      }
    }

    if (dto.agrupacionId) {
      const agrupacion = await db.agrupacion.findFirst({
        where: { id: dto.agrupacionId, conjuntoId },
      });
      if (!agrupacion) throw new BadRequestException('Esa agrupacion no existe en este conjunto');
    }

    if (dto.identificador) {
      const repetido = await db.casillero.findFirst({
        where: {
          conjuntoId,
          identificador: dto.identificador,
          ...(idActual ? { NOT: { id: idActual } } : {}),
        },
      });
      if (repetido) {
        throw new BadRequestException(`Ya existe un casillero "${dto.identificador}"`);
      }
    }
  }
}
