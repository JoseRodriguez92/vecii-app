import { Injectable } from '@nestjs/common';
import { rolVigente } from '../common/rol-vigente.js';
import { rolDeRelacion } from '../common/roles-derivados.js';
import type { RelacionUnidad } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConjuntoActivo } from './conjunto-activo.js';
import { PermisosDelRolService } from './permisos-del-rol.service.js';

/**
 * Que puede hacer una persona en un conjunto. UNA sola definicion.
 *
 * El hermano de este archivo es `permisos-del-rol.service.ts`, que responde la
 * otra mitad: que permisos da cada cargo. Aqui se responde que permisos tiene
 * ESTA persona, aqui, hoy — que es la suma de sus cargos mas lo que se deriva
 * de sus unidades.
 *
 * Lo preguntan dos lugares por razones opuestas: el guard, para dejar pasar o
 * no una peticion; y `/auth/me`, para que la app sepa que menu dibujar. Si cada
 * uno lo resolviera por su lado, el dia que cambie la regla —un cuarto origen
 * de roles, una vigencia distinta— la interfaz mostraria botones que el guard
 * rechaza, o esconderia cosas que si se pueden. Eso no se descubre probando:
 * se descubre cuando un usuario reclama.
 *
 * Los roles efectivos salen de TRES origenes y se suman:
 *
 * | origen                  | ejemplo              | alcance                  |
 * |-------------------------|----------------------|--------------------------|
 * | `usuarios_plataforma`   | `STAFF_VECII`        | todos los conjuntos      |
 * | `usuario_conjunto_roles`| `CONSEJO`, `PORTERIA`| solo ese conjunto        |
 * | `usuarios_unidades`     | `PROPIETARIO`        | derivado: nadie lo otorga|
 */

/** Una unidad de la persona, ya resuelta. */
interface Ocupacion {
  conjuntoId: string;
  id: string;
  identificador: string;
  relacion: RelacionUnidad;
  principal: boolean;
}

/** Lo que puede una persona en UN conjunto, con las unidades que se lo dan. */
export interface PermisosEnElConjunto extends ConjuntoActivo {
  /** Las unidades donde vive o de las que es duena, hoy, en este conjunto. */
  unidades: {
    id: string;
    identificador: string;
    relacion: RelacionUnidad;
    principal: boolean;
  }[];
}

/**
 * El guard necesita distinguir tres finales para dar el mensaje correcto, asi
 * que el servicio los devuelve y no decide el HTTP: quien traduce a 403 es
 * quien tiene el contexto de la peticion.
 */
export type Resolucion =
  | { tipo: 'ok'; activo: PermisosEnElConjunto }
  /** Ni vinculo activo ni rol de plataforma: no tiene nada que hacer aqui. */
  | { tipo: 'sin-vinculo' }
  /** Es de plataforma, pero el conjunto de la cabecera no existe. */
  | { tipo: 'conjunto-no-existe' };

@Injectable()
export class PermisosDelUsuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosDelRolService,
  ) {}

  /**
   * Lo que puede en UN conjunto, que puede no ser uno donde viva: alguien de
   * Vecii entra a cualquiera a dar soporte.
   */
  async enElConjunto(usuarioId: string, conjuntoId: string): Promise<Resolucion> {
    // Los roles de plataforma se leen antes que el vinculo porque no dependen
    // de el. Antes STAFF_VECII se otorgaba dentro de un conjunto y por eso solo
    // servia en ese, que era el bug.
    const [dePlataforma, vinculo, ocupaciones] = await Promise.all([
      this.rolesDePlataforma(usuarioId),
      this.prisma.usuarioConjunto.findUnique({
        where: { usuarioId_conjuntoId: { usuarioId, conjuntoId } },
        select: {
          id: true,
          activo: true,
          roles: { where: rolVigente(), select: { rol: { select: { id: true, codigo: true } } } },
        },
      }),
      this.ocupaciones(usuarioId, conjuntoId),
    ]);

    if (!vinculo?.activo) {
      if (dePlataforma.length === 0) return { tipo: 'sin-vinculo' };

      // El conjunto tiene que existir igual: sin esta comprobacion, un id
      // inventado en la cabecera daria un contexto valido apuntando a la nada.
      const existe = await this.prisma.conjunto.findUnique({
        where: { id: conjuntoId },
        select: { id: true },
      });
      if (!existe) return { tipo: 'conjunto-no-existe' };
    }

    return {
      tipo: 'ok',
      activo: await this.componer(
        conjuntoId,
        // Alguien de Vecii puede ademas VIVIR aqui: sus cargos y ocupaciones de
        // este conjunto se SUMAN a los de plataforma, no los reemplazan.
        [...dePlataforma, ...(vinculo?.roles ?? []).map((r) => r.rol)],
        ocupaciones,
        vinculo?.activo ? vinculo.id : null,
        dePlataforma.length > 0,
      ),
    };
  }

  /**
   * Lo mismo, en TODOS los conjuntos donde tiene vinculo activo.
   *
   * Es lo que responde `/auth/me`. Va en una pasada y no llamando al metodo de
   * arriba en un bucle: los roles de plataforma son los mismos para todos, y
   * las ocupaciones se traen de un solo viaje.
   */
  async enTodosSusConjuntos(usuarioId: string): Promise<PermisosEnElConjunto[]> {
    const [dePlataforma, vinculos, todasLasOcupaciones] = await Promise.all([
      this.rolesDePlataforma(usuarioId),
      this.prisma.usuarioConjunto.findMany({
        where: { usuarioId, activo: true },
        select: {
          id: true,
          conjuntoId: true,
          roles: { where: rolVigente(), select: { rol: { select: { id: true, codigo: true } } } },
        },
      }),
      this.ocupaciones(usuarioId),
    ]);

    return Promise.all(
      vinculos.map((v) =>
        this.componer(
          v.conjuntoId,
          [...dePlataforma, ...v.roles.map((r) => r.rol)],
          todasLasOcupaciones.filter((o) => o.conjuntoId === v.conjuntoId),
          v.id,
          dePlataforma.length > 0,
        ),
      ),
    );
  }

  // --- las piezas ------------------------------------------------------------

  private async rolesDePlataforma(usuarioId: string) {
    const filas = await this.prisma.usuarioPlataforma.findMany({
      where: { usuarioId, ...rolVigente() },
      select: { rol: { select: { id: true, codigo: true } } },
    });
    return filas.map((f) => f.rol);
  }

  /** Sin `conjuntoId` trae las de todos los conjuntos, para la version en lote. */
  private async ocupaciones(usuarioId: string, conjuntoId?: string): Promise<Ocupacion[]> {
    const filas = await this.prisma.usuarioUnidad.findMany({
      where: {
        usuarioId,
        ...(conjuntoId ? { unidad: { conjuntoId } } : {}),
        ...rolVigente(),
      },
      select: {
        relacion: true,
        principal: true,
        unidad: { select: { id: true, identificador: true, conjuntoId: true } },
      },
    });
    return filas.map((f) => ({
      conjuntoId: f.unidad.conjuntoId,
      id: f.unidad.id,
      identificador: f.unidad.identificador,
      relacion: f.relacion,
      principal: f.principal,
    }));
  }

  /** La regla, en un solo sitio: asignados + derivados -> roles -> permisos. */
  private async componer(
    conjuntoId: string,
    asignados: { id: string; codigo: string }[],
    ocupaciones: Ocupacion[],
    vinculoId: string | null,
    esDePlataforma: boolean,
  ): Promise<PermisosEnElConjunto> {
    // Propietario y residente no se otorgan: salen de vivir en una unidad. Por
    // eso van por codigo y no por id, y por eso quien vende su apartamento deja
    // de ser propietario solo, sin que nadie borre una fila.
    const derivados = [...new Set(ocupaciones.map((o) => rolDeRelacion(o.relacion)))];

    // Los permisos se resuelven por ID: dos conjuntos pueden tener cada uno un
    // rol con el mismo codigo, y son roles distintos.
    const permisos = await this.permisos.permisosDe(
      asignados.map((r) => r.id),
      derivados,
    );

    return {
      id: vinculoId,
      conjuntoId,
      roles: [...new Set([...asignados.map((r) => r.codigo), ...derivados])],
      permisos,
      esDePlataforma,
      unidades: ocupaciones.map((o) => ({
        id: o.id,
        identificador: o.identificador,
        relacion: o.relacion,
        principal: o.principal,
      })),
    };
  }
}
