import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser, SesionSupabase } from './auth-user.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';
import { claveDeTelefono } from './telefono.js';

/**
 * Guard de autenticacion global. Verifica el access token de Supabase salvo en
 * las rutas marcadas con `@Public()`, y deja el usuario en `request.user`.
 *
 * Ademas hace una traduccion que antes no hacia falta: el `sub` del token
 * identifica una CUENTA, y lo que el resto del sistema maneja son PERSONAS. Las
 * dos cosas fueron la misma mientras `usuarios` era un espejo de `auth.users`;
 * dejaron de serlo para poder anotar gente sin cuenta. Se traduce aqui, una vez
 * por peticion, y asi los veintitantos servicios que reciben `user.id` siguen
 * hablando de personas sin enterarse.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) {
      // Mismo mensaje que un token invalido: no se le dice al cliente si el
      // problema fue la ausencia del token o su contenido.
      throw new UnauthorizedException('Token invalido o expirado');
    }

    const sesion = await this.jwt.verify(token);
    request.user = await this.personaDeLaCuenta(sesion);
    return true;
  }

  /**
   * La persona detras de la cuenta. Si no existe, se crea.
   *
   * Ese espejo lo hacia `/auth/me`, pero solo si el cliente lo llamaba primero.
   * Aqui vale para cualquier ruta, que es lo que corresponde: si Supabase dice
   * que la cuenta es valida, la persona existe.
   *
   * Se enlaza por TELEFONO y no por correo, y la diferencia no es de gusto:
   *
   *   un correo escrito en un formulario no prueba nada — le bastaria a
   *   cualquiera registrarse con el correo de otro para quedarse con su
   *   identidad;
   *
   *   un telefono que paso el OTP prueba posesion — Supabase solo emite el
   *   token despues de que el codigo llego a ese numero.
   *
   * Lo que el OTP NO prueba es que el administrador haya tecleado bien el
   * numero. Contra ese error va el documento como segundo factor en el primer
   * ingreso, que todavia esta pendiente (ver docs/pendientes.md).
   */
  private async personaDeLaCuenta(sesion: SesionSupabase): Promise<AuthUser> {
    const email = sesion.email?.trim().toLowerCase() ?? null;

    const yaEnlazada = await this.prisma.usuario.findUnique({
      where: { cuentaId: sesion.cuentaId },
      select: { id: true },
    });
    if (yaEnlazada) {
      await this.prisma.usuario.update({
        where: { id: yaEnlazada.id },
        data: {
          ...(email ? { email } : {}),
          ...(sesion.phone ? { celular: sesion.phone } : {}),
        },
      });
      return { id: yaEnlazada.id, cuentaId: sesion.cuentaId, email: sesion.email, phone: sesion.phone };
    }

    // Primera vez que entra. Si la administracion ya la anoto con este celular,
    // esta es esa persona y no una nueva: es todo el punto de haber podido
    // registrarla sin cuenta.
    const clave = claveDeTelefono(sesion.phone);
    if (clave) {
      const candidatas = await this.prisma.usuario.findMany({
        where: { cuentaId: null, celular: { not: null } },
        select: { id: true, celular: true },
      });
      const anotada = candidatas.filter((c) => claveDeTelefono(c.celular) === clave);
      // Dos personas anotadas con el mismo celular: no hay como saber cual es,
      // y adivinar le daria a alguien la identidad de otro. Que lo arregle la
      // administracion.
      if (anotada.length === 1) {
        await this.prisma.usuario.update({
          where: { id: anotada[0].id },
          data: { cuentaId: sesion.cuentaId, ...(email ? { email } : {}) },
        });
        return { id: anotada[0].id, cuentaId: sesion.cuentaId, email: sesion.email, phone: sesion.phone };
      }
    }

    const persona = await this.prisma.usuario.create({
      data: { cuentaId: sesion.cuentaId, email, celular: sesion.phone ?? null },
      select: { id: true },
    });

    return {
      id: persona.id,
      cuentaId: sesion.cuentaId,
      email: sesion.email,
      phone: sesion.phone,
    };
  }
}
