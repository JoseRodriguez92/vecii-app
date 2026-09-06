/**
 * Catalogo de permisos que el codigo conoce.
 *
 * Es el contrato entre los endpoints y la base de datos: el decorador solo
 * acepta valores de aqui, asi que un permiso mal escrito no compila. Y al
 * arrancar, la app verifica que cada uno exista como fila en `permisos` y se
 * niega a levantar si falta alguno.
 *
 * REGLA: cada modulo agrega los suyos cuando se construye. No se inventan
 * permisos de modulos que todavia no existen — en dos meses la mitad sobrarian.
 *
 * Formato: `modulo.recurso.accion` (el recurso se omite si el modulo es simple).
 */
export const PERMISOS = {
  // --- modulo: conjuntos ---
  CONJUNTOS_LEER: 'conjuntos.leer',
  CONJUNTOS_EDITAR: 'conjuntos.editar',
  CONJUNTOS_ELIMINAR: 'conjuntos.eliminar',

  // --- modulo: estructura ---
  ESTRUCTURA_LEER: 'estructura.leer',
  ESTRUCTURA_GESTIONAR: 'estructura.gestionar',
  /// Separado de gestionar: cargar un archivo puede crear cientos de filas de
  /// un golpe. Merece un permiso propio.
  UNIDADES_IMPORTAR: 'estructura.unidades.importar',

  // --- modulo: usuarios ---
  USUARIOS_LEER: 'usuarios.leer',
  USUARIOS_GESTIONAR: 'usuarios.gestionar',
  /// Invitar a CUALQUIER unidad del conjunto. Es del administrador.
  USUARIOS_INVITAR: 'usuarios.invitar',
  /// Invitar solo a las unidades propias. Lo tiene el propietario, para que
  /// pueda meter a su arrendatario y a su familia sin pasar por administracion.
  /// El guard solo verifica que tenga el permiso; que la unidad sea suya lo
  /// comprueba el servicio, porque es un alcance de FILA y el guard razona a
  /// nivel de conjunto.
  USUARIOS_INVITAR_MI_UNIDAD: 'usuarios.invitar.mi_unidad',

  // --- modulo: porteria ---
  PORTERIA_LEER: 'porteria.leer',
  /// Crear y editar casilleros. Es del administrador, no de porteria: el portero
  /// registra lo que llega, no rediseña el mueble.
  PORTERIA_GESTIONAR: 'porteria.gestionar',
  /// Registrar lo que llega, avisar, y anotar quien retiro. Es el trabajo diario
  /// del portero.
  PORTERIA_ENTREGAS_REGISTRAR: 'porteria.entregas.registrar',
  /// Ver solo las entregas de las unidades propias. Lo tienen el propietario y el
  /// residente. Igual que con invitaciones, el guard solo verifica el permiso; que
  /// la unidad sea suya lo resuelve el servicio, porque es alcance de FILA.
  PORTERIA_ENTREGAS_MI_UNIDAD: 'porteria.entregas.mi_unidad',
} as const;

export type CodigoPermiso = (typeof PERMISOS)[keyof typeof PERMISOS];

/** Todos los codigos declarados. Lo usa la verificacion de arranque. */
export const TODOS_LOS_PERMISOS = Object.values(PERMISOS) as CodigoPermiso[];

/**
 * Modulos y a que permisos pertenecen. Solo para agrupar en la interfaz de
 * administracion: sin esto, el administrador ve una lista plana inmanejable.
 */
export const MODULOS = [
  {
    codigo: 'conjuntos',
    nombre: 'Conjuntos',
    descripcion: 'Datos del conjunto y su configuracion.',
    orden: 10,
    permisos: [
      { codigo: PERMISOS.CONJUNTOS_LEER, nombre: 'Ver el conjunto' },
      { codigo: PERMISOS.CONJUNTOS_EDITAR, nombre: 'Editar datos del conjunto' },
      { codigo: PERMISOS.CONJUNTOS_ELIMINAR, nombre: 'Eliminar el conjunto' },
    ],
  },
  {
    codigo: 'usuarios',
    nombre: 'Usuarios',
    descripcion: 'Quien esta en el conjunto, con que rol y en que unidad.',
    orden: 15,
    permisos: [
      { codigo: PERMISOS.USUARIOS_LEER, nombre: 'Ver los usuarios del conjunto' },
      { codigo: PERMISOS.USUARIOS_GESTIONAR, nombre: 'Asignar roles y ocupaciones' },
      { codigo: PERMISOS.USUARIOS_INVITAR, nombre: 'Invitar a cualquier unidad' },
      { codigo: PERMISOS.USUARIOS_INVITAR_MI_UNIDAD, nombre: 'Invitar a mis propias unidades' },
    ],
  },
  {
    codigo: 'porteria',
    nombre: 'Porteria',
    descripcion: 'Casilleros y lo que llega para las unidades.',
    orden: 30,
    permisos: [
      { codigo: PERMISOS.PORTERIA_LEER, nombre: 'Ver casilleros y entregas del conjunto' },
      { codigo: PERMISOS.PORTERIA_GESTIONAR, nombre: 'Crear y editar casilleros' },
      { codigo: PERMISOS.PORTERIA_ENTREGAS_REGISTRAR, nombre: 'Registrar entregas y retiros' },
      { codigo: PERMISOS.PORTERIA_ENTREGAS_MI_UNIDAD, nombre: 'Ver las entregas de mis unidades' },
    ],
  },
  {
    codigo: 'estructura',
    nombre: 'Estructura del conjunto',
    descripcion: 'Agrupaciones, unidades y tipologias.',
    orden: 20,
    permisos: [
      { codigo: PERMISOS.ESTRUCTURA_LEER, nombre: 'Ver la estructura' },
      { codigo: PERMISOS.ESTRUCTURA_GESTIONAR, nombre: 'Crear y editar la estructura' },
      { codigo: PERMISOS.UNIDADES_IMPORTAR, nombre: 'Importar unidades masivamente' },
    ],
  },
] as const;
