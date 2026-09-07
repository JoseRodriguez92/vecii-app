import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  MODULOS,
  PERMISOS,
  PERMISOS_DE_PLATAFORMA,
  TODOS_LOS_PERMISOS,
} from '../src/common/permisos.js';
import { Ambito, ROL, ROLES_DEL_SISTEMA } from '../src/common/roles.js';

/**
 * Dato de SISTEMA, no de ejemplo. Sin esto la API no arranca: al levantar
 * verifica que cada permiso declarado en el codigo exista aqui.
 *
 * Idempotente. `nombre` y `descripcion` se actualizan —son editables desde la
 * interfaz—; `codigo` nunca, porque de el dependen los permisos.
 */


/** Permisos por defecto de cada rol. Es el punto de partida; despues se edita
 *  desde la interfaz sin tocar codigo. */
const PERMISOS_POR_ROL: Record<string, string[]> = {
  [ROL.STAFF_VECII]: Object.values(PERMISOS),
  // Todo lo del conjunto, nada de la plataforma: el administrador no nombra
  // staff de Vecii. Antes se excluia un permiso a mano; ahora salen todos los de
  // modulos con ambito PLATAFORMA, asi que agregar uno nuevo no exige acordarse.
  ['ADMIN_CONJUNTO']: Object.values(PERMISOS).filter((p) => !PERMISOS_DE_PLATAFORMA.has(p)),
  ['CONSEJO']: [
    PERMISOS.CONJUNTOS_LEER,
    PERMISOS.USUARIOS_LEER,
    PERMISOS.INSTALACIONES_LEER,
    PERMISOS.RESERVAS_LEER,
    PERMISOS.ROLES_LEER,
  ],
  ['REVISOR_FISCAL']: [PERMISOS.CONJUNTOS_LEER, PERMISOS.USUARIOS_LEER],
  ['COMITE_CONVIVENCIA']: [PERMISOS.CONJUNTOS_LEER, PERMISOS.INSTALACIONES_LEER],
  // El portero registra lo que llega y lo que se retira, pero no toca casilleros:
  // eso es infraestructura y la define la administracion.
  ['PORTERIA']: [
    PERMISOS.CONJUNTOS_LEER,
    PERMISOS.USUARIOS_LEER,
    PERMISOS.ESTRUCTURA_LEER,
    PERMISOS.PORTERIA_LEER,
    PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR,
    PERMISOS.PORTERIA_INVITADOS_GESTIONAR,
    // El portero es quien ve entrar los carros: los registra y los consulta.
    PERMISOS.PORTERIA_VEHICULOS_GESTIONAR,
    // Necesita ver las zonas y los parqueaderos: son el mapa de lo que cuida.
    PERMISOS.INSTALACIONES_LEER,
    PERMISOS.RESERVAS_LEER,
  ],
  // El propietario puede meter a su arrendatario y a su familia en SUS unidades.
  ['PROPIETARIO']: [
    PERMISOS.CONJUNTOS_LEER,
    PERMISOS.ESTRUCTURA_LEER,
    PERMISOS.USUARIOS_CREAR_MI_UNIDAD,
    PERMISOS.PORTERIA_ENCOMIENDAS_MI_UNIDAD,
    PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD,
    PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD,
    PERMISOS.INSTALACIONES_LEER,
    PERMISOS.RESERVAS_LEER,
    PERMISOS.RESERVAS_CREAR,
  ],
  ['RESIDENTE']: [
    PERMISOS.CONJUNTOS_LEER,
    PERMISOS.PORTERIA_ENCOMIENDAS_MI_UNIDAD,
    PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD,
    PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD,
    // Sin esto no puede ver a que horas abre la piscina, que es justo lo que
    // mas se pregunta en un conjunto.
    PERMISOS.INSTALACIONES_LEER,
    PERMISOS.RESERVAS_LEER,
    PERMISOS.RESERVAS_CREAR,
  ],
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
        ambito: modulo.ambito ?? Ambito.CONJUNTO,
      },
      update: {
        nombre: modulo.nombre,
        descripcion: modulo.descripcion,
        orden: modulo.orden,
        ambito: modulo.ambito ?? Ambito.CONJUNTO,
      },
    });

    for (const permiso of modulo.permisos) {
      await prisma.permiso.upsert({
        where: { codigo: permiso.codigo },
        create: { codigo: permiso.codigo, nombre: permiso.nombre, moduloId: fila.id },
        update: { nombre: permiso.nombre, moduloId: fila.id },
      });
    }
  }

  // Los roles del sistema viven con `conjuntoId` nulo. Los de ambito `conjunto`
  // estan aqui todavia porque el paso a una copia por conjunto no se ha hecho
  // (ver docs/pendientes.md); ese dia esta plantilla los siembra por conjunto.
  for (const rol of ROLES_DEL_SISTEMA) {
    const existente = await prisma.rol.findFirst({
      where: { codigo: rol.codigo, conjuntoId: null },
      select: { id: true },
    });
    const datos = {
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      asignable: rol.asignable,
      ambito: rol.ambito,
    };
    if (existente) {
      await prisma.rol.update({ where: { id: existente.id }, data: datos });
    } else {
      await prisma.rol.create({ data: { ...datos, codigo: rol.codigo, conjuntoId: null } });
    }
  }

  // Roles globales que el codigo ya no declara: quedan de un rename. Se avisan y
  // se borran solo si nadie los tiene; si alguien los tiene, borrarlos en
  // silencio le quitaria el acceso sin que nadie se entere.
  const declarados = ROLES_DEL_SISTEMA.map((r) => r.codigo);
  const sobrantes = await prisma.rol.findMany({
    where: { conjuntoId: null, codigo: { notIn: declarados } },
    select: {
      id: true,
      codigo: true,
      _count: { select: { asignaciones: true, deplataforma: true } },
    },
  });
  for (const rol of sobrantes) {
    const enUso = rol._count.asignaciones + rol._count.deplataforma;
    if (enUso > 0) {
      console.warn(
        `OJO: el rol "${rol.codigo}" ya no existe en el codigo pero ${enUso} persona(s) lo ` +
          'tienen. No se borra. Reasignalas y vuelve a correr el seed.',
      );
      continue;
    }
    await prisma.rol.delete({ where: { id: rol.id } });
    console.log(`Rol obsoleto borrado: ${rol.codigo}`);
  }

  for (const [codigoRol, codigosPermiso] of Object.entries(PERMISOS_POR_ROL)) {
    const rol = await prisma.rol.findFirstOrThrow({
      where: { codigo: codigoRol, conjuntoId: null },
    });
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
    `Sembrado: ${MODULOS.length} modulo(s), ${totalPermisos} permiso(s), ${ROLES_DEL_SISTEMA.length} rol(es).`,
  );
  if (permisosBorrados.count || modulosBorrados.count) {
    console.log(
      `Limpieza: ${modulosBorrados.count} modulo(s) y ${permisosBorrados.count} permiso(s) que el codigo ya no declara.`,
    );
  }
}
