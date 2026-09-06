import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarTipologiaDto, CrearTipologiaDto } from './dto/tipologia.dto.js';

@Injectable()
export class TipologiasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(conjuntoId: string) {
    return this.prisma.tipologia.findMany({
      where: { conjuntoId },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { unidades: true } } },
    });
  }

  async obtener(conjuntoId: string, id: string) {
    const tipologia = await this.prisma.tipologia.findFirst({
      where: { id, conjuntoId },
      include: { _count: { select: { unidades: true } } },
    });
    if (!tipologia) throw new NotFoundException('Tipologia no encontrada');
    return tipologia;
  }

  crear(conjuntoId: string, dto: CrearTipologiaDto) {
    return this.prisma.tipologia.create({ data: { ...dto, conjuntoId } });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarTipologiaDto) {
    await this.obtener(conjuntoId, id);
    return this.prisma.tipologia.update({ where: { id }, data: dto });
  }

  async eliminar(conjuntoId: string, id: string) {
    const tipologia = await this.obtener(conjuntoId, id);
    if (tipologia._count.unidades > 0) {
      throw new BadRequestException(
        `No se puede eliminar: ${tipologia._count.unidades} unidad(es) la usan. ` +
          'Reasignalas primero.',
      );
    }
    await this.prisma.tipologia.delete({ where: { id } });
  }
}
