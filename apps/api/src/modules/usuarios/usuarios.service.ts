import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { SupabaseAdminService } from '../../auth/supabase-admin.service.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { PERMISOS } from '../../common/permisos.js';
import type { CodigoRol } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CerrarVinculoDto, RegistrarUsuarioDto } from './dto/usuario.dto.js';
import type { OtorgarRolDto, TerminarRolDto } from '../roles/dto/rol.dto.js';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
  ) {}

  /** Quien esta en el conjunto, con sus roles vigentes y sus unidades. */
  async listar(conjuntoId: string) {
    const vinculos = await this.prisma.usuarioConjunto.findMany({
      where: { conjuntoId },
      include: {
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            email: true,
            celular: true,
            tipoDocumento: true,
            numeroDocumento: true,
          },
        },
        roles: {
          where: rolVigente(),
          select: { desde: true, hasta: true, rol: { select: { codigo: true, nombre: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Las ocupaciones cuelgan del usuario, no del vinculo, asi que se traen
    // aparte y se acotan a las unidades DE ESTE conjunto.
    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: {
        usuarioId: { in: vinculos.map((v) => v.usuarioId) },
        unidad: { conjuntoId },
        OR: [{ hasta: null }, { hasta: { gt: new Date() } }],
      },
      select: {
        usuarioId: true,
        relacion: true,
        principal: true,
        unidad: { select: { id: true, identificador: true } },
      },
    });

    return vinculos.map((v) => ({
      ...v,
      unidades: ocupaciones.filter((o) => o.usuarioId === v.usuarioId),
    }));
  }

  /**
   * Registra a alguien en el conjunto.
   *
   * Antes esto era una invitacion que quedaba PENDIENTE y se aplicaba cuando la
   * persona hacia clic en un correo. Estaba al reves: alguien es propietario del
   * 501 porque tiene la escritura, no porque abrio un correo. Ahora el vinculo se
   * crea aqui mismo y el correo solo le sirve para poder entrar.
   *
   * La cuenta de Supabase se crea con `generateLink`, que NO envia nada: el
   * enlace lo manda nuestro SMTP. Mientras ese modulo no exista, la persona entra
   * con "olvide mi contrasena" — la cuenta ya esta creada.
   */
  async registrar(activo: ConjuntoActivo, autorId: string, dto: RegistrarUsuarioDto) {
    const email = dto.email.trim().toLowerCase();

    if (dto.unidadId && !dto.relacion) {
      throw new BadRequestException('Si indicas unidad, tienes que indicar la relacion');
    }
    if (dto.relacion && !dto.unidadId) {
      throw new BadRequestException('La relacion solo tiene sentido junto a una unidad');
    }

    // Alcance de FILA: quien no es administrador solo registra gente en SUS
    // unidades. El guard razona a nivel de conjunto, esto es mas fino.
    const puedeTodo = activo.permisos.has(PERMISOS.USUARIOS_CREAR);
    if (!puedeTodo) {
      if (!dto.unidadId) {
        throw new ForbiddenException('Solo puedes registrar gente en una unidad tuya');
      }
      const esDuenno = await this.prisma.usuarioUnidad.findFirst({
        where: {
          usuarioId: autorId,
          unidadId: dto.unidadId,
          relacion: 'PROPIETARIO',
          unidad: { conjuntoId: activo.conjuntoId },
          ...rolVigente(),
        },
        select: { id: true },
      });
      if (!esDuenno) throw new ForbiddenException('No eres propietario vigente de esa unidad');
      if (dto.roles?.length) {
        throw new ForbiddenException(
          'Solo la administracion puede otorgar cargos. Puedes registrar gente en tu unidad, no nombrar roles.',
        );
      }
    }

    if (dto.unidadId) {
      const unidad = await this.prisma.unidad.findFirst({
        where: { id: dto.unidadId, conjuntoId: activo.conjuntoId },
        select: { id: true },
      });
      if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');
    }

    const roles = await this.validarRolesOtorgables(dto.roles);

    // La cuenta se crea ANTES de la transaccion porque vive en Supabase, no en
    // nuestra base: no hay forma de deshacerla con un rollback. Si algo falla
    // despues, queda una cuenta huerfana que el proximo intento reutiliza —
    // `crearCuenta` devuelve el mismo id si el correo ya existe.
    const cuenta = await this.supabase.crearCuenta(email);

    const yaVigentes = await this.prisma.usuarioUnidad.findMany({
      where: { usuarioId: cuenta.id, unidad: { conjuntoId: activo.conjuntoId }, ...rolVigente() },
      select: { relacion: true, unidad: { select: { id: true, identificador: true } } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.upsert({
        where: { id: cuenta.id },
        create: {
          id: cuenta.id,
          email,
          nombres: dto.nombres ?? null,
          apellidos: dto.apellidos ?? null,
          tipoDocumento: dto.tipoDocumento ?? null,
          numeroDocumento: dto.numeroDocumento ?? null,
          celular: dto.celular ?? null,
        },
        // Solo rellena lo que venga: registrar de nuevo a alguien no le borra
        // los datos que el mismo ya corrigio en su perfil.
        update: {
          email,
          ...(dto.nombres ? { nombres: dto.nombres } : {}),
          ...(dto.apellidos ? { apellidos: dto.apellidos } : {}),
          ...(dto.tipoDocumento ? { tipoDocumento: dto.tipoDocumento } : {}),
          ...(dto.numeroDocumento ? { numeroDocumento: dto.numeroDocumento } : {}),
          ...(dto.celular ? { celular: dto.celular } : {}),
        },
      });

      const vinculo = await tx.usuarioConjunto.upsert({
        where: { usuarioId_conjuntoId: { usuarioId: cuenta.id, conjuntoId: activo.conjuntoId } },
        create: { usuarioId: cuenta.id, conjuntoId: activo.conjuntoId },
        update: { activo: true },
      });

      const desde = new Date();

      for (const rol of roles) {
        await tx.usuarioConjuntoRol.upsert({
          where: {
            usuarioConjuntoId_rolId_desde: {
              usuarioConjuntoId: vinculo.id,
              rolId: rol.id,
              desde,
            },
          },
          create: {
            usuarioConjuntoId: vinculo.id,
            rolId: rol.id,
            desde,
            asignadoPorId: autorId,
          },
          update: {},
        });
      }

      if (dto.unidadId && dto.relacion) {
        // Registrar solo AGREGA. No cierra vinculos anteriores, porque "ya esta
        // en otra unidad" significa dos cosas opuestas: se mudo, o tiene dos.
        // Un propietario con parqueadero privado tiene siempre dos unidades —
        // cerrarle una automaticamente le borraria el parqueadero.
        const existe = await tx.usuarioUnidad.findFirst({
          where: {
            usuarioId: cuenta.id,
            unidadId: dto.unidadId,
            relacion: dto.relacion,
            ...rolVigente(),
          },
          select: { id: true },
        });
        if (!existe) {
          await tx.usuarioUnidad.create({
            data: {
              usuarioId: cuenta.id,
              unidadId: dto.unidadId,
              relacion: dto.relacion,
              desde,
            },
          });
        }
      }
    });

    if (cuenta.enlace) {
      // TODO: enviarlo por SMTP propio cuando exista el modulo de notificaciones.
      this.logger.log(`Cuenta creada para ${email}. Falta enviar el enlace de acceso.`);
    }

    return {
      usuarioId: cuenta.id,
      yaTeniaCuenta: cuenta.yaTeniaCuenta,
      correoEnviado: false,
      /** Unidades donde ya estaba vigente ANTES de este registro. */
      yaVigenteEn: yaVigentes.map((v) => ({
        unidadId: v.unidad.id,
        identificador: v.unidad.identificador,
        relacion: v.relacion,
      })),
      mensaje: cuenta.yaTeniaCuenta
        ? 'Esa persona ya tenia cuenta en Vecii. Quedo vinculada al conjunto.'
        : 'Usuario creado. Todavia no se le envio el correo de acceso: puede entrar con "olvide mi contrasena".',
    };
  }

  /**
   * Termina un vinculo con una unidad: se mudo, vendio, se acabo el contrato.
   *
   * Cierra con `hasta`, no borra. Hace falta saber quien vivia ahi cuando se
   * genero una cuota vieja.
   */
  async cerrarVinculo(
    conjuntoId: string,
    usuarioId: string,
    unidadId: string,
    dto: CerrarVinculoDto,
  ) {
    const abiertos = await this.prisma.usuarioUnidad.findMany({
      where: { usuarioId, unidadId, unidad: { conjuntoId }, ...rolVigente() },
      select: { id: true },
    });
    if (abiertos.length === 0) {
      throw new NotFoundException('Esa persona no tiene un vinculo vigente con esa unidad');
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : new Date();
    if (Number.isNaN(hasta.getTime())) throw new BadRequestException('Fecha invalida');

    await this.prisma.usuarioUnidad.updateMany({
      where: { id: { in: abiertos.map((a) => a.id) } },
      data: { hasta },
    });

    return { cerrados: abiertos.length, hasta };
  }

  /**
   * Otorga un cargo en el conjunto.
   *
   * `desde` es del periodo, no del clic: al consejo se entra por periodo, y el
   * administrador registra la eleccion despues de que paso. Por eso se puede
   * mandar una fecha anterior.
   */
  async otorgarRol(conjuntoId: string, usuarioId: string, autorId: string, dto: OtorgarRolDto) {
    const vinculo = await this.prisma.usuarioConjunto.findFirst({
      where: { usuarioId, conjuntoId },
      select: { id: true },
    });
    if (!vinculo) throw new NotFoundException('Esa persona no pertenece a este conjunto');

    const rol = await this.prisma.rol.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true, nombre: true, asignable: true },
    });
    if (!rol) throw new NotFoundException(`No existe el rol ${dto.codigo}`);
    if (!rol.asignable) {
      throw new BadRequestException(
        `${rol.nombre} no se otorga a mano. Propietario y residente se derivan de las unidades; ` +
          'SUPER_ADMIN es staff de Vecii.',
      );
    }

    const desde = dto.desde ? new Date(dto.desde) : new Date();
    if (Number.isNaN(desde.getTime())) throw new BadRequestException('Fecha invalida');

    const yaLoTiene = await this.prisma.usuarioConjuntoRol.findFirst({
      where: { usuarioConjuntoId: vinculo.id, rolId: rol.id, ...rolVigente() },
      select: { desde: true },
    });
    if (yaLoTiene) {
      throw new BadRequestException(
        `Esa persona ya es ${rol.nombre} desde ${yaLoTiene.desde.toISOString().slice(0, 10)}`,
      );
    }

    return this.prisma.usuarioConjuntoRol.create({
      data: {
        usuarioConjuntoId: vinculo.id,
        rolId: rol.id,
        desde,
        asignadoPorId: autorId,
      },
      include: { rol: { select: { codigo: true, nombre: true } } },
    });
  }

  /**
   * Termina un cargo. Cierra con `hasta`, no borra.
   *
   * Es para lo que existe la vigencia: cuando el consejo cambia, la fila del
   * saliente se queda, porque "quien era consejero cuando se aprobo eso" es una
   * pregunta que se hace en cada asamblea.
   */
  async terminarRol(
    conjuntoId: string,
    usuarioId: string,
    codigo: string,
    dto: TerminarRolDto,
  ) {
    const vigentes = await this.prisma.usuarioConjuntoRol.findMany({
      where: {
        usuarioConjunto: { usuarioId, conjuntoId },
        rol: { codigo: codigo as never },
        ...rolVigente(),
      },
      select: { id: true, desde: true },
    });
    if (vigentes.length === 0) {
      throw new NotFoundException('Esa persona no tiene ese cargo vigente en este conjunto');
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : new Date();
    if (Number.isNaN(hasta.getTime())) throw new BadRequestException('Fecha invalida');
    if (vigentes.some((v) => hasta <= v.desde)) {
      throw new BadRequestException('El cargo terminaria antes de empezar');
    }

    await this.prisma.usuarioConjuntoRol.updateMany({
      where: { id: { in: vigentes.map((v) => v.id) } },
      data: { hasta },
    });
    return { codigo, cerrados: vigentes.length, hasta };
  }

  /** Los cargos se otorgan; propietario y residente se derivan de la unidad. */
  private async validarRolesOtorgables(roles?: CodigoRol[]) {
    if (!roles?.length) return [];
    const encontrados = await this.prisma.rol.findMany({
      where: { codigo: { in: roles } },
      select: { id: true, codigo: true, asignable: true, nombre: true },
    });
    const noOtorgables = encontrados.filter((r) => !r.asignable);
    if (noOtorgables.length > 0) {
      throw new BadRequestException(
        `Estos roles no se otorgan a mano: ${noOtorgables.map((r) => r.nombre).join(', ')}. ` +
          'Propietario y residente se derivan de las unidades.',
      );
    }
    if (encontrados.length !== roles.length) {
      throw new BadRequestException('Alguno de los roles indicados no existe');
    }
    return encontrados;
  }
}
