/**
 * Como se lee cada restriccion de la base cuando salta.
 *
 * Postgres dice `conjuntos_nit_key`. El administrador tiene que leer "Ya hay un
 * conjunto registrado con ese NIT". Traducir eso no se puede hacer con una
 * regla: hay que escribirlo restriccion por restriccion, y por eso existe este
 * archivo.
 *
 * `verificar-errores.mjs` comprueba, en cada `pnpm lint`, que toda restriccion
 * de las migraciones este aqui o declarada como interna. El dia que alguien
 * agregue un indice unico sin mensaje, el lint lo dice — que es mucho mejor que
 * enterarse porque un usuario vio "Unique constraint failed".
 *
 * `campos` va en camelCase, como los DTO: es lo que la pantalla usa para
 * resaltar el campo que choco.
 */

export interface MensajeDeRestriccion {
  mensaje: string;
  campos?: string[];
}

/** Indices unicos que un usuario puede chocar de verdad. */
export const UNICOS: Record<string, MensajeDeRestriccion> = {
  conjuntos_nit_key: {
    mensaje: 'Ya hay un conjunto registrado con ese NIT.',
    campos: ['nit'],
  },

  // --- estructura ---
  agrupaciones_conjunto_id_nombre_key: {
    mensaje: 'Ya hay una agrupacion con ese nombre en este conjunto.',
    campos: ['nombre'],
  },
  unidades_conjunto_id_agrupacion_id_identificador_key: {
    mensaje: 'Ya hay una unidad con ese identificador en esa agrupacion.',
    campos: ['identificador'],
  },
  unidad_identificador_sin_agrupacion: {
    mensaje: 'Ya hay una unidad con ese identificador fuera de toda agrupacion.',
    campos: ['identificador'],
  },
  tipologias_conjunto_id_nombre_key: {
    mensaje: 'Ya hay una tipologia con ese nombre en este conjunto.',
    campos: ['nombre'],
  },

  // --- instalaciones ---
  zonas_comunes_conjunto_id_nombre_key: {
    mensaje: 'Ya hay una zona comun con ese nombre en este conjunto.',
    campos: ['nombre'],
  },
  horarios_zona_comun_zona_comun_id_dia_apertura_key: {
    mensaje: 'Esa zona ya tiene una franja que abre a esa hora ese dia.',
    campos: ['dia', 'apertura'],
  },
  parqueaderos_conjunto_id_identificador_key: {
    mensaje: 'Ya hay un parqueadero con ese identificador en este conjunto.',
    campos: ['identificador'],
  },
  asignaciones_parqueadero_parqueadero_id_unidad_id_desde_key: {
    mensaje: 'Esa unidad ya tiene una asignacion de ese cupo que empieza el mismo dia.',
    campos: ['desde'],
  },

  // --- reservas ---
  espacios_reservables_conjunto_id_nombre_key: {
    mensaje: 'Ya hay un espacio reservable con ese nombre en este conjunto.',
    campos: ['nombre'],
  },
  espacios_reservables_zona_comun_id_key: {
    mensaje: 'Esa zona comun ya tiene un espacio reservable.',
    campos: ['zonaComunId'],
  },
  politicas_reserva_espacio_id_key: {
    mensaje: 'Ese espacio ya tiene una politica. Editala en vez de crear otra.',
    campos: ['espacioId'],
  },

  // --- porteria ---
  casilleros_conjunto_id_identificador_key: {
    mensaje: 'Ya hay un casillero con ese identificador en este conjunto.',
    campos: ['identificador'],
  },
  casilleros_unidad_id_conjunto_id_key: {
    mensaje: 'Esa unidad ya tiene un casillero asignado.',
    campos: ['unidadId'],
  },
  vehiculo_placa_vigente_unica: {
    mensaje:
      'Esa placa ya esta registrada y vigente en este conjunto. Si el vehiculo cambio de dueno, dale de baja alla primero.',
    campos: ['placa'],
  },
  bicicleta_serial_vigente_unico: {
    mensaje: 'Ese serial ya esta registrado y vigente en este conjunto.',
    campos: ['serial'],
  },

  // --- personas y cargos ---
  usuarios_email_key: {
    mensaje: 'Ese correo ya esta registrado en Vecii.',
    campos: ['email'],
  },
  usuarios_tipo_documento_numero_documento_key: {
    mensaje: 'Ese documento ya esta registrado en Vecii.',
    campos: ['tipoDocumento', 'numeroDocumento'],
  },
  usuarios_cuenta_id_key: {
    mensaje: 'Esa cuenta de acceso ya esta enlazada a otra persona.',
    campos: ['cuentaId'],
  },
  usuarios_conjuntos_usuario_id_conjunto_id_key: {
    mensaje: 'Esa persona ya esta vinculada a este conjunto.',
  },
  usuarios_unidades_usuario_id_unidad_id_relacion_desde_key: {
    mensaje: 'Esa persona ya tiene esa relacion con la unidad desde esa fecha.',
    campos: ['desde'],
  },
  usuario_conjunto_roles_usuario_conjunto_id_rol_id_desde_key: {
    mensaje: 'Esa persona ya tiene ese cargo desde esa fecha.',
    campos: ['desde'],
  },
  usuarios_plataforma_usuario_id_rol_id_desde_key: {
    mensaje: 'Esa persona ya tiene ese rol de plataforma desde esa fecha.',
    campos: ['desde'],
  },

  // --- catalogo ---
  roles_conjunto_id_codigo_key: {
    mensaje: 'Ya hay un rol con ese codigo en este conjunto.',
    campos: ['codigo'],
  },
  rol_estandar_codigo_unico: {
    mensaje: 'Ya existe un rol estandar con ese codigo.',
    campos: ['codigo'],
  },
  modulos_codigo_key: { mensaje: 'Ya existe un modulo con ese codigo.', campos: ['codigo'] },
  permisos_codigo_key: { mensaje: 'Ya existe un permiso con ese codigo.', campos: ['codigo'] },
};

/**
 * Los CHECK que escribimos a mano. Cuando saltan, el dato es imposible por
 * definicion, y "violacion de restriccion" no le sirve a nadie.
 */
export const CHEQUEOS: Record<string, string> = {
  encomienda_destino_unico:
    'Una encomienda va para una unidad o para una agrupacion, no para las dos.',
  espacio_apunta_a_algo:
    'Un espacio reservable es una zona comun o un pool de parqueaderos, y tiene que ser exactamente uno de los dos.',
  rol_plataforma_sin_conjunto: 'Un rol de plataforma no puede pertenecer a ningun conjunto.',
  unidad_no_es_accesoria_de_si_misma:
    'Una unidad no puede ser accesoria de si misma. El parqueadero cuelga del apartamento, no de si mismo.',
};

/**
 * Restricciones que ningun usuario puede chocar, con el motivo.
 *
 * Casi todas son los indices `(id, conjunto_id)` que existen solo para que las
 * llaves foraneas compuestas puedan apuntar ahi: el `id` es un uuid nuevo cada
 * vez, asi que la pareja jamas se repite. Estan declaradas para que el
 * verificador no las reclame, y con el motivo escrito para que nadie tenga que
 * volver a deducirlo.
 */
export const INTERNAS: Record<string, string> = {
  agrupaciones_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  unidades_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  tipologias_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  zonas_comunes_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  parqueaderos_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  espacios_reservables_id_conjunto_id_key:
    'destino de una FK compuesta; el id es unico por si solo',
  casilleros_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  invitados_id_conjunto_id_key: 'destino de una FK compuesta; el id es unico por si solo',
  politicas_reserva_espacio_id_conjunto_id_key:
    'destino de una FK compuesta; ya lo cubre politicas_reserva_espacio_id_key',
};
