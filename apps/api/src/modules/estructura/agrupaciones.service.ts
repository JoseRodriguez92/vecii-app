import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PROFUNDIDAD_MAXIMA } from './arbol-agrupaciones.js';
import type { ActualizarAgrupacionDto, CrearAgrupacionDto } from './dto/agrupacion.dto.js';

@Injectable()
export class AgrupacionesService {
  constructor(private readonly prisma: PrismaService) {}

  listar(conjuntoId: string) {
    return this.prisma.agrupacion.findMany({
      where: { conjuntoId },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { unidades: true, hijas: true } } },
    });
  }

  async obtener(conjuntoId: string, id: string) {
    const agrupacion = await this.prisma.agrupacion.findFirst({
      where: { id, conjuntoId },
      include: {
        padre: { select: { id: true, nombre: true, tipo: true } },
        hijas: { select: { id: true, nombre: true, tipo: true } },
        _count: { select: { unidades: true } },
      },
    });
    if (!agrupacion) throw new NotFoundException('Agrupacion no encontrada');
    return agrupacion;
  }

  async crear(conjuntoId: string, dto: CrearAgrupacionDto) {
    if (dto.padreId) await this.validarPadre(conjuntoId, dto.padreId, null);
    return this.prisma.agrupacion.create({ data: { ...dto, conjuntoId } });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarAgrupacionDto) {
    await this.obtener(conjuntoId, id);
    if (dto.padreId) await this.validarPadre(conjuntoId, dto.padreId, id);
    return this.prisma.agrupacion.update({ where: { id }, data: dto });
  }

  async eliminar(conjuntoId: string, id: string) {
    const agrupacion = await this.obtener(conjuntoId, id);
    if (agrupacion._count.unidades > 0) {
      throw new BadRequestException(
        `No se puede eliminar: tiene ${agrupacion._count.unidades} unidad(es). ` +
          'Muevelas a otra agrupacion primero.',
      );
    }
    if (agrupacion.hijas.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar: contiene ${agrupacion.hijas.length} agrupacion(es).`,
      );
    }
    await this.prisma.agrupacion.delete({ where: { id } });
  }

  /**
   * Sube por la cadena de padres verificando tres cosas a la vez:
   * que el padre exista en ESTE conjunto, que no se forme un ciclo, y que el
   * arbol no pase de PROFUNDIDAD_MAXIMA.
   *
   * El ciclo importa: Postgres acepta feliz que A sea padre de B y B de A, y a
   * partir de ahi cualquier recorrido del arbol entra en bucle infinito y tumba
   * la API. La base no lo impide; hay que impedirlo aqui.
   */
  private async validarPadre(conjuntoId: string, padreId: string, idQueSeEdita: string | null) {
    if (padreId === idQueSeEdita) {
      throw new BadRequestException('Una agrupacion no puede ser su propio padre');
    }

    let actual: string | null = padreId;
    let niveles = 1;

    while (actual) {
      const nodo: { id: string; padreId: string | null } | null =
        await this.prisma.agrupacion.findFirst({
          where: { id: actual, conjuntoId },
          select: { id: true, padreId: true },
        });

      if (!nodo) {
        throw new BadRequestException('La agrupacion padre no existe en este conjunto');
      }
      if (idQueSeEdita && nodo.padreId === idQueSeEdita) {
        throw new BadRequestException(
          'Ese cambio crearia un ciclo: la agrupacion padre desciende de la que estas editando',
        );
      }
      if (++niveles > PROFUNDIDAD_MAXIMA) {
        throw new BadRequestException(
          `El arbol no puede tener mas de ${PROFUNDIDAD_MAXIMA} niveles`,
        );
      }
      actual = nodo.padreId;
    }
  }
}
