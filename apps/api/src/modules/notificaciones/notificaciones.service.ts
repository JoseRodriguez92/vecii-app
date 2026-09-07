import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { TipoNotificacion } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Destinatario } from './destinatarios.js';
import { DestinatariosService } from './destinatarios.service.js';

export interface Aviso {
  conjuntoId: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string;
  /** A donde lleva al tocarlo. */
  entidad?: string;
  entidadId?: string;
  /**
   * Desde cuando se ve. Omitido = ahora.
   *
   * Con fecha futura el aviso existe en la base pero no aparece en la campanita
   * hasta su hora. Asi cabe el recordatorio de la reserva sin ninguna tarea
   * programada.
   */
  programadaPara?: Date;
  /** No avisarle a quien lo provoco: el portero no necesita que le avisen que registro algo. */
  excepto?: string;
  para: Destinatario;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aQuien: DestinatariosService,
  ) {}

  // --- lo que ve la campanita ----------------------------------------------

  /**
   * Los avisos de quien pregunta. Solo los que ya se ven.
   *
   * Se filtra por `usuarioId` ANTES que por nada mas, asi que aunque llegue un
   * conjunto ajeno en la cabecera no hay nada que filtrar mal: los avisos de
   * otro no son de uno.
   *
   * Devuelve TAMBIEN `sinLeerEnOtros`, y esa es la parte que importa: una misma
   * persona puede tener apartamento en dos conjuntos que usan Vecii. Si la
   * campanita solo contara el conjunto activo, un paquete que llega al otro
   * marcaria cero y esa persona no se enteraria hasta cambiarse de conjunto — y
   * un aviso que no llega no es un aviso.
   */
  async listar(
    usuarioId: string,
    conjuntoId: string,
    opciones: { soloSinLeer?: boolean; limite?: number; todosLosConjuntos?: boolean } = {},
  ) {
    const ahora = new Date();
    const where = {
      usuarioId,
      ...(opciones.todosLosConjuntos ? {} : { conjuntoId }),
      programadaPara: { lte: ahora },
      ...(opciones.soloSinLeer ? { leidaEn: null } : {}),
    };

    const [items, sinLeer, sinLeerEnOtros] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { programadaPara: 'desc' },
        take: Math.min(opciones.limite ?? 50, 100),
        // El nombre del conjunto solo hace falta cuando se mezclan, que es
        // justo cuando el aviso se vuelve ambiguo sin el.
        ...(opciones.todosLosConjuntos
          ? { include: { conjunto: { select: { id: true, nombre: true } } } }
          : {}),
      }),
      this.contarSinLeer(usuarioId, conjuntoId),
      this.prisma.notificacion.count({
        where: {
          usuarioId,
          conjuntoId: { not: conjuntoId },
          leidaEn: null,
          programadaPara: { lte: ahora },
        },
      }),
    ]);

    return { sinLeer, sinLeerEnOtros, items };
  }

  /** El numerito rojo. */
  contarSinLeer(usuarioId: string, conjuntoId: string) {
    return this.prisma.notificacion.count({
      where: { usuarioId, conjuntoId, leidaEn: null, programadaPara: { lte: new Date() } },
    });
  }

  async marcarLeida(usuarioId: string, id: string) {
    const aviso = await this.prisma.notificacion.findFirst({ where: { id, usuarioId } });
    if (!aviso) throw new NotFoundException('Esa notificacion no es tuya o no existe');
    if (aviso.leidaEn) return aviso;
    return this.prisma.notificacion.update({ where: { id }, data: { leidaEn: new Date() } });
  }

  async marcarTodasLeidas(usuarioId: string, conjuntoId: string) {
    const { count } = await this.prisma.notificacion.updateMany({
      where: { usuarioId, conjuntoId, leidaEn: null, programadaPara: { lte: new Date() } },
      data: { leidaEn: new Date() },
    });
    return { marcadas: count };
  }

  // --- lo que llaman los demas modulos --------------------------------------

  /**
   * Crea el aviso para todos los que correspondan.
   *
   * NUNCA lanza. Un aviso que falla no puede tumbar la operacion que lo
   * provoco: la encomienda ya se recibio, el paquete esta detras del mostrador,
   * y que el sistema no haya podido avisar es un problema menor que hacer
   * rollback de eso. Falla en el log, no en la cara del portero.
   */
  async avisar(aviso: Aviso): Promise<number> {
    try {
      const destinatarios = await this.aQuien.resolver(aviso.conjuntoId, aviso.para);
      const finales = destinatarios.filter((id) => id !== aviso.excepto);
      if (finales.length === 0) return 0;

      const { count } = await this.prisma.notificacion.createMany({
        data: finales.map((usuarioId) => ({
          conjuntoId: aviso.conjuntoId,
          usuarioId,
          tipo: aviso.tipo,
          titulo: aviso.titulo,
          cuerpo: aviso.cuerpo ?? null,
          entidad: aviso.entidad ?? null,
          entidadId: aviso.entidadId ?? null,
          ...(aviso.programadaPara ? { programadaPara: aviso.programadaPara } : {}),
        })),
      });
      return count;
    } catch (error) {
      this.logger.error(
        `No se pudo avisar (${aviso.tipo}): ${error instanceof Error ? error.message : error}`,
      );
      return 0;
    }
  }

  /**
   * Cancela un aviso que todavia no se ha visto.
   *
   * Es el unico borrado de esta tabla, y esta bien que lo sea: si cancelan la
   * reserva de manana, el recordatorio programado para las 7am nunca ocurrio. No
   * hay nada que conservar — no se "cierra" un aviso que nadie leyo.
   */
  async cancelarProgramados(entidad: string, entidadId: string, tipo?: TipoNotificacion) {
    try {
      const { count } = await this.prisma.notificacion.deleteMany({
        where: {
          entidad,
          entidadId,
          ...(tipo ? { tipo } : {}),
          programadaPara: { gt: new Date() },
        },
      });
      return count;
    } catch (error) {
      this.logger.error(`No se pudo cancelar el aviso programado: ${error}`);
      return 0;
    }
  }
}
