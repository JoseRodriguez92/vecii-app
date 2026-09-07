import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { rolVigente } from '../../common/rol-vigente.js';
import { Ambito } from '../../common/roles.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { OtorgarRolDto, TerminarRolDto } from '../roles/dto/rol.dto.js';

/**
 * Los cargos de una persona DENTRO de un conjunto.
 *
 * Vivia dentro de `UsuariosService`, que asi hacia dos cosas que no se parecen:
 * quien es la gente, y que puede hacer. Son preguntas distintas, las contesta
 * gente distinta —una la administracion al registrar, la otra el consejo al
 * elegir— y cambian por motivos distintos.
 *
 * Ojo con la vecindad: `roles` (el modulo) define QUE cargos existen y que
 * permisos tiene cada uno. Esto reparte esos cargos a personas concretas, con
 * vigencia. Por eso vive aqui y no alla.
 */
@Injectable()
export class CargosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Otorga un cargo en el conjunto.
   *
   * `desde` es del periodo, no del clic: al consejo se entra por periodo, y el
   * administrador registra la eleccion despues de que paso. Por eso se puede
   * mandar una fecha anterior.
   */
  async otorgarRol(conjuntoId: string, usuarioId: string, autorId: string, dto: OtorgarRolDto) {
    const vinculo = await this.prisma.usuarioConjunto.findFirst({
      where: { usuarioId, conjuntoId },
      select: { id: true },
    });
    if (!vinculo) throw new NotFoundException('Esa persona no pertenece a este conjunto');

    // TODO (paso 2): cuando los roles sean por conjunto, `conjuntoId: null` pasa
    // a ser el conjunto activo. Hoy todos los roles son globales.
    // Un cargo estandar (sin conjunto) o uno que este conjunto invento. Los de
    // OTRO conjunto no existen para el.
    const rol = await this.prisma.rol.findFirst({
      where: { codigo: dto.codigo, OR: [{ conjuntoId: null }, { conjuntoId }] },
      select: { id: true, nombre: true, asignable: true, ambito: true },
    });
    if (!rol) throw new NotFoundException(`No existe el rol ${dto.codigo}`);
    // Un rol de plataforma se nombra en `usuarios_plataforma`, no desde aqui.
    // Sin esta comprobacion, cualquiera con `usuarios.gestionar` podria nombrar
    // staff de Vecii desde su propio conjunto.
    if (rol.ambito !== Ambito.CONJUNTO) {
      throw new ForbiddenException(
        `${rol.nombre} es un rol de plataforma: se nombra desde el equipo de Vecii, no aqui.`,
      );
    }
    if (!rol.asignable) {
      throw new BadRequestException(
        `${rol.nombre} no se otorga a mano. Propietario y residente se derivan de las unidades; ` +
          'SUPER_ADMIN es staff de Vecii.',
      );
    }

    const desde = dto.desde ? new Date(dto.desde) : new Date();
    if (Number.isNaN(desde.getTime())) throw new BadRequestException('Fecha invalida');

    const yaLoTiene = await this.prisma.usuarioConjuntoRol.findFirst({
      where: { usuarioConjuntoId: vinculo.id, rolId: rol.id, ...rolVigente() },
      select: { desde: true },
    });
    if (yaLoTiene) {
      throw new BadRequestException(
        `Esa persona ya es ${rol.nombre} desde ${yaLoTiene.desde.toISOString().slice(0, 10)}`,
      );
    }

    return this.prisma.usuarioConjuntoRol.create({
      data: {
        usuarioConjuntoId: vinculo.id,
        rolId: rol.id,
        desde,
        asignadoPorId: autorId,
      },
      include: { rol: { select: { codigo: true, nombre: true } } },
    });
  }

  /**
   * Termina un cargo. Cierra con `hasta`, no borra.
   *
   * Es para lo que existe la vigencia: cuando el consejo cambia, la fila del
   * saliente se queda, porque "quien era consejero cuando se aprobo eso" es una
   * pregunta que se hace en cada asamblea.
   */
  async terminarRol(
    conjuntoId: string,
    usuarioId: string,
    codigo: string,
    dto: TerminarRolDto,
  ) {
    const vigentes = await this.prisma.usuarioConjuntoRol.findMany({
      where: {
        usuarioConjunto: { usuarioId, conjuntoId },
        rol: { codigo },
        ...rolVigente(),
      },
      select: { id: true, desde: true },
    });
    if (vigentes.length === 0) {
      throw new NotFoundException('Esa persona no tiene ese cargo vigente en este conjunto');
    }

    const hasta = dto.hasta ? new Date(dto.hasta) : new Date();
    if (Number.isNaN(hasta.getTime())) throw new BadRequestException('Fecha invalida');
    if (vigentes.some((v) => hasta <= v.desde)) {
      throw new BadRequestException('El cargo terminaria antes de empezar');
    }

    await this.prisma.usuarioConjuntoRol.updateMany({
      where: { id: { in: vigentes.map((v) => v.id) } },
      data: { hasta },
    });
    return { codigo, cerrados: vigentes.length, hasta };
  }

  /**
   * Los cargos que se pueden otorgar AL REGISTRAR a alguien en un conjunto.
   *
   * Dos filtros, y hacen falta los dos: `asignable` saca los derivados, y
   * `ambito` saca los de plataforma. Antes bastaba con el primero porque
   * STAFF_VECII estaba marcado no-asignable; ahora que si lo es —lo otorga Vecii
   * en su propia pantalla— sin el segundo se podria nombrar staff desde aqui.
   */
  async validarRolesOtorgables(conjuntoId: string, roles?: string[]) {
    if (!roles?.length) return [];
    const encontrados = await this.prisma.rol.findMany({
      where: { codigo: { in: roles }, OR: [{ conjuntoId: null }, { conjuntoId }] },
      select: { id: true, codigo: true, asignable: true, nombre: true, ambito: true },
    });

    const dePlataforma = encontrados.filter((r) => r.ambito !== Ambito.CONJUNTO);
    if (dePlataforma.length > 0) {
      throw new ForbiddenException(
        `Estos son roles de plataforma y se nombran desde el equipo de Vecii: ` +
          `${dePlataforma.map((r) => r.nombre).join(', ')}.`,
      );
    }

    const noOtorgables = encontrados.filter((r) => !r.asignable);
    if (noOtorgables.length > 0) {
      throw new BadRequestException(
        `Estos roles no se otorgan a mano: ${noOtorgables.map((r) => r.nombre).join(', ')}. ` +
          'Propietario y residente se derivan de las unidades.',
      );
    }
    if (encontrados.length !== roles.length) {
      throw new BadRequestException('Alguno de los roles indicados no existe');
    }
    return encontrados;
  }
}
