import { Injectable, Logger } from '@nestjs/common';
import { rolVigente } from '../common/rol-vigente.js';
import { EstadoVinculacion } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincroniza el usuario de Supabase con la tabla local, aplica las
   * vinculaciones que lo esperaban, y devuelve su perfil.
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

    if (email) await this.aplicarVinculaciones(user.id, email);

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

  /**
   * Convierte en vinculos reales las vinculaciones pendientes para este correo.
   *
   * Se hace al iniciar sesion y no con un token en el enlace: el correo YA es la
   * prueba de identidad, porque Supabase lo verifico cuando la persona hizo clic.
   * Un token seria una cosa mas que se puede perder o reenviar por WhatsApp.
   *
   * Cada vinculacion va en su propia transaccion: si una falla, las demas entran
   * igual. Y los errores se registran sin tumbar el login — quedarse sin poder
   * entrar por una vinculacion mal formada seria peor que no aplicarla.
   */
  private async aplicarVinculaciones(usuarioId: string, email: string) {
    const ahora = new Date();

    const vencidas = await this.prisma.vinculacion.updateMany({
      where: { email, estado: EstadoVinculacion.PENDIENTE, expiraEn: { lte: ahora } },
      data: { estado: EstadoVinculacion.VENCIDA },
    });
    if (vencidas.count > 0) {
      this.logger.log(`${vencidas.count} vinculacion(es) vencidas para ${email}`);
    }

    const pendientes = await this.prisma.vinculacion.findMany({
      where: { email, estado: EstadoVinculacion.PENDIENTE, expiraEn: { gt: ahora } },
    });

    for (const inv of pendientes) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const vinculo = await tx.usuarioConjunto.upsert({
            where: { usuarioId_conjuntoId: { usuarioId, conjuntoId: inv.conjuntoId } },
            create: { usuarioId, conjuntoId: inv.conjuntoId },
            update: { activo: true },
          });

          for (const codigo of inv.roles) {
            const rol = await tx.rol.findUnique({ where: { codigo }, select: { id: true } });
            if (!rol) continue;
            await tx.usuarioConjuntoRol.upsert({
              where: {
                usuarioConjuntoId_rolId_desde: {
                  usuarioConjuntoId: vinculo.id,
                  rolId: rol.id,
                  desde: inv.createdAt,
                },
              },
              create: {
                usuarioConjuntoId: vinculo.id,
                rolId: rol.id,
                desde: inv.createdAt,
                asignadoPorId: inv.creadaPorId,
              },
              update: {},
            });
          }

          if (inv.unidadId && inv.relacion) {
            await tx.usuarioUnidad.upsert({
              where: {
                usuarioId_unidadId_relacion_desde: {
                  usuarioId,
                  unidadId: inv.unidadId,
                  relacion: inv.relacion,
                  desde: inv.createdAt,
                },
              },
              create: {
                usuarioId,
                unidadId: inv.unidadId,
                relacion: inv.relacion,
                desde: inv.createdAt,
              },
              update: {},
            });
          }

          await tx.vinculacion.update({
            where: { id: inv.id },
            data: { estado: EstadoVinculacion.ACEPTADA, aceptadaEn: ahora, usuarioId },
          });
        });

        this.logger.log(`Vinculacion ${inv.id} aplicada a ${email}`);
      } catch (error) {
        // No se propaga: fallar el login por una vinculacion mal formada seria
        // peor que dejarla pendiente para revisarla despues.
        this.logger.error(
          `No se pudo aplicar la vinculacion ${inv.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }
}
