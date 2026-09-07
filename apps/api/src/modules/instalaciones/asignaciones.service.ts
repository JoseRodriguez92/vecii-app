import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CerrarAsignacionDto, CrearAsignacionDto } from './dto/asignacion.dto.js';
import { ParqueaderosService } from './parqueaderos.service.js';
import { razonDeRechazo } from './reglas-parqueadero.js';

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parqueaderos: ParqueaderosService,
  ) {}

  /**
   * El historial del cupo. Completo por defecto: la pregunta que llega de verdad
   * es "de quien era este puesto el ano pasado", y por eso cerrar no borra.
   */
  async listar(conjuntoId: string, parqueaderoId: string, soloVigentes = false) {
    await this.parqueaderos.exigir(conjuntoId, parqueaderoId);
    return this.prisma.asignacionParqueadero.findMany({
      where: { parqueaderoId, ...(soloVigentes ? { hasta: null } : {}) },
      orderBy: { desde: 'desc' },
      include: { unidad: { select: { id: true, identificador: true } } },
    });
  }

  async asignar(conjuntoId: string, parqueaderoId: string, dto: CrearAsignacionDto) {
    const cupo = await this.parqueaderos.exigir(conjuntoId, parqueaderoId);

    // La regla del dominio, en una linea. Vive en reglas-parqueadero.ts y esta
    // probada aparte, sin base de datos.
    const razon = razonDeRechazo(cupo.naturaleza, dto.origen);
    if (razon) throw new BadRequestException(razon);

    const unidad = await this.prisma.unidad.findFirst({
      where: { id: dto.unidadId, conjuntoId },
      select: { id: true, identificador: true },
    });
    if (!unidad) throw new BadRequestException('Esa unidad no existe en este conjunto');

    // Un cupo se usa de a uno. Si ya hay alguien, hay que cerrarlo primero:
    // solaparlos dejaria dos apartamentos con derecho al mismo puesto y ninguna
    // forma de saber cual manda.
    const vigente = await this.prisma.asignacionParqueadero.findFirst({
      where: { parqueaderoId, hasta: null },
      include: { unidad: { select: { identificador: true } } },
    });
    if (vigente) {
      throw new BadRequestException(
        `El cupo "${cupo.identificador}" ya esta asignado a la unidad ` +
          `"${vigente.unidad.identificador}". Cierra esa asignacion antes de crear otra.`,
      );
    }

    return this.prisma.asignacionParqueadero.create({
      data: {
        parqueaderoId,
        unidadId: dto.unidadId,
        origen: dto.origen,
        ...(dto.desde ? { desde: new Date(dto.desde) } : {}),
        observacion: dto.observacion,
      },
      include: { unidad: { select: { id: true, identificador: true } } },
    });
  }

  /**
   * Cerrar no es borrar. La fila se queda con su `hasta`, que es lo que
   * responde "ese cupo era mio hasta diciembre".
   */
  async cerrar(
    conjuntoId: string,
    parqueaderoId: string,
    asignacionId: string,
    dto: CerrarAsignacionDto,
  ) {
    await this.parqueaderos.exigir(conjuntoId, parqueaderoId);

    const asignacion = await this.prisma.asignacionParqueadero.findFirst({
      where: { id: asignacionId, parqueaderoId },
    });
    if (!asignacion) {
      throw new NotFoundException('Esa asignacion no existe en este parqueadero');
    }
    if (asignacion.hasta) {
      throw new BadRequestException(
        `Esa asignacion ya se cerro el ${asignacion.hasta.toISOString().slice(0, 10)}`,
      );
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : new Date();
    if (hasta < asignacion.desde) {
      throw new BadRequestException('La fecha de cierre es anterior a la de inicio');
    }

    return this.prisma.asignacionParqueadero.update({
      where: { id: asignacionId },
      data: { hasta, ...(dto.observacion ? { observacion: dto.observacion } : {}) },
      include: { unidad: { select: { id: true, identificador: true } } },
    });
  }
}
