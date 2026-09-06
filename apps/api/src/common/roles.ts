import { AmbitoRol as Ambito } from '../generated/prisma/enums.js';

/**
 * Los codigos de rol, en el codigo y no en la base.
 *
 * Antes esto era el enum `CodigoRol` de Prisma, y eso le ponia techo a la tabla
 * `roles`: solo cabian los ocho valores del enum. Un conjunto que quisiera un
 * "Comite de Deportes" no tenia donde ponerlo.
 *
 * Ahora `roles.codigo` es texto y esta lista es otra cosa: **los codigos que el
 * SISTEMA conoce por nombre**. Son pocos, porque el codigo casi nunca pregunta
 * por un rol —pregunta por un permiso—. Por eso un rol inventado funciona sin
 * tocar nada: nadie lo menciona, y sus permisos los resuelve el mismo mecanismo.
 */

/** Los unicos que el codigo referencia directamente. */
export const ROL = {
  /** Equipo de Vecii. Rol de PLATAFORMA: no pertenece a ningun conjunto. */
  STAFF_VECII: 'STAFF_VECII',
  /** El administrador del conjunto, la figura de la Ley 675. */
  ADMIN_CONJUNTO: 'ADMIN_CONJUNTO',
  /** Derivados de `usuarios_unidades`. Nadie los otorga. */
  PROPIETARIO: 'PROPIETARIO',
  RESIDENTE: 'RESIDENTE',
} as const;

export type CodigoRolConocido = (typeof ROL)[keyof typeof ROL];

// El ambito vive en la base como enum: la distincion la define el sistema y un
// conjunto nunca va a inventar un tercero. Es el caso donde un enum si sirve —al
// reves que `codigo`, que tuvo que soltarse porque los conjuntos lo inventan.
export { AmbitoRol as Ambito } from '../generated/prisma/enums.js';

/**
 * `ambito` y `asignable` responden preguntas distintas, y confundirlas deja
 * pantallas vacias:
 *
 *   ambito     DONDE se otorga    PLATAFORMA | CONJUNTO
 *   asignable  SI alguien lo otorga, o si se deriva de otra cosa
 *
 * Solo PROPIETARIO y RESIDENTE son `asignable: false`, porque salen de
 * `usuarios_unidades` y nadie los reparte.
 */
export interface RolDelSistema {
  codigo: string;
  nombre: string;
  descripcion: string;
  ambito: Ambito;
  /** Si un administrador puede otorgarlo a mano. */
  asignable: boolean;
}

/**
 * La plantilla. De aqui salen los roles que se siembran.
 *
 * Los de ambito `conjunto` son los que cada conjunto recibe en copia; los de
 * `plataforma` viven una sola vez, con `conjuntoId` nulo.
 */
export const ROLES_DEL_SISTEMA: RolDelSistema[] = [
  {
    codigo: ROL.STAFF_VECII,
    nombre: 'Staff Vecii',
    descripcion: 'Equipo de Vecii. Entra a cualquier conjunto para dar soporte.',
    ambito: Ambito.PLATAFORMA,
    // SI se otorga: lo nombra alguien con `roles.plataforma` en
    // `usuarios_plataforma`. Que no se otorgue desde un conjunto ya lo dice
    // `ambito`, no hace falta que lo diga tambien esta casilla.
    asignable: true,
  },
  {
    codigo: ROL.ADMIN_CONJUNTO,
    nombre: 'Administrador',
    descripcion: 'Administra el conjunto: presupuesto, cuotas, unidades y usuarios.',
    ambito: Ambito.CONJUNTO,
    asignable: true,
  },
  {
    codigo: 'CONSEJO',
    nombre: 'Consejo de Administracion',
    descripcion: 'Obligatorio con mas de 30 unidades privadas (Ley 675).',
    ambito: Ambito.CONJUNTO,
    asignable: true,
  },
  {
    codigo: 'REVISOR_FISCAL',
    nombre: 'Revisor Fiscal',
    descripcion: 'Obligatorio en conjuntos de uso comercial o mixto (Ley 675, arts. 56-57).',
    ambito: Ambito.CONJUNTO,
    asignable: true,
  },
  {
    codigo: 'COMITE_CONVIVENCIA',
    nombre: 'Comite de Convivencia',
    descripcion: 'Opcional en residenciales (Ley 675, art. 58).',
    ambito: Ambito.CONJUNTO,
    asignable: true,
  },
  {
    codigo: 'PORTERIA',
    nombre: 'Porteria',
    descripcion: 'Vigilancia: encomiendas, invitados, ingreso.',
    ambito: Ambito.CONJUNTO,
    asignable: true,
  },
  {
    codigo: ROL.PROPIETARIO,
    nombre: 'Propietario',
    descripcion: 'Derivado: aparece en la escritura de una unidad.',
    ambito: Ambito.CONJUNTO,
    asignable: false,
  },
  {
    codigo: ROL.RESIDENTE,
    nombre: 'Residente',
    descripcion: 'Derivado: vive en una unidad como arrendatario o autorizado.',
    ambito: Ambito.CONJUNTO,
    asignable: false,
  },
];

/** Los que se pueden otorgar como rol de PLATAFORMA. */
export const ROLES_DE_PLATAFORMA = ROLES_DEL_SISTEMA.filter((r) => r.ambito === Ambito.PLATAFORMA).map(
  (r) => r.codigo,
);

/** Los que recibe cada conjunto en copia. */
export const ROLES_DE_CONJUNTO = ROLES_DEL_SISTEMA.filter((r) => r.ambito === Ambito.CONJUNTO);

/** Codigos reservados: un conjunto no puede inventar uno que se llame asi. */
export const CODIGOS_RESERVADOS = new Set(ROLES_DEL_SISTEMA.map((r) => r.codigo));
