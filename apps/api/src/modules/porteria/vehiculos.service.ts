import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PERMISOS } from '../../common/permisos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizarPlaca } from '../../common/placa.js';
import { CON_CONTEXTO, exigirAlcance, exigirPropietario, misUnidades, vigentes } from './registros.js';
import type { ActualizarVehiculoDto, RegistrarVehiculoDto } from './dto/vehiculo.dto.js';

const NO_PUEDE = 'Solo puedes registrar vehiculos en una unidad tuya';

@Injectable()
export class VehiculosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lo que consulta porteria. `placa` busca por coincidencia parcial porque en
   * la puerta se alcanzan a leer tres letras, no siempre las seis.
   */
  listar(
    conjuntoId: string,
    opciones: { unidadId?: string; placa?: string; incluirRetirados?: boolean } = {},
  ) {
    return this.prisma.vehiculo.findMany({
      where: {
        conjuntoId,
        ...(opciones.unidadId ? { unidadId: opciones.unidadId } : {}),
        ...(opciones.placa ? { placa: { contains: normalizarPlaca(opciones.placa) } } : {}),
        ...(opciones.incluirRetirados ? {} : vigentes()),
      },
      orderBy: [{ placa: 'asc' }],
      include: CON_CONTEXTO,
    });
  }

  /** Los de las unidades donde vive quien pregunta. */
  async mios(conjuntoId: string, usuarioId: string, incluirRetirados = false) {
    const unidadIds = await misUnidades(this.prisma, conjuntoId, usuarioId);
    return this.prisma.vehiculo.findMany({
      where: {
        conjuntoId,
        unidadId: { in: unidadIds },
        ...(incluirRetirados ? {} : vigentes()),
      },
      orderBy: [{ placa: 'asc' }],
      include: CON_CONTEXTO,
    });
  }

  async registrar(activo: ConjuntoActivo, autorId: string, dto: RegistrarVehiculoDto) {
    await exigirAlcance(
      this.prisma,
      activo,
      autorId,
      dto.unidadId,
      PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
      NO_PUEDE,
    );
    const placa = normalizarPlaca(dto.placa);
    await this.exigirPlacaLibre(activo.conjuntoId, placa);
    await exigirPropietario(this.prisma, activo.conjuntoId, dto.propietarioId);

    return this.prisma.vehiculo.create({
      data: {
        conjuntoId: activo.conjuntoId,
        unidadId: dto.unidadId,
        tipo: dto.tipo,
        placa,
        marca: dto.marca ?? null,
        color: dto.color ?? null,
        propietarioId: dto.propietarioId ?? null,
        observacion: dto.observacion ?? null,
        ...(dto.desde ? { desde: new Date(dto.desde) } : {}),
      },
      include: CON_CONTEXTO,
    });
  }

  async actualizar(
    activo: ConjuntoActivo,
    autorId: string,
    id: string,
    dto: ActualizarVehiculoDto,
  ) {
    const vehiculo = await this.obtener(activo.conjuntoId, id);
    await exigirAlcance(
      this.prisma,
      activo,
      autorId,
      vehiculo.unidadId,
      PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
      NO_PUEDE,
    );

    const placa = dto.placa ? normalizarPlaca(dto.placa) : undefined;
    if (placa && placa !== vehiculo.placa) {
      await this.exigirPlacaLibre(activo.conjuntoId, placa);
    }
    if (dto.propietarioId !== undefined) {
      await exigirPropietario(this.prisma, activo.conjuntoId, dto.propietarioId);
    }

    return this.prisma.vehiculo.update({
      where: { id },
      data: {
        ...(placa ? { placa } : {}),
        ...(dto.tipo ? { tipo: dto.tipo } : {}),
        ...(dto.marca !== undefined ? { marca: dto.marca ?? null } : {}),
        ...(dto.color !== undefined ? { color: dto.color ?? null } : {}),
        ...(dto.propietarioId !== undefined
          ? { propietarioId: dto.propietarioId ?? null }
          : {}),
        ...(dto.observacion !== undefined ? { observacion: dto.observacion ?? null } : {}),
      },
      include: CON_CONTEXTO,
    });
  }

  /**
   * Da de baja el vehiculo. NO borra la fila: le pone `hasta`.
   *
   * Se vendio el carro, se mudaron. La fila se queda porque la pregunta que
   * llega es "de quien era la ABC123 en marzo", y esa se hace justo cuando algo
   * paso en el parqueadero.
   */
  async darDeBaja(activo: ConjuntoActivo, autorId: string, id: string) {
    const vehiculo = await this.obtener(activo.conjuntoId, id);
    await exigirAlcance(
      this.prisma,
      activo,
      autorId,
      vehiculo.unidadId,
      PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
      NO_PUEDE,
    );
    if (vehiculo.hasta && vehiculo.hasta <= new Date()) {
      throw new BadRequestException('Ese vehiculo ya estaba dado de baja');
    }
    return this.prisma.vehiculo.update({ where: { id }, data: { hasta: new Date() } });
  }

  private async obtener(conjuntoId: string, id: string) {
    const vehiculo = await this.prisma.vehiculo.findFirst({ where: { id, conjuntoId } });
    if (!vehiculo) throw new NotFoundException('Ese vehiculo no existe en este conjunto');
    return vehiculo;
  }

  /**
   * Una placa vigente por conjunto. Dos filas abiertas con la misma placa
   * dejarian a porteria sin saber a cual unidad avisarle.
   *
   * Se mira solo entre las vigentes a proposito: el 501 le vende el carro al
   * 302, y las dos filas tienen que poder existir — una cerrada y una abierta.
   */
  private async exigirPlacaLibre(conjuntoId: string, placa: string) {
    const ocupada = await this.prisma.vehiculo.findFirst({
      where: { conjuntoId, placa, hasta: null },
      include: { unidad: { select: { identificador: true } } },
    });
    if (ocupada) {
      throw new BadRequestException(
        `La placa ${placa} ya esta registrada en la unidad "${ocupada.unidad.identificador}". ` +
          'Si el vehiculo cambio de dueno, dale de baja alla primero.',
      );
    }
  }
}
