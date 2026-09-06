import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Lo que devuelve crear una cuenta: el id que necesita el modelo y el enlace. */
export interface CuentaCreada {
  /** El `sub` del JWT. Es el mismo id que lleva nuestra tabla `usuarios`. */
  id: string;
  /**
   * Enlace para poner contrasena. Hay que enviarlo por NUESTRO SMTP.
   * Null cuando la persona ya tenia cuenta: ya sabe entrar.
   */
  enlace: string | null;
  yaTeniaCuenta: boolean;
}

/**
 * Cliente de Supabase con la llave SECRETA. Solo backend, jamas cerca del
 * cliente: puede crear usuarios, leer cualquier dato y saltarse RLS.
 *
 * Se usa unicamente para lo que el usuario no puede hacer por si mismo: crear
 * la cuenta de alguien mas. Todo lo demas pasa por el JWT del usuario.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private readonly cliente: SupabaseClient | null;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const secreto = config.get<string>('SUPABASE_SECRET_KEY');

    if (!secreto) {
      this.logger.warn('SUPABASE_SECRET_KEY sin definir: no se podran crear usuarios.');
      this.cliente = null;
      return;
    }

    this.cliente = createClient(url, secreto, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Crea la cuenta en Supabase Auth y devuelve su id.
   *
   * Usa `generateLink` y NO `inviteUserByEmail` a proposito: las dos crean el
   * usuario, pero `inviteUserByEmail` ademas manda el correo desde el servidor
   * de Supabase —limitado a unos pocos envios por hora e imposible de
   * personalizar—. `generateLink` no manda nada: devuelve el enlace para que lo
   * mande nuestro SMTP.
   *
   * Mientras el modulo de notificaciones no exista, ese enlace no se envia y la
   * persona entra con "olvide mi contrasena", que funciona porque la cuenta ya
   * existe. Ver docs/pendientes.md.
   *
   * Si el correo ya tiene cuenta —se mudo de otro conjunto que usa Vecii— no es
   * un error: se recupera su id con un enlace de tipo `magiclink`, que si acepta
   * usuarios existentes, y se sigue.
   */
  async crearCuenta(email: string, redirectTo?: string): Promise<CuentaCreada> {
    const cliente = this.exigirCliente();

    const { data, error } = await cliente.auth.admin.generateLink({
      type: 'invite',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (!error && data?.user) {
      return {
        id: data.user.id,
        enlace: data.properties?.action_link ?? null,
        yaTeniaCuenta: false,
      };
    }

    const yaExiste =
      error?.status === 422 || /already|registered|exists/i.test(error?.message ?? '');
    if (!yaExiste) {
      this.logger.error(`No se pudo crear la cuenta de ${email}: ${error?.message}`);
      throw new InternalServerErrorException('No se pudo crear la cuenta en Supabase');
    }

    this.logger.log(`${email} ya tenia cuenta: se reutiliza.`);
    return { ...(await this.buscarPorCorreo(email)), yaTeniaCuenta: true };
  }

  /**
   * Recupera el id de una cuenta existente.
   *
   * `magiclink` es el unico tipo de enlace que acepta un correo ya registrado, y
   * devuelve el usuario completo. No se envia: solo se usa para leer el id.
   */
  private async buscarPorCorreo(email: string): Promise<{ id: string; enlace: null }> {
    const cliente = this.exigirCliente();

    const { data, error } = await cliente.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !data?.user) {
      this.logger.error(`No se pudo recuperar la cuenta de ${email}: ${error?.message}`);
      throw new InternalServerErrorException('No se pudo recuperar la cuenta en Supabase');
    }
    return { id: data.user.id, enlace: null };
  }

  private exigirCliente(): SupabaseClient {
    if (!this.cliente) {
      throw new InternalServerErrorException(
        'El servidor no tiene configurada SUPABASE_SECRET_KEY; no puede crear usuarios.',
      );
    }
    return this.cliente;
  }
}
