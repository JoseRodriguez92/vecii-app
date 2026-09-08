import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { misUnidades } from '../../common/mis-unidades.js';
import { PERMISOS } from '../../common/permisos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { calcularSaldo, estaVencida } from './saldo.js';

/** Lo que hace falta para poder calcular el saldo de una cuenta al leerla. */
const CON_SUS_CUENTAS = {
  unidad: { select: { id: true, identificador: true } },
  cobros: {
    select: {
      id: true,
      valor: true,
      detalle: true,
      concepto: { select: { id: true, nombre: true, naturaleza: true } },
    },
  },
  // Un pago anulado —un cheque que reboto— deja de contar solo. No se borran sus
  // imputaciones: el pago existio, y quedar sin rastro es peor que anulado.
  imputaciones: { where: { pago: { anuladoEn: null } }, select: { valor: true } },
} as const;

type CuentaLeida = {
  venceEl: Date | null;
  cobros: { valor: { toNumber(): number }; concepto: { naturaleza: 'CARGO' | 'ABONO' } }[];
  imputaciones: { valor: { toNumber(): number } }[];
};

/**
 * Las cuentas de cobro, para leerlas.
 *
 * Emitirlas es otra cosa y vive en `facturacion.service.ts`: alla se decide QUE
 * se cobra, aqui solo se muestra.
 *
 * El total, el saldo y si esta vencida NO salen de la fila: se calculan al leer,
 * con `saldo.ts`. Por eso todas las consultas traen los cobros y las
 * imputaciones.
 */
@Injectable()
export class CuentasService {
  constructor(private readonly prisma: PrismaService) {}

  /** La cartera del conjunto: quien debe y cuanto. */
  async listar(
    conjuntoId: string,
    f: { unidadId?: string; periodo?: Date; soloPendientes?: boolean } = {},
  ) {
    const cuentas = await this.prisma.cuentaCobro.findMany({
      where: {
        conjuntoId,
        ...(f.unidadId ? { unidadId: f.unidadId } : {}),
        ...(f.periodo ? { periodo: f.periodo } : {}),
      },
      orderBy: [{ periodo: 'desc' }, { unidadId: 'asc' }],
      include: CON_SUS_CUENTAS,
    });

    const conSaldo = cuentas.map((c) => this.conSaldo(c));
    // Se filtra despues de calcular porque "pendiente" es saldo > 0, y el saldo
    // no vive en la fila. Es el precio de no guardar conclusiones.
    return f.soloPendientes ? conSaldo.filter((c) => c.saldo > 0) : conSaldo;
  }

  /** Las de las unidades de quien pregunta. */
  async mias(conjuntoId: string, usuarioId: string) {
    const unidadIds = await misUnidades(this.prisma, conjuntoId, usuarioId);
    const cuentas = await this.prisma.cuentaCobro.findMany({
      // Un borrador no existe para el residente: todavia lo esta revisando la
      // administracion y los numeros pueden cambiar.
      where: { conjuntoId, unidadId: { in: unidadIds }, emitidaEn: { not: null } },
      orderBy: { periodo: 'desc' },
      include: CON_SUS_CUENTAS,
    });
    return cuentas.map((c) => this.conSaldo(c));
  }

  /**
   * Una cuenta, la que abre el aviso de la campanita.
   *
   * Misma regla de visibilidad que `mias`: quien administra ve cualquiera del
   * conjunto, el residente las de sus unidades. Y 404 en vez de 403, igual que
   * en encomiendas, invitados y reservas: un 403 confirmaria que el id existe.
   */
  async obtener(activo: ConjuntoActivo, usuarioId: string, id: string) {
    const veTodoElConjunto = activo.permisos.has(PERMISOS.FINANZAS_LEER);

    const cuenta = await this.prisma.cuentaCobro.findFirst({
      where: {
        id,
        conjuntoId: activo.conjuntoId,
        ...(veTodoElConjunto
          ? {}
          : {
              unidadId: { in: await misUnidades(this.prisma, activo.conjuntoId, usuarioId) },
              emitidaEn: { not: null },
            }),
      },
      include: CON_SUS_CUENTAS,
    });

    if (!cuenta) throw new NotFoundException('Cuenta de cobro no encontrada');
    return this.conSaldo(cuenta);
  }

  /** Le pega a la fila lo que no se guarda. */
  private conSaldo<T extends CuentaLeida>(cuenta: T) {
    const { total, pagado, saldo } = calcularSaldo(
      cuenta.cobros.map((c) => ({ valor: c.valor.toNumber(), naturaleza: c.concepto.naturaleza })),
      cuenta.imputaciones.reduce((t, i) => t + i.valor.toNumber(), 0),
    );
    return { ...cuenta, total, pagado, saldo, vencida: estaVencida(cuenta.venceEl, saldo) };
  }
}
