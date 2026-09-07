import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseAdminService } from '../../auth/supabase-admin.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { RegistrarUsuarioDto } from './dto/usuario.dto.js';

/**
 * Donde se juntan la PERSONA y la CUENTA.
 *
 * Fueron la misma cosa hasta que `usuarios.id` dejo de ser el `sub` de Supabase,
 * y separarlas fue lo que permitio anotar al copropietario que no gestiona y al
 * dueno que vive afuera. Pero separarlas tambien dejo un trabajo nuevo:
 * encontrar a la persona detras de un correo, un documento o una cuenta, y
 * enganchar las dos cuando por fin coinciden.
 *
 * Ese trabajo es todo lo que hay aqui. Y tiene una consecuencia buena:
 * `UsuariosService` ya no sabe que Supabase existe.
 */
@Injectable()
export class AccesoService {
  private readonly logger = new Logger(AccesoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
  ) {}

  /**
   * La cuenta de Supabase, si hay correo con que crearla.
   *
   * Se hace FUERA de cualquier transaccion porque vive en Supabase, no en
   * nuestra base: no hay rollback que la deshaga. Si algo falla despues, queda
   * una cuenta huerfana que el proximo intento reutiliza — `crearCuenta`
   * devuelve el mismo id si el correo ya existe.
   */
  cuentaPara(email?: string) {
    return email ? this.supabase.crearCuenta(email) : Promise.resolve(null);
  }

  /**
   * Encuentra a la persona por cualquiera de sus identidades, en orden de
   * confianza: la cuenta que acaba de resolver Supabase, el documento, el correo.
   */
  async buscarPersona(datos: {
    cuentaId?: string;
    email?: string;
    tipoDocumento?: RegistrarUsuarioDto['tipoDocumento'];
    numeroDocumento?: string;
  }) {
    if (datos.cuentaId) {
      const porCuenta = await this.prisma.usuario.findUnique({
        where: { cuentaId: datos.cuentaId },
      });
      if (porCuenta) return porCuenta;
    }
    if (datos.tipoDocumento && datos.numeroDocumento) {
      // findFirst y no findUnique: Prisma no acepta nulos dentro de una clave
      // unica compuesta, y los dos campos son opcionales en la tabla.
      const porDocumento = await this.prisma.usuario.findFirst({
        where: { tipoDocumento: datos.tipoDocumento, numeroDocumento: datos.numeroDocumento },
      });
      if (porDocumento) return porDocumento;
    }
    if (datos.email) {
      const porCorreo = await this.prisma.usuario.findFirst({ where: { email: datos.email } });
      if (porCorreo) return porCorreo;
    }
    return null;
  }

  /**
   * Le da acceso a alguien que ya esta registrado.
   *
   * Es la otra mitad de haber separado la persona de la cuenta: la
   * administracion carga el padron un lunes con puros documentos, y la gente va
   * entregando su correo con los meses. Esto no crea una persona nueva —crearla
   * de nuevo la duplicaria— sino que le engancha una cuenta a la que ya existe.
   */
  async darAcceso(conjuntoId: string, usuarioId: string, correo: string) {
    const email = correo.trim().toLowerCase();

    const persona = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, conjuntos: { some: { conjuntoId } } },
    });
    if (!persona) throw new NotFoundException('Esa persona no esta registrada en este conjunto');
    if (persona.cuentaId) {
      throw new BadRequestException(
        `Esa persona ya tiene acceso${persona.email ? ` con ${persona.email}` : ''}`,
      );
    }

    const cuenta = await this.supabase.crearCuenta(email);

    // Ese correo podria pertenecer a otra persona ya registrada. Enganchar la
    // cuenta igual dejaria a dos personas compartiendo un acceso.
    const dueno = await this.prisma.usuario.findFirst({
      where: { cuentaId: cuenta.id, NOT: { id: usuarioId } },
      select: { id: true },
    });
    if (dueno) {
      throw new BadRequestException('Ese correo ya es el acceso de otra persona registrada');
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { cuentaId: cuenta.id, email },
    });

    if (cuenta.enlace) {
      this.logger.log(`Acceso creado para ${email}. Falta enviar el enlace.`);
    }

    return {
      usuarioId,
      tieneAcceso: true,
      yaTeniaCuenta: cuenta.yaTeniaCuenta,
      correoEnviado: false,
      mensaje: 'Acceso creado. Puede entrar con "olvide mi contrasena" mientras no exista el SMTP.',
    };
  }
}
