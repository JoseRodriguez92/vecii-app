import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { GuardarPoliticaDto } from './dto/politica.dto.js';
import { EspaciosService } from './espacios.service.js';

@Injectable()
export class PoliticasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly espacios: EspaciosService,
  ) {}

  async obtener(conjuntoId: string, espacioId: string) {
    await this.espacios.obtener(conjuntoId, espacioId);
    const politica = await this.prisma.politicaReserva.findFirst({
      where: { espacioId, conjuntoId },
    });
    if (!politica) {
      throw new NotFoundException(
        'Ese espacio no tiene politica: se puede reservar sin mas restriccion que la capacidad',
      );
    }
    return politica;
  }

  /** Una politica por espacio: se crea o se reemplaza, no se acumulan. */
  async guardar(conjuntoId: string, espacioId: string, dto: GuardarPoliticaDto) {
    await this.espacios.obtener(conjuntoId, espacioId);

    const { duracionMinimaMinutos: min, duracionMaximaMinutos: max } = dto;
    if (min && max && min > max) {
      throw new BadRequestException('La duracion minima es mayor que la maxima');
    }
    if (dto.anticipacionMinimaHoras && dto.anticipacionMaximaDias) {
      const maximaHoras = dto.anticipacionMaximaDias * 24;
      if (dto.anticipacionMinimaHoras > maximaHoras) {
        throw new BadRequestException(
          'La anticipacion minima supera la maxima: no habria ninguna franja valida',
        );
      }
    }

    return this.prisma.politicaReserva.upsert({
      where: { espacioId },
      create: { ...dto, espacioId, conjuntoId },
      update: dto,
    });
  }

  async eliminar(conjuntoId: string, espacioId: string) {
    await this.obtener(conjuntoId, espacioId);
    await this.prisma.politicaReserva.delete({ where: { espacioId } });
    return { eliminada: true };
  }
}
