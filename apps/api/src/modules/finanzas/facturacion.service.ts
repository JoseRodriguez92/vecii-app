import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CodigoConcepto, TipoNotificacion } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import type { EmitirFacturacionDto, GenerarFacturacionDto } from './dto/facturacion.dto.js';
import { type Participacion, problemaAlRepartir, repartir } from './reglas-reparto.js';

/**
 * La facturacion del mes: generarla y emitirla.
 *
 * Son DOS actos y por eso son dos metodos. Generar calcula y deja borradores que
 * nadie ve; emitir se los muestra al residente y arranca el plazo. En el medio
 * el administrador revisa —la cuota subio porque subio el presupuesto, este dato
 * quedo mal— y puede volver a generar sin consecuencias.
 *
 * No hay tarea programada que emita sola: facturarle a mil conjuntos a
 * medianoche es cobrarle mal a mucha gente al mismo tiempo y enterarse al otro
 * dia. Es un acto administrativo, y alguien tiene que mirar antes.
 */
@Injectable()
export class FacturacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: NotificacionesService,
  ) {}

  /**
   * Calcula el mes y deja las cuentas en BORRADOR. No le avisa a nadie.
   *
   * Se puede correr las veces que haga falta mientras nadie las haya emitido:
   * cada corrida reemplaza los cobros de administracion, no los suma. Lo que ya
   * se emitio no se toca — ahi afuera hay gente que ya vio esa cuenta.
   */
  async generar(conjuntoId: string, dto: GenerarFacturacionDto) {
    const periodo = primerDiaDelMes(dto.periodo);
    const concepto = await this.conceptoDelSistema(conjuntoId, CodigoConcepto.ADMINISTRACION);
    const principales = await this.unidadesQueRecibenCuenta(conjuntoId);

    // Se reparte entre TODAS las unidades con coeficiente —accesorias incluidas—
    // porque cada una tiene el suyo en el reglamento. Lo que se agrupa despues es
    // el recibo, no el reparto.
    const participaciones: Participacion[] = principales.flatMap((u) => [
      { unidadId: u.id, identificador: u.identificador, fraccion: aNumero(u.coeficiente) },
      ...u.accesorias.map((a) => ({
        unidadId: a.id,
        identificador: a.identificador,
        fraccion: aNumero(a.coeficiente),
      })),
    ]);

    const problema = problemaAlRepartir(dto.valorARepartir, participaciones);
    if (problema) throw new BadRequestException(problema);

    const porUnidad = new Map(repartir(dto.valorARepartir, participaciones).map((r) => [r.unidadId, r]));

    return this.prisma.$transaction(async (tx) => {
      let cuentas = 0;
      let omitidas = 0;

      for (const principal of principales) {
        const cuenta = await tx.cuentaCobro.upsert({
          where: { unidadId_periodo: { unidadId: principal.id, periodo } },
          create: { conjuntoId, unidadId: principal.id, periodo },
          update: {},
        });

        // Ya se la mostraron al residente: no se recalcula por debajo.
        if (cuenta.emitidaEn) {
          omitidas += 1;
          continue;
        }

        // Solo los de administracion. Una multa o el alquiler del salon los puso
        // una persona y no los borra un recalculo.
        await tx.cobro.deleteMany({ where: { cuentaId: cuenta.id, conceptoId: concepto.id } });

        await tx.cobro.createMany({
          data: [principal, ...principal.accesorias].map((u) => ({
            conjuntoId,
            cuentaId: cuenta.id,
            conceptoId: concepto.id,
            valor: porUnidad.get(u.id)?.valor ?? 0,
            // Una linea por unidad: cuando llamen preguntando por que pagan mas
            // que el vecino, el recibo se explica solo.
            detalle: u.identificador,
          })),
        });

        cuentas += 1;
      }

      return { periodo, cuentas, omitidas, unidadesRepartidas: participaciones.length };
    });
  }

  /**
   * Muestra el mes: pone fecha de emision y de vencimiento, y avisa.
   *
   * Desde aqui la cuenta existe para el residente y corre el plazo. Volver a
   * generar ya no la toca.
   */
  async emitir(conjuntoId: string, periodoTexto: string, dto: EmitirFacturacionDto) {
    const periodo = primerDiaDelMes(periodoTexto);
    const venceEl = new Date(dto.venceEl);
    if (Number.isNaN(venceEl.getTime())) throw new BadRequestException('Fecha de vencimiento invalida');

    const borradores = await this.prisma.cuentaCobro.findMany({
      where: { conjuntoId, periodo, emitidaEn: null },
      select: { id: true, unidadId: true },
    });

    if (borradores.length === 0) {
      throw new NotFoundException(
        'No hay cuentas en borrador para ese periodo. Generala primero, o ya se emitio.',
      );
    }

    const emitidaEn = new Date();
    await this.prisma.cuentaCobro.updateMany({
      where: { id: { in: borradores.map((b) => b.id) } },
      data: { emitidaEn, venceEl },
    });

    if (dto.avisar !== false) {
      for (const cuenta of borradores) {
        await this.avisos.avisar({
          conjuntoId,
          tipo: TipoNotificacion.CUENTA_EMITIDA,
          titulo: 'Ya esta tu cuenta de administracion',
          cuerpo: `Vence el ${venceEl.toLocaleDateString('es-CO')}`,
          entidad: 'cuenta',
          entidadId: cuenta.id,
          para: { unidad: cuenta.unidadId },
        });
      }
    }

    return { periodo, emitidas: borradores.length, venceEl };
  }

  // --- las piezas ------------------------------------------------------------

  /**
   * A quien se le emite: solo las unidades PRINCIPALES, con sus accesorias
   * colgadas.
   *
   * Comprar el 501 es comprar tres unidades, pero llega un recibo. Si aqui se
   * recorrieran todas, a esa familia le llegarian tres.
   */
  private unidadesQueRecibenCuenta(conjuntoId: string) {
    return this.prisma.unidad.findMany({
      where: { conjuntoId, unidadPrincipalId: null },
      select: {
        id: true,
        identificador: true,
        coeficiente: true,
        accesorias: { select: { id: true, identificador: true, coeficiente: true } },
      },
      orderBy: { identificador: 'asc' },
    });
  }

  private async conceptoDelSistema(conjuntoId: string, codigo: CodigoConcepto) {
    const concepto = await this.prisma.conceptoCobro.findFirst({
      where: { conjuntoId, codigo },
      select: { id: true },
    });
    if (!concepto) {
      throw new NotFoundException(
        `Este conjunto no tiene el concepto ${codigo}. Se siembra al crearlo: si falta, algo se borro a mano.`,
      );
    }
    return concepto;
  }
}

/** El periodo es un mes. Se guarda el dia 1 para que dos corridas coincidan. */
function primerDiaDelMes(texto: string): Date {
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) throw new BadRequestException('Periodo invalido');
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

/** Prisma entrega Decimal; el reparto trabaja en numeros. Null sigue siendo null. */
function aNumero(d: { toNumber(): number } | null): number | null {
  return d === null ? null : d.toNumber();
}
