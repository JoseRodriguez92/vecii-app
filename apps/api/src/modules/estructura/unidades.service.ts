import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { categoriaDe } from './categoria-unidad.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarUnidadDto, CrearUnidadDto } from './dto/unidad.dto.js';

/** Lo que devuelve el chequeo de salud de los coeficientes. */
export interface SaludCoeficientes {
  totalUnidades: number;
  sinCoeficiente: number;
  sumaCoeficientes: number;
  /** Si suma 100% (con tolerancia por redondeo) y no falta ninguno. */
  correcto: boolean;
  observaciones: string[];
}

/**
 * Tolerancia al comparar la suma con 1. Con 500 unidades de seis decimales, el
 * redondeo del reglamento rara vez da exactamente 1.000000.
 */
const TOLERANCIA = 0.0001;

@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  listar(conjuntoId: string, agrupacionId?: string) {
    return this.prisma.unidad.findMany({
      where: { conjuntoId, ...(agrupacionId ? { agrupacionId } : {}) },
      orderBy: [{ agrupacionId: 'asc' }, { identificador: 'asc' }],
      include: {
        agrupacion: { select: { id: true, nombre: true, tipo: true } },
        tipologia: { select: { id: true, nombre: true, areaM2: true } },
      },
    });
  }

  async obtener(conjuntoId: string, id: string) {
    const unidad = await this.prisma.unidad.findFirst({
      where: { id, conjuntoId },
      include: {
        agrupacion: { select: { id: true, nombre: true, tipo: true } },
        tipologia: true,
        /// Con cual se vendio, y cuales se vendieron con ella.
        unidadPrincipal: { select: { id: true, identificador: true, tipo: true } },
        accesorias: { select: { id: true, identificador: true, tipo: true } },
        usuarios: {
          where: { OR: [{ hasta: null }, { hasta: { gt: new Date() } }] },
          select: {
            relacion: true,
            principal: true,
            usuario: { select: { id: true, nombres: true, apellidos: true } },
          },
        },
      },
    });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    return { ...unidad, categoria: categoriaDe(unidad.tipo) };
  }

  async crear(conjuntoId: string, dto: CrearUnidadDto) {
    await this.validarPrincipal(conjuntoId, dto.unidadPrincipalId);
    return this.prisma.unidad.create({ data: { ...dto, conjuntoId } });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarUnidadDto) {
    await this.obtener(conjuntoId, id);
    await this.validarPrincipal(conjuntoId, dto.unidadPrincipalId, id);
    return this.prisma.unidad.update({ where: { id }, data: dto });
  }

  /**
   * La unidad principal existe, es de este conjunto, no es ella misma, y no es
   * a su vez accesoria de otra.
   *
   * Lo del nivel unico no es purismo: en una cadena —el deposito cuelga del
   * parqueadero, que cuelga del apartamento— la pregunta "con que se vendio esto"
   * deja de tener una respuesta, y de esa respuesta salen el recibo unico y el
   * cambio de dueno al vender.
   *
   * Que sea del mismo conjunto ya lo impide la FK compuesta, y que no sea ella
   * misma lo impide un CHECK; se validan igual para que el error salga como un
   * 400 con nombre propio y no como el 500 de una llave foranea.
   */
  private async validarPrincipal(conjuntoId: string, principalId?: string, idActual?: string) {
    if (!principalId) return;
    if (principalId === idActual) {
      throw new BadRequestException('Una unidad no se vende consigo misma');
    }
    const principal = await this.prisma.unidad.findFirst({
      where: { id: principalId, conjuntoId },
      select: { id: true, identificador: true, unidadPrincipalId: true },
    });
    if (!principal) {
      throw new BadRequestException('Esa unidad principal no existe en este conjunto');
    }
    if (principal.unidadPrincipalId) {
      throw new BadRequestException(
        `La unidad "${principal.identificador}" ya es accesoria de otra. Apunta a la principal ` +
          'directamente: las accesorias van en un solo nivel.',
      );
    }
  }

  async eliminar(conjuntoId: string, id: string) {
    await this.obtener(conjuntoId, id);
    await this.prisma.unidad.delete({ where: { id } });
  }

  /**
   * Carga masiva. Ningun administrador va a crear 200 unidades una por una.
   *
   * Todo en UNA transaccion: si la fila 150 esta mala, no entra ninguna. Un
   * conjunto a medio cargar es peor que uno vacio, porque parece completo —y con
   * coeficientes incompletos la facturacion sale mal sin que nadie lo note.
   */
  async importar(conjuntoId: string, unidades: CrearUnidadDto[]) {
    const identificadores = unidades.map((u) => `${u.agrupacionId ?? '-'}/${u.identificador}`);
    const repetidos = identificadores.filter((v, i) => identificadores.indexOf(v) !== i);
    if (repetidos.length > 0) {
      throw new BadRequestException(
        `El archivo trae identificadores repetidos dentro de la misma agrupacion: ` +
          [...new Set(repetidos)].join(', '),
      );
    }

    const creadas = await this.prisma.$transaction(
      unidades.map((dto) => this.prisma.unidad.create({ data: { ...dto, conjuntoId } })),
    );

    return { creadas: creadas.length, salud: await this.saludCoeficientes(conjuntoId) };
  }

  /**
   * Los coeficientes de un conjunto deben sumar 100%. No se puede garantizar con
   * una restriccion de base de datos porque cruza filas, asi que se reporta.
   *
   * Y no es un detalle contable: de esa suma dependen las cuotas Y las mayorias
   * calificadas de la asamblea, que se calculan sobre el TOTAL del conjunto. Con
   * el denominador mal, una votacion del 70% sale mal.
   */
  async saludCoeficientes(conjuntoId: string): Promise<SaludCoeficientes> {
    const unidades = await this.prisma.unidad.findMany({
      where: { conjuntoId },
      select: { coeficiente: true, tipo: true },
    });

    const sinCoeficiente = unidades.filter((u) => u.coeficiente === null).length;
    const suma = unidades.reduce((acc, u) => acc + (u.coeficiente ? Number(u.coeficiente) : 0), 0);

    const observaciones: string[] = [];
    if (unidades.length === 0) {
      observaciones.push('El conjunto no tiene unidades cargadas.');
    }
    if (sinCoeficiente > 0) {
      observaciones.push(
        `${sinCoeficiente} unidad(es) sin coeficiente. No se puede facturar ni votar ` +
          'hasta cargarlos: falta el denominador.',
      );
    }
    if (unidades.length > 0 && Math.abs(suma - 1) > TOLERANCIA) {
      const pct = (suma * 100).toFixed(4);
      observaciones.push(
        `Los coeficientes suman ${pct}% en vez de 100%. ` +
          (suma < 1
            ? 'El conjunto recaudaria menos de lo presupuestado todos los meses.'
            : 'Se cobraria mas de lo presupuestado.'),
      );
    }

    // Aviso legal derivado: el consejo es obligatorio con mas de 30 unidades
    // privadas, EXCLUYENDO parqueaderos y depositos (Ley 675, arts. 53-55).
    const privadasSinAccesorias = unidades.filter(
      (u) => categoriaDe(u.tipo) !== 'ACCESORIA',
    ).length;
    if (privadasSinAccesorias > 30) {
      observaciones.push(
        `El conjunto tiene ${privadasSinAccesorias} unidades privadas (sin contar ` +
          'parqueaderos ni depositos). La Ley 675 exige consejo de administracion.',
      );
    }

    return {
      totalUnidades: unidades.length,
      sinCoeficiente,
      sumaCoeficientes: Number(suma.toFixed(6)),
      correcto: sinCoeficiente === 0 && unidades.length > 0 && Math.abs(suma - 1) <= TOLERANCIA,
      observaciones,
    };
  }
}
