import { Injectable, Logger } from '@nestjs/common';
import { rolVigente } from '../common/rol-vigente.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * El perfil de quien entro, con sus conjuntos.
   *
   * Ya no sincroniza nada: crear la persona a partir de la cuenta lo hace
   * `SupabaseAuthGuard`, y lo hace para cualquier ruta y no solo para esta.
   *
   * Tampoco aplica ningun tramite pendiente: cuando el administrador registra a
   * alguien, sus vinculos con el conjunto y sus unidades se crean en ese
   * momento. Entrar por primera vez no cambia nada, solo lo lee.
   */
  async syncAndGetProfile(user: AuthUser) {
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
