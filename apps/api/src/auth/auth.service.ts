import { Injectable, Logger } from '@nestjs/common';
import { rolVigente } from '../common/rol-vigente.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincroniza el usuario de Supabase con la tabla local y devuelve su perfil.
   *
   * No aplica ningun tramite pendiente: cuando el administrador registra a
   * alguien, sus vinculos con el conjunto y sus unidades se crean en ese
   * momento. Entrar por primera vez no cambia nada, solo lo lee.
   *
   * El email puede venir vacio: Supabase permite registrarse solo con telefono.
   */
  async syncAndGetProfile(user: AuthUser) {
    const email = user.email?.trim().toLowerCase() ?? null;

    await this.prisma.usuario.upsert({
      where: { id: user.id },
      create: { id: user.id, email, celular: user.phone ?? null },
      update: {
        ...(email ? { email } : {}),
        ...(user.phone ? { celular: user.phone } : {}),
      },
    });

    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        conjuntos: {
          where: { activo: true },
          select: {
            id: true,
            roles: { where: rolVigente(), select: { rol: { select: { codigo: true, nombre: true } } } },
            conjunto: { select: { id: true, nombre: true, ciudad: true } },
          },
        },
      },
    });
  }

}
