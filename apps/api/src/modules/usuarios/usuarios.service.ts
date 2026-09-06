import { Injectable } from '@nestjs/common';
import { rolVigente } from '../../common/rol-vigente.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quien esta en el conjunto, con sus roles vigentes y sus unidades. */
  async listar(conjuntoId: string) {
    const vinculos = await this.prisma.usuarioConjunto.findMany({
      where: { conjuntoId },
      include: {
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            email: true,
            celular: true,
            tipoDocumento: true,
            numeroDocumento: true,
          },
        },
        roles: {
          where: rolVigente(),
          select: { desde: true, hasta: true, rol: { select: { codigo: true, nombre: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Las ocupaciones cuelgan del usuario, no del vinculo, asi que se traen
    // aparte y se acotan a las unidades DE ESTE conjunto.
    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: {
        usuarioId: { in: vinculos.map((v) => v.usuarioId) },
        unidad: { conjuntoId },
        OR: [{ hasta: null }, { hasta: { gt: new Date() } }],
      },
      select: {
        usuarioId: true,
        relacion: true,
        principal: true,
        unidad: { select: { id: true, identificador: true } },
      },
    });

    return vinculos.map((v) => ({
      ...v,
      unidades: ocupaciones.filter((o) => o.usuarioId === v.usuarioId),
    }));
  }
}
