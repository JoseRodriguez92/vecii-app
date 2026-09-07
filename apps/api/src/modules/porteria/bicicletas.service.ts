import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PERMISOS } from '../../common/permisos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CON_CONTEXTO, exigirAlcance, exigirPropietario, misUnidades, vigentes } from './registros.js';
import type { ActualizarBicicletaDto, RegistrarBicicletaDto } from './dto/bicicleta.dto.js';

const NO_PUEDE = 'Solo puedes registrar bicicletas en una unidad tuya';

@Injectable()
export class BicicletasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    conjuntoId: string,
    opciones: { unidadId?: string; serial?: string; incluirRetiradas?: boolean } = {},
  ) {
    return this.prisma.bicicleta.findMany({
      where: {
        conjuntoId,
        ...(opciones.unidadId ? { unidadId: opciones.unidadId } : {}),
        ...(opciones.serial ? { serial: { contains: opciones.serial, mode: 'insensitive' } } : {}),
        ...(opciones.incluirRetiradas ? {} : vigentes()),
      },
      orderBy: [{ descripcion: 'asc' }],
      include: CON_CONTEXTO,
    });
  }

  async mias(conjuntoId: string, usuarioId: string, incluirRetiradas = false) {
    const unidadIds = await misUnidades(this.prisma, conjuntoId, usuarioId);
    return this.prisma.bicicleta.findMany({
      where: {
        conjuntoId,
        unidadId: { in: unidadIds },
        ...(incluirRetiradas ? {} : vigentes()),
      },
      orderBy: [{ descripcion: 'asc' }],
      include: CON_CONTEXTO,
    });
  }

  async registrar(activo: ConjuntoActivo, autorId: string, dto: RegistrarBicicletaDto) {
    await exigirAlcance(
      this.prisma,
      activo,
      autorId,
      dto.unidadId,
      PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
      NO_PUEDE,
    );
    await this.exigirSerialLibre(activo.conjuntoId, dto.serial);
    await exigirPropietario(this.prisma, activo.conjuntoId, dto.propietarioId);

    return this.prisma.bicicleta.create({
      data: {
        conjuntoId: activo.conjuntoId,
        unidadId: dto.unidadId,
        descripcion: dto.descripcion,
        serial: dto.serial ?? null,
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
    dto: ActualizarBicicletaDto,
  ) {
    const bicicleta = await this.obtener(activo.conjuntoId, id);
    await exigirAlcance(
      this.prisma,
      activo,
      autorId,
      bicicleta.unidadId,
      PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
      NO_PUEDE,
    );
    if (dto.serial && dto.serial !== bicicleta.serial) {
      await this.exigirSerialLibre(activo.conjuntoId, dto.serial);
    }
    if (dto.propietarioId !== undefined) {
      await exigirPropietario(this.prisma, activo.conjuntoId, dto.propietarioId);
    }

    return this.prisma.bicicleta.update({
      where: { id },
      data: {
        ...(dto.descripcion ? { descripcion: dto.descripcion } : {}),
        ...(dto.serial !== undefined ? { serial: dto.serial ?? null } : {}),
        ...(dto.marca !== undefined ? { marca: dto.marca ?? null } : {}),
        ...(dto.color !== undefined ? { color: dto.color ?? null } : {}),
        ...(dto.propietarioId !== undefined ? { propietarioId: dto.propietarioId ?? null } : {}),
        ...(dto.observacion !== undefined ? { observacion: dto.observacion ?? null } : {}),
      },
      include: CON_CONTEXTO,
    });
  }

  /** Se la robaron, la vendieron, se mudaron. La fila se queda con su `hasta`. */
  async darDeBaja(activo: ConjuntoActivo, autorId: string, id: string) {
    const bicicleta = await this.obtener(activo.conjuntoId, id);
    await exigirAlcance(
      this.prisma,
      activo,
      autorId,
      bicicleta.unidadId,
      PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
      NO_PUEDE,
    );
    if (bicicleta.hasta && bicicleta.hasta <= new Date()) {
      throw new BadRequestException('Esa bicicleta ya estaba dada de baja');
    }
    return this.prisma.bicicleta.update({ where: { id }, data: { hasta: new Date() } });
  }

  private async obtener(conjuntoId: string, id: string) {
    const bicicleta = await this.prisma.bicicleta.findFirst({ where: { id, conjuntoId } });
    if (!bicicleta) throw new NotFoundException('Esa bicicleta no existe en este conjunto');
    return bicicleta;
  }

  /**
   * Dos bicicletas vigentes no pueden compartir serial: el serial es unico en el
   * mundo, asi que repetirlo es un error de digitacion o una bicicleta registrada
   * dos veces. Solo aplica cuando viene, que es la mitad de las veces.
   */
  private async exigirSerialLibre(conjuntoId: string, serial?: string | null) {
    if (!serial) return;
    const repetido = await this.prisma.bicicleta.findFirst({
      where: { conjuntoId, serial, hasta: null },
      include: { unidad: { select: { identificador: true } } },
    });
    if (repetido) {
      throw new BadRequestException(
        `Ese serial ya esta registrado en la unidad "${repetido.unidad.identificador}"`,
      );
    }
  }
}
