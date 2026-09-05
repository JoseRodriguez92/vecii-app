import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RolMembresia } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../../auth/jwt.strategy.js';
import type { CreateConjuntoDto } from './dto/create-conjunto.dto.js';
import type { UpdateConjuntoDto } from './dto/update-conjunto.dto.js';

@Injectable()
export class ConjuntosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Conjuntos donde el usuario tiene membresia activa. */
  findMine(user: AuthUser) {
    return this.prisma.conjunto.findMany({
      where: { membresias: { some: { usuarioId: user.id, activo: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const conjunto = await this.prisma.conjunto.findFirst({
      where: { id, membresias: { some: { usuarioId: user.id, activo: true } } },
      include: {
        _count: { select: { unidades: true, torres: true, membresias: true } },
      },
    });
    if (!conjunto) throw new NotFoundException('Conjunto no encontrado');
    return conjunto;
  }

  /**
   * Crea un conjunto y deja al usuario creador como ADMIN_CONJUNTO.
   */
  create(dto: CreateConjuntoDto, user: AuthUser) {
    return this.prisma.conjunto.create({
      data: {
        ...dto,
        membresias: {
          create: { usuarioId: user.id, rol: RolMembresia.ADMIN_CONJUNTO },
        },
      },
    });
  }

  async update(id: string, dto: UpdateConjuntoDto, user: AuthUser) {
    await this.assertAdmin(id, user);
    return this.prisma.conjunto.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthUser) {
    await this.assertAdmin(id, user);
    await this.prisma.conjunto.delete({ where: { id } });
  }

  private async assertAdmin(conjuntoId: string, user: AuthUser) {
    const membresia = await this.prisma.membresia.findUnique({
      where: { usuarioId_conjuntoId: { usuarioId: user.id, conjuntoId } },
      select: { rol: true, activo: true },
    });
    if (!membresia?.activo || membresia.rol !== RolMembresia.ADMIN_CONJUNTO) {
      throw new ForbiddenException('Solo el administrador del conjunto puede hacer esto');
    }
  }
}
