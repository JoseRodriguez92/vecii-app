import { AmbitoRol, AmbitoRol as Ambito } from '../generated/prisma/enums.js';

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
  /// Registrar a alguien en CUALQUIER unidad del conjunto. Es del administrador.
  USUARIOS_CREAR: 'usuarios.crear',
  /// Registrar gente solo en las unidades propias. Lo tiene el propietario, para que
  /// pueda meter a su arrendatario y a su familia sin pasar por administracion.
  /// El guard solo verifica que tenga el permiso; que la unidad sea suya lo
  /// comprueba el servicio, porque es un alcance de FILA y el guard razona a
  /// nivel de conjunto.
  USUARIOS_CREAR_MI_UNIDAD: 'usuarios.crear.mi_unidad',

  // --- modulo: porteria ---
  PORTERIA_LEER: 'porteria.leer',
  /// Crear y editar casilleros. Es del administrador, no de porteria: el portero
  /// registra lo que llega, no rediseña el mueble.
  PORTERIA_GESTIONAR: 'porteria.gestionar',
  /// Registrar lo que llega, avisar, y anotar quien retiro. Es el trabajo diario
  /// del portero.
  PORTERIA_ENCOMIENDAS_REGISTRAR: 'porteria.encomiendas.registrar',
  /// Ver solo las encomiendas de las unidades propias. Lo tienen el propietario y el
  /// residente. Igual que al registrar usuarios, el guard solo verifica el permiso; que
  /// la unidad sea suya lo resuelve el servicio, porque es alcance de FILA.
  PORTERIA_ENCOMIENDAS_MI_UNIDAD: 'porteria.encomiendas.mi_unidad',

  /// Autorizar invitados en CUALQUIER unidad. Lo tienen la administracion y el
  /// portero, que a veces anota lo que le autorizaron por citofono.
  PORTERIA_INVITADOS_GESTIONAR: 'porteria.invitados.gestionar',
  /// Autorizar invitados solo en las unidades propias. Lo tiene cualquiera que
  /// viva ahi —propietario o arrendatario, da igual: los amigos son de quien
  /// vive, no de quien firma la escritura—. El alcance de fila lo verifica el
  /// servicio.
  PORTERIA_INVITADOS_MI_UNIDAD: 'porteria.invitados.mi_unidad',

  // --- modulo: inventario ---
  /// El inventario FISICO del conjunto: zonas comunes con sus horarios, y
  /// parqueaderos. Es distinto de `estructura`, que es la propiedad privada
  /// —lo que tiene coeficiente y se vende—; y distinto de `reservas`, que dice
  /// como se reparte lo que aqui existe. Un bien comun no se vende y no paga
  /// administracion: por eso no cabe en ninguno de los dos.
  INVENTARIO_LEER: 'inventario.leer',
  /// Crear y editar zonas comunes, sus horarios y los parqueaderos. Es del
  /// administrador. Lo pusimos junto y no separado por recurso porque es la
  /// misma persona la que carga las dos cosas, y separarlo hoy solo agregaria
  /// una casilla mas a la pantalla de permisos sin que nadie la use distinto.
  INVENTARIO_GESTIONAR: 'inventario.gestionar',

  // --- modulo: reservas ---
  RESERVAS_LEER: 'reservas.leer',
  /// Crear y editar los espacios reservables y sus politicas. Es del
  /// administrador: define QUE se puede reservar y con que reglas.
  RESERVAS_GESTIONAR: 'reservas.gestionar',
  /// Apartar para una unidad propia. Lo tiene cualquiera que viva ahi, salvo que
  /// la politica del espacio diga `soloPropietarios`.
  RESERVAS_CREAR: 'reservas.crear',
  /// Aprobar, rechazar, cancelar la de otro y marcar que no asistio.
  RESERVAS_ADMINISTRAR: 'reservas.administrar',

  // --- modulo: roles ---
  ROLES_LEER: 'roles.leer',
  /// Editar la matriz de que puede hacer cada rol. Es el permiso mas peligroso
  /// del sistema: con el se otorgan todos los demas. Por eso va aparte de
  /// `usuarios.gestionar`, que solo reparte cargos ya definidos.
  ROLES_GESTIONAR: 'roles.gestionar',

  // --- modulo: plataforma (ambito PLATAFORMA) ---
  /// Nombrar y quitar staff de Vecii. Otorga poder FUERA del conjunto activo, y
  /// por eso su modulo es de plataforma: no aparece en la pantalla de permisos de
  /// un conjunto ni se puede otorgar desde ahi.
  PLATAFORMA_STAFF_GESTIONAR: 'plataforma.staff.gestionar',
} as const;

export type CodigoPermiso = (typeof PERMISOS)[keyof typeof PERMISOS];

/** Todos los codigos declarados. Lo usa la verificacion de arranque. */
export const TODOS_LOS_PERMISOS = Object.values(PERMISOS) as CodigoPermiso[];


/**
 * Modulos y a que permisos pertenecen. Solo para agrupar en la interfaz de
 * administracion: sin esto, el administrador ve una lista plana inmanejable.
 */
export interface ModuloDeclarado {
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
  /** Omitido = CONJUNTO. Solo `plataforma` es distinto. */
  ambito?: AmbitoRol;
  permisos: { codigo: string; nombre: string }[];
}

export const MODULOS: ModuloDeclarado[] = [
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
      { codigo: PERMISOS.USUARIOS_CREAR, nombre: 'Registrar gente en cualquier unidad' },
      { codigo: PERMISOS.USUARIOS_CREAR_MI_UNIDAD, nombre: 'Registrar gente en mis unidades' },
    ],
  },
  {
    codigo: 'plataforma',
    nombre: 'Plataforma',
    descripcion: 'Lo que es de Vecii y no de ningun conjunto.',
    orden: 90,
    ambito: Ambito.PLATAFORMA,
    permisos: [
      { codigo: PERMISOS.PLATAFORMA_STAFF_GESTIONAR, nombre: 'Nombrar y quitar staff de Vecii' },
    ],
  },
  {
    codigo: 'roles',
    nombre: 'Roles y permisos',
    descripcion: 'Que puede hacer cada cargo. Cambiarlo no exige desplegar codigo.',
    orden: 50,
    permisos: [
      { codigo: PERMISOS.ROLES_LEER, nombre: 'Ver roles, modulos y permisos' },
      { codigo: PERMISOS.ROLES_GESTIONAR, nombre: 'Editar que puede hacer cada rol' },
    ],
  },
  {
    codigo: 'reservas',
    nombre: 'Reservas',
    descripcion: 'Que se puede apartar, con que reglas, y quien lo aparto.',
    orden: 40,
    permisos: [
      { codigo: PERMISOS.RESERVAS_LEER, nombre: 'Ver espacios y reservas' },
      { codigo: PERMISOS.RESERVAS_GESTIONAR, nombre: 'Definir espacios y politicas' },
      { codigo: PERMISOS.RESERVAS_CREAR, nombre: 'Apartar para mis unidades' },
      { codigo: PERMISOS.RESERVAS_ADMINISTRAR, nombre: 'Aprobar, rechazar y cancelar reservas' },
    ],
  },
  {
    codigo: 'porteria',
    nombre: 'Porteria',
    descripcion: 'Casilleros y lo que llega para las unidades.',
    orden: 30,
    permisos: [
      { codigo: PERMISOS.PORTERIA_LEER, nombre: 'Ver casilleros y encomiendas del conjunto' },
      { codigo: PERMISOS.PORTERIA_GESTIONAR, nombre: 'Crear y editar casilleros' },
      { codigo: PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR, nombre: 'Registrar encomiendas y retiros' },
      { codigo: PERMISOS.PORTERIA_ENCOMIENDAS_MI_UNIDAD, nombre: 'Ver las encomiendas de mis unidades' },
      { codigo: PERMISOS.PORTERIA_INVITADOS_GESTIONAR, nombre: 'Autorizar invitados en cualquier unidad' },
      { codigo: PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD, nombre: 'Autorizar invitados en mis unidades' },
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
  {
    codigo: 'inventario',
    nombre: 'Inventario fisico',
    descripcion: 'Zonas comunes con sus horarios, y parqueaderos.',
    orden: 25,
    permisos: [
      { codigo: PERMISOS.INVENTARIO_LEER, nombre: 'Ver el inventario fisico' },
      { codigo: PERMISOS.INVENTARIO_GESTIONAR, nombre: 'Crear y editar el inventario fisico' },
    ],
  },
] as const;

/** Los permisos que solo puede otorgar el equipo de Vecii. */
export const PERMISOS_DE_PLATAFORMA = new Set(
  MODULOS.filter((m) => m.ambito === Ambito.PLATAFORMA).flatMap((m) =>
    m.permisos.map((p) => p.codigo),
  ),
);
