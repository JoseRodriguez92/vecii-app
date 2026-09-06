import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PermisosService } from '../../auth/permisos.service.js';
import { Ambito, ROLES_DE_PLATAFORMA } from '../../common/roles.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { NombrarStaffDto, RetirarStaffDto } from './dto/plataforma.dto.js';

@Injectable()
export class PlataformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
  ) {}

  listar(incluirRetirados = false) {
    return this.prisma.usuarioPlataforma.findMany({
      where: incluirRetirados ? {} : rolVigente(),
      orderBy: { desde: 'desc' },
      include: {
        usuario: { select: { id: true, nombres: true, apellidos: true, email: true } },
        rol: { select: { codigo: true, nombre: true } },
      },
    });
  }

  async nombrar(autorId: string, dto: NombrarStaffDto) {
    if (!ROLES_DE_PLATAFORMA.includes(dto.codigo)) {
      throw new BadRequestException(
        `${dto.codigo} no es un rol de plataforma. Solo: ${ROLES_DE_PLATAFORMA.join(', ')}`,
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: { id: true },
    });
    if (!usuario) throw new NotFoundException('Ese usuario no existe');

    const rol = await this.prisma.rol.findFirst({
      where: { codigo: dto.codigo, ambito: Ambito.PLATAFORMA },
      select: { id: true, nombre: true },
    });
    if (!rol) throw new NotFoundException(`No existe el rol ${dto.codigo}`);
    const yaEs = await this.prisma.usuarioPlataforma.findFirst({
      where: { usuarioId: dto.usuarioId, rolId: rol.id, ...rolVigente() },
      select: { desde: true },
    });
    if (yaEs) {
      throw new BadRequestException(
        `Esa persona ya es ${rol.nombre} desde ${yaEs.desde.toISOString().slice(0, 10)}`,
      );
    }

    return this.prisma.usuarioPlataforma.create({
      data: {
        usuarioId: dto.usuarioId,
        rolId: rol.id,
        desde: dto.desde ? new Date(dto.desde) : new Date(),
        otorgadoPorId: autorId,
      },
      include: { rol: { select: { codigo: true, nombre: true } } },
    });
  }

  /**
   * Saca a alguien del equipo. Cierra con `hasta`, no borra: hace falta saber
   * quien tenia acceso a todos los conjuntos cuando paso algo.
   */
  async retirar(autorId: string, usuarioId: string, codigo: string, dto: RetirarStaffDto) {
    const vigentes = await this.prisma.usuarioPlataforma.findMany({
      where: { usuarioId, rol: { codigo }, ...rolVigente() },
      select: { id: true, desde: true },
    });
    if (vigentes.length === 0) {
      throw new NotFoundException('Esa persona no tiene ese rol de plataforma vigente');
    }

    // Que no quede la plataforma sin nadie: si se va el ultimo SUPER_ADMIN, no
    // hay quien vuelva a nombrar a otro y solo se arregla con SQL.
    const otros = await this.prisma.usuarioPlataforma.count({
      where: { rol: { codigo }, usuarioId: { not: usuarioId }, ...rolVigente() },
    });
    if (otros === 0) {
      throw new BadRequestException(
        `Es el ultimo ${codigo} vigente. Nombra a otro antes de retirarlo, o no quedara nadie ` +
          'que pueda hacerlo.',
      );
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : new Date();
    if (Number.isNaN(hasta.getTime())) throw new BadRequestException('Fecha invalida');
    if (vigentes.some((v) => hasta <= v.desde)) {
      throw new BadRequestException('Terminaria antes de empezar');
    }

    await this.prisma.usuarioPlataforma.updateMany({
      where: { id: { in: vigentes.map((v) => v.id) } },
      data: { hasta },
    });
    this.permisos.invalidarCache();
    return { codigo, cerrados: vigentes.length, hasta };
  }
}
