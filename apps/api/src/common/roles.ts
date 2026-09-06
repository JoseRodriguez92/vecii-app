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

/** Donde vive un rol. Es lo que decide si `roles.conjuntoId` va nulo. */
export type AmbitoRol = 'plataforma' | 'conjunto';

export interface RolDelSistema {
  codigo: string;
  nombre: string;
  descripcion: string;
  ambito: AmbitoRol;
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
    ambito: 'plataforma',
    // No se otorga desde un conjunto: se nombra en `usuarios_plataforma`.
    asignable: false,
  },
  {
    codigo: ROL.ADMIN_CONJUNTO,
    nombre: 'Administrador',
    descripcion: 'Administra el conjunto: presupuesto, cuotas, unidades y usuarios.',
    ambito: 'conjunto',
    asignable: true,
  },
  {
    codigo: 'CONSEJO',
    nombre: 'Consejo de Administracion',
    descripcion: 'Obligatorio con mas de 30 unidades privadas (Ley 675).',
    ambito: 'conjunto',
    asignable: true,
  },
  {
    codigo: 'REVISOR_FISCAL',
    nombre: 'Revisor Fiscal',
    descripcion: 'Obligatorio en conjuntos de uso comercial o mixto (Ley 675, arts. 56-57).',
    ambito: 'conjunto',
    asignable: true,
  },
  {
    codigo: 'COMITE_CONVIVENCIA',
    nombre: 'Comite de Convivencia',
    descripcion: 'Opcional en residenciales (Ley 675, art. 58).',
    ambito: 'conjunto',
    asignable: true,
  },
  {
    codigo: 'PORTERIA',
    nombre: 'Porteria',
    descripcion: 'Vigilancia: encomiendas, invitados, ingreso.',
    ambito: 'conjunto',
    asignable: true,
  },
  {
    codigo: ROL.PROPIETARIO,
    nombre: 'Propietario',
    descripcion: 'Derivado: aparece en la escritura de una unidad.',
    ambito: 'conjunto',
    asignable: false,
  },
  {
    codigo: ROL.RESIDENTE,
    nombre: 'Residente',
    descripcion: 'Derivado: vive en una unidad como arrendatario o autorizado.',
    ambito: 'conjunto',
    asignable: false,
  },
];

/** Los que se pueden otorgar como rol de PLATAFORMA. */
export const ROLES_DE_PLATAFORMA = ROLES_DEL_SISTEMA.filter((r) => r.ambito === 'plataforma').map(
  (r) => r.codigo,
);

/** Los que recibe cada conjunto en copia. */
export const ROLES_DE_CONJUNTO = ROLES_DEL_SISTEMA.filter((r) => r.ambito === 'conjunto');

/** Codigos reservados: un conjunto no puede inventar uno que se llame asi. */
export const CODIGOS_RESERVADOS = new Set(ROLES_DEL_SISTEMA.map((r) => r.codigo));
