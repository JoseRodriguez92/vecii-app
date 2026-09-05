import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincroniza el usuario de Supabase con la tabla local `usuarios` y
   * devuelve su perfil con las membresias activas.
   */
  async syncAndGetProfile(user: AuthUser) {
    const usuario = await this.prisma.usuario.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? `${user.id}@sin-email.local`,
      },
      update: user.email ? { email: user.email } : {},
      include: {
        membresias: {
          where: { activo: true },
          select: {
            id: true,
            rol: true,
            conjunto: { select: { id: true, nombre: true, ciudad: true } },
          },
        },
      },
    });

    return usuario;
  }
}
