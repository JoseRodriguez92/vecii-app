import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { misUnidades } from '../../common/mis-unidades.js';
import { PERMISOS } from '../../common/permisos.js';
import { TipoNotificacion } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import type { AnularPagoDto, RegistrarPagoDto } from './dto/pago.dto.js';
import { imputar } from './reglas-imputacion.js';
import { calcularSaldo } from './saldo.js';

/** Una imputacion de un pago anulado no cuenta: esa plata no existio. */
const VIGENTES = { pago: { anuladoEn: null } };

/**
 * La plata que entra, y a que deudas se aplica.
 *
 * Vecii **registra, no recauda**: la plata va a la cuenta del conjunto y aqui se
 * anota. Cuando exista pasarela sera la misma fila, creada por un webhook en vez
 * de por el administrador (ver `pasarela.ts` y ADR-0008).
 *
 * A que deuda se aplica lo decide `reglas-imputacion.ts`, que es puro: la cuenta
 * mas vieja primero.
 */
@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: NotificacionesService,
  ) {}

  /**
   * Registra el pago y lo aplica, en una sola transaccion.
   *
   * Si el pago se guarda y la imputacion falla, queda plata que entro sin
   * aplicarse a nada: el residente pago y el sistema sigue diciendo que debe.
   */
  async registrar(conjuntoId: string, autorId: string, dto: RegistrarPagoDto) {
    const recibidoEn = new Date(dto.recibidoEn);
    if (Number.isNaN(recibidoEn.getTime())) throw new BadRequestException('Fecha invalida');

    const unidad = await this.prisma.unidad.findFirst({
      where: { id: dto.unidadId, conjuntoId },
      select: { id: true },
    });
    if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');

    const pendientes = await this.cuentasConSaldo(conjuntoId, dto.unidadId);
    const { aplicaciones, sobrante } = imputar(dto.valor, pendientes);

    const pago = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.pago.create({
        data: {
          conjuntoId,
          unidadId: dto.unidadId,
          valor: dto.valor,
          recibidoEn,
          medio: dto.medio,
          referencia: dto.referencia ?? null,
          // Null cuando entre por pasarela: ahi no lo digita nadie.
          registradoPorId: autorId,
        },
      });

      if (aplicaciones.length > 0) {
        await tx.imputacion.createMany({
          data: aplicaciones.map((a) => ({
            conjuntoId,
            pagoId: creado.id,
            cuentaId: a.cuentaId,
            valor: a.valor,
          })),
        });
      }

      return creado;
    });

    await this.avisos.avisar({
      conjuntoId,
      tipo: TipoNotificacion.PAGO_REGISTRADO,
      titulo: `Recibimos tu pago de $${dto.valor.toLocaleString('es-CO')}`,
      cuerpo: sobrante > 0 ? `Te queda $${sobrante.toLocaleString('es-CO')} a favor` : undefined,
      entidad: 'pago',
      entidadId: pago.id,
      excepto: autorId,
      para: { unidad: dto.unidadId },
    });

    return { ...pago, aplicado: dto.valor - sobrante, sobrante, cuentasCubiertas: aplicaciones.length };
  }

  /**
   * El cheque reboto, o se digito mal.
   *
   * No se borra: el pago existio y quedar sin rastro de el es peor que tenerlo
   * anulado. Las imputaciones tampoco se borran — dejan de contar solas, porque
   * el saldo solo mira las de pagos vigentes.
   */
  async anular(conjuntoId: string, id: string, dto: AnularPagoDto) {
    const pago = await this.prisma.pago.findFirst({ where: { id, conjuntoId } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (pago.anuladoEn) throw new BadRequestException('Ese pago ya estaba anulado');

    return this.prisma.pago.update({
      where: { id },
      data: { anuladoEn: new Date(), motivoAnulacion: dto.motivo },
    });
  }

  listar(conjuntoId: string, f: { unidadId?: string; incluirAnulados?: boolean } = {}) {
    return this.prisma.pago.findMany({
      where: {
        conjuntoId,
        ...(f.unidadId ? { unidadId: f.unidadId } : {}),
        ...(f.incluirAnulados ? {} : { anuladoEn: null }),
      },
      orderBy: { recibidoEn: 'desc' },
      include: {
        unidad: { select: { id: true, identificador: true } },
        imputaciones: { select: { valor: true, cuenta: { select: { id: true, periodo: true } } } },
      },
    });
  }

  /**
   * Un pago solo, el que abre el aviso de la campanita.
   *
   * Misma regla que en el resto: quien administra ve cualquiera, el residente
   * los de sus unidades. 404 y no 403 cuando no lo puede ver.
   */
  async obtener(activo: ConjuntoActivo, usuarioId: string, id: string) {
    const veTodoElConjunto = activo.permisos.has(PERMISOS.FINANZAS_LEER);

    const pago = await this.prisma.pago.findFirst({
      where: {
        id,
        conjuntoId: activo.conjuntoId,
        ...(veTodoElConjunto
          ? {}
          : { unidadId: { in: await misUnidades(this.prisma, activo.conjuntoId, usuarioId) } }),
      },
      include: {
        unidad: { select: { id: true, identificador: true } },
        imputaciones: { select: { valor: true, cuenta: { select: { id: true, periodo: true } } } },
      },
    });

    if (!pago) throw new NotFoundException('Pago no encontrado');
    return pago;
  }

  /**
   * Lo que la unidad debe hoy, cuenta por cuenta.
   *
   * Solo las emitidas: un borrador todavia lo esta revisando la administracion y
   * cobrarle contra el seria cobrarle algo que no ha visto.
   */
  private async cuentasConSaldo(conjuntoId: string, unidadId: string) {
    const cuentas = await this.prisma.cuentaCobro.findMany({
      where: { conjuntoId, unidadId, emitidaEn: { not: null } },
      select: {
        id: true,
        periodo: true,
        cobros: { select: { valor: true, concepto: { select: { naturaleza: true } } } },
        imputaciones: { where: VIGENTES, select: { valor: true } },
      },
    });

    return cuentas.map((c) => ({
      cuentaId: c.id,
      periodo: c.periodo,
      saldo: calcularSaldo(
        c.cobros.map((x) => ({ valor: x.valor.toNumber(), naturaleza: x.concepto.naturaleza })),
        c.imputaciones.reduce((t, i) => t + i.valor.toNumber(), 0),
      ).saldo,
    }));
  }
}
