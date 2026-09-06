import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase con la llave SECRETA. Solo backend, jamas cerca del
 * cliente: puede crear usuarios, leer cualquier dato y saltarse RLS.
 *
 * Se usa unicamente para lo que el usuario no puede hacer por si mismo —hoy,
 * invitar por correo—. Todo lo demas pasa por el JWT del usuario.
 *
 * OJO: aqui SI se dice "invitar", porque es el nombre de la operacion de
 * Supabase (`auth.admin.inviteUserByEmail`) y este servicio es el adaptador a
 * su vocabulario. Hacia adentro de Vecii la palabra es "vincular".
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private readonly cliente: SupabaseClient | null;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const secreto = config.get<string>('SUPABASE_SECRET_KEY');

    if (!secreto) {
      this.logger.warn(
        'SUPABASE_SECRET_KEY sin definir: no se podran enviar vinculaciones por correo.',
      );
      this.cliente = null;
      return;
    }

    this.cliente = createClient(url, secreto, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Manda el correo de vinculacion. Supabase crea el usuario en estado pendiente
   * y le pide contrasena al hacer clic.
   *
   * Si el correo YA tiene cuenta, Supabase responde error. No es un fallo: esa
   * persona simplemente entra con su cuenta y la vinculacion se le aplica sola al
   * entrar. Por eso se traga ese caso y se sigue.
   */
  async invitarPorCorreo(email: string, redirectTo?: string): Promise<{ yaExistia: boolean }> {
    if (!this.cliente) {
      throw new InternalServerErrorException(
        'El servidor no tiene configurada SUPABASE_SECRET_KEY; no puede enviar vinculaciones.',
      );
    }

    const { error } = await this.cliente.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (!error) return { yaExistia: false };

    const yaRegistrado =
      error.status === 422 || /already|registered|exists/i.test(error.message ?? '');

    if (yaRegistrado) {
      this.logger.log(`${email} ya tiene cuenta: la vinculacion se aplicara al iniciar sesion.`);
      return { yaExistia: true };
    }

    this.logger.error(`No se pudo invitar a ${email}: ${error.message}`);
    throw new InternalServerErrorException('No se pudo enviar la vinculacion por correo');
  }
}
