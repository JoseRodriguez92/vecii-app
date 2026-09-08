import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../../auth/auth-user.js';
import type { CreateConjuntoDto } from './dto/create-conjunto.dto.js';
import type { UpdateConjuntoDto } from './dto/update-conjunto.dto.js';
import { ROL } from '../../common/roles.js';
import { sembrarConjunto } from './siembra.js';

@Injectable()
export class ConjuntosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Conjuntos donde el usuario tiene un vinculo activo. */
  findMine(user: AuthUser) {
    return this.prisma.conjunto.findMany({
      where: { usuarios: { some: { usuarioId: user.id, activo: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const conjunto = await this.prisma.conjunto.findFirst({
      where: { id, usuarios: { some: { usuarioId: user.id, activo: true } } },
      include: {
        _count: { select: { unidades: true, agrupaciones: true, usuarios: true } },
      },
    });
    if (!conjunto) throw new NotFoundException('Conjunto no encontrado');
    return conjunto;
  }

  /**
   * Crea un conjunto, deja al creador como administrador y lo siembra.
   *
   * Todo en una transaccion: un conjunto sin sus conceptos de cobro no puede
   * facturar, y nadie se entera hasta fin de mes. Que arranque completo o que no
   * arranque.
   *
   * Con que arranca vive en `siembra.ts`, no aqui. Es donde entrarian tambien
   * los cargos propios del conjunto el dia que se decida — hoy se conecta al rol
   * estandar, que es compartido (ver ADR-0007).
   */
  async create(dto: CreateConjuntoDto, user: AuthUser) {
    // `connect` por codigo ya no sirve: la unicidad es (conjuntoId, codigo) y
    // Prisma no acepta un nulo dentro de una clave unica compuesta.
    const rolAdmin = await this.prisma.rol.findFirstOrThrow({
      where: { codigo: ROL.ADMIN_CONJUNTO, conjuntoId: null },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const conjunto = await tx.conjunto.create({
        data: {
          ...dto,
          usuarios: {
            create: {
              usuarioId: user.id,
              roles: { create: { rolId: rolAdmin.id } },
            },
          },
        },
      });

      await sembrarConjunto(tx, conjunto.id);
      return conjunto;
    });
  }

  async update(id: string, dto: UpdateConjuntoDto, activo: ConjuntoActivo) {
    this.assertMismoConjunto(id, activo);
    return this.prisma.conjunto.update({ where: { id }, data: dto });
  }

  async remove(id: string, activo: ConjuntoActivo) {
    this.assertMismoConjunto(id, activo);
    await this.prisma.conjunto.delete({ where: { id } });
  }

  /**
   * El guard autorizo contra el conjunto de la cabecera `x-conjunto-id`. Si el
   * `:id` de la URL es otro, alguien esta usando permisos de un conjunto para
   * tocar otro. Sin esta comprobacion, un administrador de un conjunto podria
   * borrar cualquier otro.
   */
  private assertMismoConjunto(id: string, activo: ConjuntoActivo) {
    if (id !== activo.conjuntoId) {
      throw new ForbiddenException('El conjunto de la URL no coincide con el de la sesion');
    }
  }

}
