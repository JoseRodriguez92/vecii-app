import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NaturalezaConcepto } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CONCEPTOS_DEL_SISTEMA } from './conceptos-del-sistema.js';
import type { ActualizarConceptoDto, CrearConceptoDto } from './dto/concepto.dto.js';

/** Los nombres que trae la plantilla. Un conjunto no puede crear otro igual. */
const NOMBRES_SEMBRADOS = new Set(CONCEPTOS_DEL_SISTEMA.map((c) => c.nombre.toLowerCase()));

/**
 * El catalogo de lo que se le puede cobrar a una unidad.
 *
 * Cada conjunto tiene el suyo: uno cobra el salon, otro la cancha de squash.
 * Los tres que siembra `conjuntos/siembra.ts` llevan `codigo` y el sistema los
 * menciona por nombre; el resto los inventa el administrador y funcionan sin
 * tocar codigo, igual que un cargo inventado.
 */
@Injectable()
export class ConceptosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(conjuntoId: string, incluirInactivos = false) {
    return this.prisma.conceptoCobro.findMany({
      where: { conjuntoId, ...(incluirInactivos ? {} : { activo: true }) },
      orderBy: [{ codigo: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crear(conjuntoId: string, dto: CrearConceptoDto) {
    if (NOMBRES_SEMBRADOS.has(dto.nombre.trim().toLowerCase())) {
      throw new BadRequestException(
        `"${dto.nombre}" es un concepto del sistema y ya existe en este conjunto. Editalo en vez de crear otro.`,
      );
    }

    return this.prisma.conceptoCobro.create({
      data: {
        conjuntoId,
        nombre: dto.nombre.trim(),
        // Sin codigo a proposito: el sistema no lo menciona por nombre, y por eso
        // el conjunto puede inventar los que quiera sin que haya que desplegar.
        naturaleza: dto.esDescuento ? NaturalezaConcepto.ABONO : NaturalezaConcepto.CARGO,
        tarifa: dto.tarifa ?? null,
      },
    });
  }

  async actualizar(conjuntoId: string, id: string, dto: ActualizarConceptoDto) {
    const concepto = await this.exigirQueExista(conjuntoId, id);

    // La base tambien lo impide (CHECK `concepto_del_sistema_no_se_apaga`), pero
    // un 409 de restriccion no explica por que: sin ADMINISTRACION la
    // facturacion mensual no tendria donde poner la cuota.
    if (concepto.codigo && dto.activo === false) {
      throw new BadRequestException(
        `"${concepto.nombre}" lo genera el sistema y no se puede desactivar.`,
      );
    }

    return this.prisma.conceptoCobro.update({
      where: { id },
      data: {
        ...(dto.nombre ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.tarifa !== undefined ? { tarifa: dto.tarifa } : {}),
        ...(dto.esDescuento !== undefined
          ? {
              naturaleza: dto.esDescuento ? NaturalezaConcepto.ABONO : NaturalezaConcepto.CARGO,
            }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  private async exigirQueExista(conjuntoId: string, id: string) {
    const concepto = await this.prisma.conceptoCobro.findFirst({ where: { id, conjuntoId } });
    if (!concepto) throw new NotFoundException('Ese concepto no existe en este conjunto');
    return concepto;
  }
}
