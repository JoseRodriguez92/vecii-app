import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { PERMISOS } from '../../common/permisos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccesoService } from './acceso.service.js';
import { CargosService } from './cargos.service.js';
import type { CerrarVinculoDto, RegistrarUsuarioDto } from './dto/usuario.dto.js';

/** Con que se identifica una persona. Al menos uno de los tres. */
interface Identidad {
  email?: string;
  tipoDocumento?: RegistrarUsuarioDto['tipoDocumento'];
  numeroDocumento?: string;
  celular?: string;
}

/**
 * Quien esta en el conjunto y en que unidad vive.
 *
 * Solo eso. Lo que era este archivo hacia ademas dos cosas que no se le
 * parecen, y se fueron a sus propios servicios: enganchar la persona con su
 * cuenta de Supabase (`AccesoService`) y repartir cargos (`CargosService`).
 * Tres preguntas distintas, que las hace gente distinta y cambian por motivos
 * distintos.
 */
@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly cargos: CargosService,
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
    const { email, tipoDocumento, numeroDocumento, celular } = this.identidadDe(dto);
    await this.exigirAlcance(activo, autorId, dto);
    const roles = await this.cargos.validarRolesOtorgables(activo.conjuntoId, dto.roles);


    const { cuenta, encontrada } = await this.resolverPersona(dto, {
      email,
      tipoDocumento,
      numeroDocumento,
      celular,
    });
    const yaVigentes = encontrada
      ? await this.prisma.usuarioUnidad.findMany({
          where: { usuarioId: encontrada.id, unidad: { conjuntoId: activo.conjuntoId }, ...rolVigente() },
          select: { relacion: true, unidad: { select: { id: true, identificador: true } } },
        })
      : [];

    const usuarioId = await this.prisma.$transaction(async (tx) => {
      // Solo rellena lo que venga: registrar de nuevo a alguien no le borra los
      // datos que el mismo ya corrigio en su perfil.
      const cambios = {
        ...(email ? { email } : {}),
        ...(cuenta ? { cuentaId: cuenta.id } : {}),
        ...(dto.nombres ? { nombres: dto.nombres } : {}),
        ...(dto.apellidos ? { apellidos: dto.apellidos } : {}),
        ...(tipoDocumento ? { tipoDocumento } : {}),
        ...(numeroDocumento ? { numeroDocumento } : {}),
        ...(celular ? { celular } : {}),
      };

      const persona = encontrada
        ? await tx.usuario.update({ where: { id: encontrada.id }, data: cambios })
        : await tx.usuario.create({ data: cambios });

      const vinculo = await tx.usuarioConjunto.upsert({
        where: { usuarioId_conjuntoId: { usuarioId: persona.id, conjuntoId: activo.conjuntoId } },
        create: { usuarioId: persona.id, conjuntoId: activo.conjuntoId },
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
            usuarioId: persona.id,
            unidadId: dto.unidadId,
            relacion: dto.relacion,
            ...rolVigente(),
          },
          select: { id: true },
        });
        if (!existe) {
          await tx.usuarioUnidad.create({
            data: {
              usuarioId: persona.id,
              unidadId: dto.unidadId,
              relacion: dto.relacion,
              desde,
            },
          });
        }
      }

      return persona.id;
    });

    if (cuenta?.enlace) {
      // Pendiente: enviarlo por SMTP propio. NO lo resuelve el modulo de
      // notificaciones —ese es la campanita dentro de la app— ni lo manda
      // Supabase, que es justamente lo que no queremos. Ver docs/pendientes.md.
      this.logger.log(`Cuenta creada para ${email}. Falta enviar el enlace de acceso.`);
    }

    return {
      usuarioId,
      tieneAcceso: Boolean(cuenta),
      yaTeniaCuenta: cuenta?.yaTeniaCuenta ?? false,
      correoEnviado: false,
      /** Unidades donde ya estaba vigente ANTES de este registro. */
      yaVigenteEn: yaVigentes.map((v) => ({
        unidadId: v.unidad.id,
        identificador: v.unidad.identificador,
        relacion: v.relacion,
      })),
      mensaje: !cuenta
        ? 'Persona registrada por su documento, sin acceso a la app. Cuando entregue un correo se le puede dar acceso.'
        : cuenta.yaTeniaCuenta
          ? 'Esa persona ya tenia cuenta en Vecii. Quedo vinculada al conjunto.'
          : 'Usuario creado. Todavia no se le envio el correo de acceso: puede entrar con "olvide mi contrasena".',
    };
  }

  /**
   * La cuenta si hay correo, y la persona si ya existia.
   *
   * El documento manda sobre el correo: si esa cedula ya esta a nombre de otra
   * cuenta, no es un registro nuevo sino la misma persona con dos correos o un
   * error de digitacion, y fusionarlas en silencio le daria a alguien el acceso
   * de otro.
   */
  private async resolverPersona(dto: RegistrarUsuarioDto, identidad: Identidad) {
    const { email, tipoDocumento, numeroDocumento } = identidad;

    // La cuenta se crea ANTES de la transaccion porque vive en Supabase, no en
    // nuestra base: no hay forma de deshacerla con un rollback. Si algo falla
    // despues, queda una cuenta huerfana que el proximo intento reutiliza —
    // `crearCuenta` devuelve el mismo id si el correo ya existe.
    //
    // Sin correo no se crea nada: la persona queda registrada y sin acceso.
    const cuenta = await this.acceso.cuentaPara(email);

    const encontrada = await this.acceso.buscarPersona({
      cuentaId: cuenta?.id,
      email,
      tipoDocumento,
      numeroDocumento,
    });

    if (encontrada && cuenta && encontrada.cuentaId && encontrada.cuentaId !== cuenta.id) {
      throw new BadRequestException(
        `Ese documento ya esta registrado con otra cuenta (${encontrada.email ?? 'sin correo'}). ` +
          'Si es la misma persona, corrige el correo en su perfil en vez de registrarla de nuevo.',
      );
    }

    return { cuenta, encontrada };
  }

  /**
   * Con que se identifica esta persona, y si alcanza.
   *
   * Correo, documento o celular: basta uno. El documento es el que nunca falta
   * —cedula, cedula de extranjeria, pasaporte, PPT o NIT— y el correo solo hace
   * falta si ademas va a ENTRAR a la app.
   */
  private identidadDe(dto: RegistrarUsuarioDto): Identidad {
    const email = dto.email?.trim().toLowerCase();

    // Una persona se identifica por su correo o por su documento, y de los dos
    // el que nunca falta es el documento: cedula, cedula de extranjeria,
    // pasaporte, PPT o NIT. El correo solo hace falta si ademas va a ENTRAR a la
    // app, y hay gente que tiene que estar registrada sin entrar nunca: el
    // copropietario que no gestiona, el dueno que vive afuera, la empresa que
    // compro el local. Ver docs/dominio/glosario.md.
    const tipoDocumento = dto.tipoDocumento;
    const numeroDocumento = dto.numeroDocumento?.trim();
    const celular = dto.celular?.trim();
    if (Boolean(tipoDocumento) !== Boolean(numeroDocumento)) {
      throw new BadRequestException('El documento va completo: tipo y numero, o ninguno de los dos');
    }
    if (!email && !numeroDocumento && !celular) {
      throw new BadRequestException(
        'Hace falta al menos uno: correo, documento o celular. Sin ninguno no hay como ' +
          'identificar a la persona, y un dato inventado seria peor que no tenerlo.',
      );
    }

    return { email, tipoDocumento, numeroDocumento, celular };
  }

  /**
   * Alcance de FILA: en que unidades puede registrar gente quien pregunta.
   *
   * El guard razona a nivel de CONJUNTO —sabe si alguien tiene `usuarios.crear`
   * aqui adentro— y eso no alcanza: el propietario del 501 solo puede registrar
   * en el 501. A diferencia de porteria, aqui SI se exige ser propietario: meter
   * gente a una unidad es decir quien vive ahi, y eso lo responde la escritura.
   */
  private async exigirAlcance(
    activo: ConjuntoActivo,
    autorId: string,
    dto: RegistrarUsuarioDto,
  ): Promise<void> {
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
}
