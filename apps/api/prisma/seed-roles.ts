import type { PrismaClient } from '../src/generated/prisma/client.js';
import { CodigoRol } from '../src/generated/prisma/enums.js';
import { MODULOS, PERMISOS, TODOS_LOS_PERMISOS } from '../src/common/permisos.js';

/**
 * Dato de SISTEMA, no de ejemplo. Sin esto la API no arranca: al levantar
 * verifica que cada permiso declarado en el codigo exista aqui.
 *
 * Idempotente. `nombre` y `descripcion` se actualizan —son editables desde la
 * interfaz—; `codigo` nunca, porque de el dependen los permisos.
 */

const ROLES = [
  {
    codigo: CodigoRol.SUPER_ADMIN,
    nombre: 'Staff Vecii',
    descripcion: 'Personal de Vecii con acceso de soporte.',
    asignable: false,
  },
  {
    codigo: CodigoRol.ADMIN_CONJUNTO,
    nombre: 'Administrador',
    descripcion: 'Administra el conjunto: presupuesto, cuotas, unidades y usuarios.',
    asignable: true,
  },
  {
    codigo: CodigoRol.CONSEJO,
    nombre: 'Consejo de Administracion',
    descripcion: 'Organo elegido en asamblea. Se asigna por periodo.',
    asignable: true,
  },
  {
    codigo: CodigoRol.REVISOR_FISCAL,
    nombre: 'Revisor Fiscal',
    descripcion: 'Vigila la contabilidad. Obligatorio en conjuntos comerciales o mixtos.',
    asignable: true,
  },
  {
    codigo: CodigoRol.COMITE_CONVIVENCIA,
    nombre: 'Comite de Convivencia',
    descripcion: 'Resuelve conflictos entre residentes por via de dialogo.',
    asignable: true,
  },
  {
    codigo: CodigoRol.PORTERIA,
    nombre: 'Porteria',
    descripcion: 'Vigilancia: registra visitantes y autoriza ingresos.',
    asignable: true,
  },
  // Estos dos NO se otorgan: se derivan de `usuarios_unidades`. Existen como
  // filas porque necesitan permisos asociados, pero `asignable: false` impide
  // que un administrador se los ponga a alguien que no tiene ni una unidad.
  {
    codigo: CodigoRol.PROPIETARIO,
    nombre: 'Propietario',
    descripcion: 'Derivado: tiene al menos una unidad con relacion de propietario.',
    asignable: false,
  },
  {
    codigo: CodigoRol.RESIDENTE,
    nombre: 'Residente',
    descripcion: 'Derivado: vive en una unidad como arrendatario o autorizado.',
    asignable: false,
  },
];

/** Permisos por defecto de cada rol. Es el punto de partida; despues se edita
 *  desde la interfaz sin tocar codigo. */
const PERMISOS_POR_ROL: Record<string, string[]> = {
  [CodigoRol.SUPER_ADMIN]: Object.values(PERMISOS),
  [CodigoRol.ADMIN_CONJUNTO]: Object.values(PERMISOS),
  [CodigoRol.CONSEJO]: [PERMISOS.CONJUNTOS_LEER, PERMISOS.USUARIOS_LEER],
  [CodigoRol.REVISOR_FISCAL]: [PERMISOS.CONJUNTOS_LEER, PERMISOS.USUARIOS_LEER],
  [CodigoRol.COMITE_CONVIVENCIA]: [PERMISOS.CONJUNTOS_LEER],
  // El portero registra lo que llega y lo que se retira, pero no toca casilleros:
  // eso es infraestructura y la define la administracion.
  [CodigoRol.PORTERIA]: [
    PERMISOS.CONJUNTOS_LEER,
    PERMISOS.USUARIOS_LEER,
    PERMISOS.ESTRUCTURA_LEER,
    PERMISOS.PORTERIA_LEER,
    PERMISOS.PORTERIA_ENTREGAS_REGISTRAR,
  ],
  // El propietario puede meter a su arrendatario y a su familia en SUS unidades.
  [CodigoRol.PROPIETARIO]: [
    PERMISOS.CONJUNTOS_LEER,
    PERMISOS.ESTRUCTURA_LEER,
    PERMISOS.USUARIOS_INVITAR_MI_UNIDAD,
    PERMISOS.PORTERIA_ENTREGAS_MI_UNIDAD,
  ],
  [CodigoRol.RESIDENTE]: [PERMISOS.CONJUNTOS_LEER, PERMISOS.PORTERIA_ENTREGAS_MI_UNIDAD],
};

export async function sembrarRoles(prisma: PrismaClient) {
  // Un permiso declarado en PERMISOS pero sin modulo no se sembraria nunca, y
  // la API se negaria a arrancar por un permiso "faltante" que en realidad
  // existe en el codigo. Mejor fallar aqui, que es donde se puede leer el error.
  const declaradosEnModulos = new Set(MODULOS.flatMap((m) => m.permisos.map((p) => p.codigo)));
  const huerfanos = TODOS_LOS_PERMISOS.filter((c) => !declaradosEnModulos.has(c));
  if (huerfanos.length) {
    throw new Error(`Permisos sin modulo en MODULOS: ${huerfanos.join(', ')}`);
  }

  for (const modulo of MODULOS) {
    const fila = await prisma.modulo.upsert({
      where: { codigo: modulo.codigo },
      create: {
        codigo: modulo.codigo,
        nombre: modulo.nombre,
        descripcion: modulo.descripcion,
        orden: modulo.orden,
      },
      update: { nombre: modulo.nombre, descripcion: modulo.descripcion, orden: modulo.orden },
    });

    for (const permiso of modulo.permisos) {
      await prisma.permiso.upsert({
        where: { codigo: permiso.codigo },
        create: { codigo: permiso.codigo, nombre: permiso.nombre, moduloId: fila.id },
        update: { nombre: permiso.nombre, moduloId: fila.id },
      });
    }
  }

  for (const rol of ROLES) {
    await prisma.rol.upsert({
      where: { codigo: rol.codigo },
      create: rol,
      update: { nombre: rol.nombre, descripcion: rol.descripcion, asignable: rol.asignable },
    });
  }

  for (const [codigoRol, codigosPermiso] of Object.entries(PERMISOS_POR_ROL)) {
    const rol = await prisma.rol.findUniqueOrThrow({ where: { codigo: codigoRol as CodigoRol } });
    for (const codigoPermiso of codigosPermiso) {
      const permiso = await prisma.permiso.findUniqueOrThrow({ where: { codigo: codigoPermiso } });
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        create: { rolId: rol.id, permisoId: permiso.id },
        update: {},
      });
    }
  }

  // Limpia lo que el codigo ya no declara. Sin esto, renombrar un modulo deja
  // los permisos viejos vivos en la base: siguen otorgados a los roles y siguen
  // autorizando, aunque ningun endpoint los exija ya. Borrar el Permiso arrastra
  // sus filas de roles_permisos por cascada.
  const permisosBorrados = await prisma.permiso.deleteMany({
    where: { codigo: { notIn: [...declaradosEnModulos] } },
  });
  const modulosBorrados = await prisma.modulo.deleteMany({
    where: { codigo: { notIn: MODULOS.map((m) => m.codigo) } },
  });

  const totalPermisos = MODULOS.reduce((n, m) => n + m.permisos.length, 0);
  console.log(
    `Sembrado: ${MODULOS.length} modulo(s), ${totalPermisos} permiso(s), ${ROLES.length} rol(es).`,
  );
  if (permisosBorrados.count || modulosBorrados.count) {
    console.log(
      `Limpieza: ${modulosBorrados.count} modulo(s) y ${permisosBorrados.count} permiso(s) que el codigo ya no declara.`,
    );
  }
}
