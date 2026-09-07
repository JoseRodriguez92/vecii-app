import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoEncomienda, TipoEncomienda, TipoNotificacion } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { conAncestros } from '../estructura/arbol-agrupaciones.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import type {
  DevolverDto,
  EntregarDto,
  RegistrarEncomiendaDto,
  RegistrarEncomiendaMasivaDto,
} from './dto/encomienda.dto.js';

/**
 * Como se lee cada tipo en un aviso.
 *
 * "Llego correspondencia" y no "Llego CORRESPONDENCIA": el enum es vocabulario
 * del sistema, no del residente.
 */
const ETIQUETAS: Record<TipoEncomienda, string> = {
  [TipoEncomienda.PAQUETE]: 'un paquete',
  [TipoEncomienda.CORRESPONDENCIA]: 'correspondencia',
  [TipoEncomienda.CERTIFICADO]: 'un correo certificado',
  [TipoEncomienda.OTRO]: 'algo',
};
const etiquetaDe = (tipo: TipoEncomienda) => ETIQUETAS[tipo] ?? 'algo';

/** Para donde iba y donde quedo guardada: lo que la bandeja necesita mostrar. */
const CON_DESTINO = {
  unidad: { select: { id: true, identificador: true } },
  agrupacion: { select: { id: true, nombre: true } },
  casillero: { select: { id: true, identificador: true } },
} as const;

/** Estados en los que la encomienda ya se cerro y no admite mas movimientos. */
const CERRADAS: EstadoEncomienda[] = [EstadoEncomienda.ENTREGADA, EstadoEncomienda.DEVUELTA];

@Injectable()
export class EncomiendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: NotificacionesService,
  ) {}

  /** La bandeja de porteria: todo lo del conjunto, con filtros. */
  listar(
    conjuntoId: string,
    opciones: { estado?: EstadoEncomienda; unidadId?: string; casilleroId?: string } = {},
  ) {
    return this.prisma.encomienda.findMany({
      where: {
        conjuntoId,
        ...(opciones.estado ? { estado: opciones.estado } : {}),
        ...(opciones.unidadId ? { unidadId: opciones.unidadId } : {}),
        ...(opciones.casilleroId ? { casilleroId: opciones.casilleroId } : {}),
      },
      orderBy: { recibidaEn: 'desc' },
      include: CON_DESTINO,
    });
  }

  /**
   * Lo que le ha llegado a un residente.
   *
   * Son tres cosas y no una, por como esta modelado el destino: sus encomiendas
   * propias, las de su agrupacion (y las de las agrupaciones padre, porque un
   * apartamento de la Torre B de la Etapa 2 tambien recibe lo que llego "para
   * toda la Etapa 2") y las que llegaron para el conjunto entero.
   */
  async misEntregas(conjuntoId: string, usuarioId: string) {
    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: { usuarioId, unidad: { conjuntoId }, ...rolVigente() },
      select: { unidadId: true, unidad: { select: { agrupacionId: true } } },
    });

    const unidadIds = ocupaciones.map((o) => o.unidadId);
    const agrupacionIds = await conAncestros(this.prisma,
      ocupaciones.map((o) => o.unidad.agrupacionId).filter((id): id is string => id !== null),
    );

    return this.prisma.encomienda.findMany({
      where: {
        conjuntoId,
        OR: [
          { unidadId: { in: unidadIds } },
          { agrupacionId: { in: agrupacionIds } },
          // Lo que llego para todo el conjunto.
          { unidadId: null, agrupacionId: null },
        ],
      },
      orderBy: { recibidaEn: 'desc' },
      include: CON_DESTINO,
    });
  }

  async registrar(conjuntoId: string, porteroId: string, dto: RegistrarEncomiendaDto) {
    const unidad = await this.prisma.unidad.findFirst({
      where: { id: dto.unidadId, conjuntoId },
    });
    if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');

    if (dto.casilleroId) await this.validarCasillero(conjuntoId, dto.casilleroId, dto.unidadId);

    // El estado sale de si HAY a quien avisarle. Si la unidad todavia no tiene
    // usuarios registrados —lo normal al arrancar un conjunto— la encomienda se queda
    // en RECIBIDA, y eso es informacion: nadie sabe que le llego algo.
    const destinatarios = await this.destinatarios(conjuntoId, dto.unidadId);
    const hayAQuienAvisar = destinatarios.length > 0;

    const encomienda = await this.prisma.encomienda.create({
      data: {
        ...dto,
        conjuntoId,
        recibidaPorId: porteroId,
        estado: hayAQuienAvisar ? EstadoEncomienda.NOTIFICADA : EstadoEncomienda.RECIBIDA,
        notificadaEn: hayAQuienAvisar ? new Date() : null,
      },
    });

    // Hasta hoy `NOTIFICADA` cambiaba una fila y no le avisaba a nadie. Este es
    // el aviso de verdad. El portero no lo recibe: acaba de registrarlo el.
    if (hayAQuienAvisar) {
      await this.avisos.avisar({
        conjuntoId,
        tipo: TipoNotificacion.ENCOMIENDA_RECIBIDA,
        titulo: `Llego ${etiquetaDe(dto.tipo)}`,
        cuerpo: dto.remitente ? `De ${dto.remitente}` : undefined,
        entidad: 'encomienda',
        entidadId: encomienda.id,
        excepto: porteroId,
        para: { unidad: dto.unidadId },
      });
    }

    return encomienda;
  }

  /**
   * Un reparto masivo: llego lo mismo para toda una torre o para todo el conjunto.
   *
   * UNA fila, no una por unidad. El hecho es "llego el recibo del agua para la
   * Torre 1"; abrirlo en 120 filas seria guardar la conclusion, y ademas ninguna
   * de esas filas cambiaria nunca de estado porque un recibo no se retira.
   *
   * Nace NOTIFICADA: no hay nada que entregar en mano, y registrarlo en la app ES
   * el aviso a los residentes.
   */
  async registrarMasiva(conjuntoId: string, porteroId: string, dto: RegistrarEncomiendaMasivaDto) {
    if (dto.agrupacionId) {
      const agrupacion = await this.prisma.agrupacion.findFirst({
        where: { id: dto.agrupacionId, conjuntoId },
      });
      if (!agrupacion) throw new NotFoundException('Esa agrupacion no existe en este conjunto');
    }

    const encomienda = await this.prisma.encomienda.create({
      data: {
        ...dto,
        conjuntoId,
        unidadId: null,
        recibidaPorId: porteroId,
        estado: EstadoEncomienda.NOTIFICADA,
        notificadaEn: new Date(),
      },
    });

    // Una fila de encomienda, muchas notificaciones. No es contradiccion: alla
    // el hecho es la llegada —una sola— y aca el hecho es el aviso a cada
    // persona, que es lo unico que se puede leer.
    await this.avisos.avisar({
      conjuntoId,
      tipo: TipoNotificacion.ENCOMIENDA_RECIBIDA,
      titulo: `Llego ${etiquetaDe(dto.tipo)}`,
      cuerpo: dto.remitente ? `De ${dto.remitente}` : undefined,
      entidad: 'encomienda',
      entidadId: encomienda.id,
      excepto: porteroId,
      para: dto.agrupacionId ? { agrupacion: dto.agrupacionId } : { conjunto: true },
    });

    return encomienda;
  }

  /**
   * Marca que se le aviso al residente.
   *
   * Sirve para dos cosas: cerrar el caso de la encomienda que nacio sin destinatarios
   * (ya se registro alguien en esa unidad), y volver a avisar cuando un paquete
   * lleva semanas sin que nadie baje.
   */
  async notificar(conjuntoId: string, id: string) {
    const encomienda = await this.obtenerVigente(conjuntoId, id);
    if (!encomienda.unidadId) {
      throw new BadRequestException('Un reparto masivo ya nace notificado');
    }

    const destinatarios = await this.destinatarios(conjuntoId, encomienda.unidadId);
    if (destinatarios.length === 0) {
      throw new BadRequestException(
        'Esa unidad no tiene usuarios registrados: no hay a quien avisarle todavia',
      );
    }

    const actualizada = await this.prisma.encomienda.update({
      where: { id },
      data: { estado: EstadoEncomienda.NOTIFICADA, notificadaEn: new Date() },
    });

    // Hasta hoy este metodo cambiaba la fila a NOTIFICADA y no le avisaba a
    // nadie: el estado decia una cosa y el residente no veia nada. El aviso es
    // el punto del metodo, no un efecto secundario.
    await this.avisos.avisar({
      conjuntoId,
      tipo: TipoNotificacion.ENCOMIENDA_RECIBIDA,
      titulo: `Sigue en porteria: llego ${etiquetaDe(encomienda.tipo)}`,
      cuerpo: encomienda.remitente ? `De ${encomienda.remitente}` : undefined,
      entidad: 'encomienda',
      entidadId: encomienda.id,
      para: { unidad: encomienda.unidadId },
    });

    return actualizada;
  }

  async entregar(conjuntoId: string, porteroId: string, id: string, dto: EntregarDto) {
    const encomienda = await this.obtenerVigente(conjuntoId, id);
    if (!encomienda.unidadId) {
      throw new BadRequestException('Un reparto masivo no se entrega en mano');
    }

    return this.prisma.encomienda.update({
      where: { id },
      data: {
        estado: EstadoEncomienda.ENTREGADA,
        retiradaPorNombre: dto.retiradaPorNombre,
        entregadaPorId: porteroId,
        entregadaEn: new Date(),
        ...(dto.observacion ? { observacion: dto.observacion } : {}),
      },
    });
  }

  async devolver(conjuntoId: string, porteroId: string, id: string, dto: DevolverDto) {
    await this.obtenerVigente(conjuntoId, id);
    return this.prisma.encomienda.update({
      where: { id },
      data: {
        estado: EstadoEncomienda.DEVUELTA,
        entregadaPorId: porteroId,
        entregadaEn: new Date(),
        observacion: dto.observacion,
      },
    });
  }

  // --- ayudas ---------------------------------------------------------------

  private async obtenerVigente(conjuntoId: string, id: string) {
    const encomienda = await this.prisma.encomienda.findFirst({ where: { id, conjuntoId } });
    if (!encomienda) throw new NotFoundException('Encomienda no encontrada');
    if (CERRADAS.includes(encomienda.estado)) {
      throw new BadRequestException(
        `Esa encomienda ya esta ${encomienda.estado.toLowerCase()} y no admite mas cambios`,
      );
    }
    return encomienda;
  }

  /**
   * El casillero tiene que existir aqui, estar en servicio y —si es de una
   * unidad— ser el de ESA unidad.
   *
   * Lo ultimo no lo puede hacer la base: cruza dos tablas. Sin la verificacion se
   * puede guardar el paquete del 501 en el casillero del 302 y nadie se entera
   * hasta que el paquete no aparece.
   */
  private async validarCasillero(conjuntoId: string, casilleroId: string, unidadId: string) {
    const casillero = await this.prisma.casillero.findFirst({
      where: { id: casilleroId, conjuntoId },
    });
    if (!casillero) throw new NotFoundException('Ese casillero no existe en este conjunto');
    if (!casillero.activo) {
      throw new BadRequestException(
        `El casillero ${casillero.identificador} esta fuera de servicio`,
      );
    }
    if (casillero.unidadId && casillero.unidadId !== unidadId) {
      throw new BadRequestException(`El casillero ${casillero.identificador} es de otra unidad`);
    }
  }

  /** Usuarios vigentes de una unidad: a quienes hay que avisarles. */
  private async destinatarios(conjuntoId: string, unidadId: string) {
    return this.prisma.usuarioUnidad.findMany({
      where: { unidadId, unidad: { conjuntoId }, ...rolVigente() },
      select: { usuarioId: true },
    });
  }
}
