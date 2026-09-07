import { BadRequestException, Injectable } from '@nestjs/common';
import type { DiaSemana } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { FranjaDto } from './dto/horario.dto.js';
import { aHora, conHoras } from './horas.js';
import { ZonasService } from './zonas.service.js';

@Injectable()
export class HorariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonas: ZonasService,
  ) {}

  async listar(conjuntoId: string, zonaComunId: string) {
    await this.zonas.exigir(conjuntoId, zonaComunId);
    const franjas = await this.prisma.horarioZonaComun.findMany({
      where: { zonaComunId },
      orderBy: [{ dia: 'asc' }, { apertura: 'asc' }],
    });
    return franjas.map(conHoras);
  }

  /**
   * Reemplaza la semana entera.
   *
   * Va en una transaccion porque el borrado y la escritura son una sola cosa: si
   * fallara en el medio, la zona quedaria sin horarios y eso se lee como
   * "cerrada toda la semana", que es peor que no haber tocado nada.
   */
  async reemplazar(conjuntoId: string, zonaComunId: string, franjas: FranjaDto[]) {
    await this.zonas.exigir(conjuntoId, zonaComunId);
    this.validar(franjas);

    return this.prisma.$transaction(async (tx) => {
      await tx.horarioZonaComun.deleteMany({ where: { zonaComunId } });
      if (franjas.length > 0) {
        await tx.horarioZonaComun.createMany({
          data: franjas.map((f) => ({ zonaComunId, ...f })),
        });
      }
      const guardadas = await tx.horarioZonaComun.findMany({
        where: { zonaComunId },
        orderBy: [{ dia: 'asc' }, { apertura: 'asc' }],
      });
      return guardadas.map(conHoras);
    });
  }

  /**
   * Lo que la base no puede ver.
   *
   * `@@unique([zonaComunId, dia, apertura])` solo impide dos franjas que
   * arranquen en el mismo minuto. No impide 08:00–14:00 junto a 12:00–20:00, que
   * es la equivocacion de verdad: al validar una reserva contra el horario, esas
   * dos franjas dan respuestas distintas para las 13:00 y gana la que se mire
   * primero.
   */
  private validar(franjas: FranjaDto[]): void {
    for (const f of franjas) {
      if (f.cierre <= f.apertura) {
        throw new BadRequestException(
          `${f.dia}: cierra a las ${aHora(f.cierre)} y abre a las ${aHora(f.apertura)}. ` +
            'Un horario que pasa de medianoche se parte en dos dias.',
        );
      }
    }

    const porDia = new Map<DiaSemana, FranjaDto[]>();
    for (const f of franjas) {
      const dia = porDia.get(f.dia) ?? [];
      dia.push(f);
      porDia.set(f.dia, dia);
    }

    for (const [dia, delDia] of porDia) {
      const ordenadas = [...delDia].sort((a, b) => a.apertura - b.apertura);
      for (let i = 1; i < ordenadas.length; i += 1) {
        const previa = ordenadas[i - 1];
        const actual = ordenadas[i];
        if (actual.apertura < previa.cierre) {
          throw new BadRequestException(
            `${dia}: las franjas ${aHora(previa.apertura)}-${aHora(previa.cierre)} y ` +
              `${aHora(actual.apertura)}-${aHora(actual.cierre)} se solapan.`,
          );
        }
      }
    }
  }
}
