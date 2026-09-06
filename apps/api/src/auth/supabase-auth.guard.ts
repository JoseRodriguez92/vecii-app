import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import type { AuthUser } from './auth-user.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

/**
 * Guard de autenticacion global. Verifica el access token de Supabase salvo en
 * las rutas marcadas con `@Public()`, y deja el usuario en `request.user`.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
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

    request.user = await this.jwt.verify(token);
    return true;
  }
}
